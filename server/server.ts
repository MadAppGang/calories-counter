// Load environment variables based on environment
import { config } from 'dotenv';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { streamText } from 'hono/streaming';
import { Context, Next } from 'hono';
import { Anthropic } from '@anthropic-ai/sdk';
import sharp from 'sharp';
import { authMiddleware, optionalAuthMiddleware } from './auth-middleware.js';

// Type definitions
interface MealData {
  id?: string;
  name: string;
  calories: number;
  timestamp: number;
  userId: string;
  imageUrl?: string;
}

interface FirestoreCollections {
  MEALS: string;
}

interface ValidationResult {
  valid: boolean;
  size?: number;
  sizeInMB?: number;
  error?: string;
}

interface ProcessedImageResult {
  success: boolean;
  path: string;
  mimeType: string;
  error?: string;
}

interface ClaudeAnalysisResult {
  success: boolean;
  name?: string;
  description?: string;
  calories?: number;
  healthScore?: number;
  error?: string;
}

// Define the custom user environment for Hono context
interface UserEnv {
  Variables: {
    user: {
      uid: string;
      email?: string;
      name?: string;
      picture?: string;
      [key: string]: unknown;
    };
  };
}

// Check if we're running in Firebase Functions environment
const isFirebaseFunctions: boolean = !!process.env.FUNCTION_TARGET || !!process.env.FIREBASE_CONFIG;

// Load environment variables based on environment
if (!isFirebaseFunctions) {
  // Load from .env file in local development
  config();
} else {
  // Running in Firebase Functions
  try {
    // Get environment variables from Firebase Functions config
    const functionConfig = JSON.parse(process.env.FIREBASE_CONFIG || '{}');

    // If we're running in Firebase, we need to load the config from Firebase
    if (!process.env.CLAUDE_API_KEY && functionConfig?.claude?.api_key) {
      process.env.CLAUDE_API_KEY = functionConfig.claude.api_key;
    }

    // Firebase Admin SDK config - Using non-reserved names when in Functions
    if (!process.env.PROJECT_ID && functionConfig?.project?.id) {
      process.env.PROJECT_ID = functionConfig.project.id;
    }
    if (!process.env.CLIENT_EMAIL && functionConfig?.client?.email) {
      process.env.CLIENT_EMAIL = functionConfig.client.email;
    }
    if (!process.env.PRIVATE_KEY && functionConfig?.private?.key) {
      process.env.PRIVATE_KEY = functionConfig.private.key;
    }

    // Development mode
    if (!process.env.DEV_MODE && functionConfig?.app?.dev_mode) {
      process.env.DEV_MODE = functionConfig.app.dev_mode;
    }

    console.log('Loaded environment variables from Firebase Functions config');
  } catch (error) {
    console.error('Error loading Firebase Functions config:', error);
  }
}

// Get environment variables
const CLAUDE_API_KEY: string | undefined = process.env.CLAUDE_API_KEY;
// Change PORT to SERVER_PORT to avoid reserved name
const SERVER_PORT: number = parseInt(process.env.SERVER_PORT || '3002', 10);

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads/')) {
  fs.mkdirSync('uploads/');
}

// Create data directory if it doesn't exist
if (!fs.existsSync('data/')) {
  fs.mkdirSync('data/');
}

// Check if development mode is enabled
const isDevelopmentMode: boolean = process.env.DEV_MODE === 'true';

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  try {
    // For Firebase Functions, use the default credentials
    if (isFirebaseFunctions && !process.env.FIREBASE_CONFIG) {
      // If running in Firebase Functions environment but without custom config
      admin.initializeApp();
      console.log('Firebase Admin SDK initialized with default app credentials');
    } else {
      // Initialize with environment variables (either from .env or from Functions config)
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.PROJECT_ID,
          clientEmail: process.env.CLIENT_EMAIL,
          privateKey: process.env.PRIVATE_KEY?.replace(/\\n/g, '\n')
        })
      });
      console.log('Firebase Admin SDK initialized with service account credentials');
    }
  } catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error);
  }
}

// Initialize Firestore
let db: FirebaseFirestore.Firestore | undefined;
let firestoreAvailable: boolean = false;
try {
  // Get Firestore instance
  db = admin.firestore();

  // Set up Firestore settings
  db.settings({
    ignoreUndefinedProperties: true
  });

  console.log('Firestore initialized successfully');
  firestoreAvailable = true;
} catch (error) {
  console.error('Error initializing Firestore:', error);
  console.warn('Running without Firestore. Mock data will be used.');
}

// Log mode information
if (isDevelopmentMode) {
  console.log('🔧 Running in DEVELOPMENT MODE with mock authentication');
  console.log('🔧 Set DEV_MODE=false in .env to use real Firebase authentication');
  firestoreAvailable = false; // Force use of mock data in dev mode
}

// Define collection names
const COLLECTIONS: FirestoreCollections = {
  MEALS: 'meals'
};

// Helper function to create Firestore indexes if needed
async function ensureFirestoreIndexes(): Promise<void> {
  try {
    console.log('Creating recommended Firestore indexes...');
    console.log('Note: You may need to manually create the following indexes in the Firebase console:');
    console.log('- Collection: meals, Fields: userId ASC, timestamp DESC');
    console.log('- Collection: meals, Fields: userId ASC, timestamp ASC, timestamp DESC');
  } catch (error) {
    console.error('Error creating Firestore indexes:', error);
  }
}

// Ensure indexes are created
ensureFirestoreIndexes();

// Helper function to get MIME type from file extension
function getMimeTypeFromExtension(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.tiff': 'image/tiff',
    '.tif': 'image/tiff'
  };

  return mimeTypes[ext] || 'image/png'; // Default to PNG if unknown
}

// Helper function to save uploaded file
async function saveUploadedFile(file: File, filename: string): Promise<string> {
  const filePath = path.join('uploads', filename);

  try {
    // With Bun, we can directly use the arrayBuffer() method
    if (typeof file.arrayBuffer === 'function') {
      const buffer = Buffer.from(await file.arrayBuffer());
      await fs.promises.writeFile(filePath, buffer);
      return filePath;
    }

    // Fallback for other environments
    console.log('Using fallback file writing method');
    // @ts-expect-error - file.stream might not be properly typed in all environments
    await fs.promises.writeFile(filePath, file.stream);
    return filePath;
  } catch (error: unknown) {
    console.error('Error saving file:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to save file: ${errorMessage}`);
  }
}

// Helper function to validate image and check size
async function validateImage(filePath: string): Promise<ValidationResult> {
  try {
    const stats = await fs.promises.stat(filePath);
    const fileSizeInMB = stats.size / (1024 * 1024);

    // Claude has a limit around 5MB for images, we'll use 4.5MB to be safe
    if (fileSizeInMB > 4.5) {
      throw new Error(`Image too large (${fileSizeInMB.toFixed(2)}MB). Maximum size is 4.5MB.`);
    }

    // Ensure the file is not empty
    if (stats.size === 0) {
      throw new Error('Image file is empty.');
    }

    return {
      valid: true,
      size: stats.size,
      sizeInMB: fileSizeInMB
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      valid: false,
      error: errorMessage
    };
  }
}

// Helper function to process image with Sharp for Claude compatibility
async function processImageForClaude(inputPath: string, originalMimeType: string): Promise<ProcessedImageResult> {
  // Determine output format (JPEG or PNG are safest for Claude)
  let format = 'jpeg';
  let mimeType = 'image/jpeg';

  // Use PNG for images that need transparency or are originally PNG
  if (originalMimeType === 'image/png') {
    format = 'png';
    mimeType = 'image/png';
  }

  const outputPath = `${inputPath}.processed.${format}`;

  try {
    // Process with Sharp
    await sharp(inputPath)
      .toFormat(format as keyof sharp.FormatEnum, { quality: 90 }) // Use good quality but not maximum
      .toFile(outputPath);

    console.log(`Processed image saved to ${outputPath}`);

    return {
      success: true,
      path: outputPath,
      mimeType: mimeType
    };
  } catch (error: unknown) {
    console.error('Error processing image with Sharp:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMessage,
      // Return original path and mime type as fallback
      path: inputPath,
      mimeType: originalMimeType
    };
  }
}

// Create Hono app with the custom environment
const app = new Hono<UserEnv>();

// Middleware
app.use('*', logger());
app.use('*', prettyJSON());
app.use('*', cors());

// Health check endpoint
app.get('/', (c) => c.text('Calorie Tracker API is running'));

// Get all meals
app.get('/api/meals', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const userId = user.uid;

    // Check if Firestore is available
    if (!firestoreAvailable) {
      console.log('Using mock data for /api/meals endpoint (Firestore not available)');
      // Return mock data for development
      return c.json({
        success: true,
        data: [
          {
            id: 'mock-meal-1',
            name: 'Mock Breakfast',
            calories: 350,
            timestamp: Date.now() - 86400000, // Yesterday
            userId: userId
          },
          {
            id: 'mock-meal-2',
            name: 'Mock Lunch',
            calories: 650,
            timestamp: Date.now() - 43200000, // 12 hours ago
            userId: userId
          },
          {
            id: 'mock-meal-3',
            name: 'Mock Dinner',
            calories: 850,
            timestamp: Date.now() - 21600000, // 6 hours ago
            userId: userId
          }
        ]
      });
    }

    // Normal Firestore flow
    if (!db) {
      throw new Error('Firestore is not initialized');
    }
    
    const mealsRef = db.collection(COLLECTIONS.MEALS);
    const snapshot = await mealsRef.where('userId', '==', userId).orderBy('timestamp', 'desc').get();

    const meals: MealData[] = [];
    snapshot.forEach(doc => {
      meals.push({ id: doc.id, ...(doc.data() as Omit<MealData, 'id'>) });
    });

    return c.json({
      success: true,
      data: meals
    });
  } catch (error: unknown) {
    console.error('Error getting all meals:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({
      success: false,
      message: `Failed to retrieve meals: ${errorMessage}`
    }, 500);
  }
});

// Get today's meals
app.get('/api/meals/today', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const userId = user.uid;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfDay = today.getTime();

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const endOfDay = tomorrow.getTime();

    // Check if Firestore is available
    if (!firestoreAvailable) {
      console.log('Using mock data for /api/meals/today endpoint (Firestore not available)');
      // Return mock data for development
      const currentTime = Date.now();
      return c.json({
        success: true,
        data: [
          {
            id: 'mock-meal-today-1',
            name: 'Mock Breakfast Today',
            calories: 450,
            timestamp: startOfDay + 3600000, // 1 hour after midnight
            userId: userId
          },
          {
            id: 'mock-meal-today-2',
            name: 'Mock Lunch Today',
            calories: 700,
            timestamp: currentTime - 10800000, // 3 hours ago 
            userId: userId
          }
        ]
      });
    }

    // Normal Firestore flow
    if (!db) {
      throw new Error('Firestore is not initialized');
    }
    
    const mealsRef = db.collection(COLLECTIONS.MEALS);
    const snapshot = await mealsRef
      .where('userId', '==', userId)
      .where('timestamp', '>=', startOfDay)
      .where('timestamp', '<', endOfDay)
      .orderBy('timestamp', 'desc')
      .get();

    const meals: MealData[] = [];
    snapshot.forEach(doc => {
      meals.push({ id: doc.id, ...(doc.data() as Omit<MealData, 'id'>) });
    });

    return c.json({
      success: true,
      data: meals
    });
  } catch (error: unknown) {
    console.error('Error getting today\'s meals:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({
      success: false,
      message: `Failed to retrieve today's meals: ${errorMessage}`
    }, 500);
  }
});

// Add a new meal
app.post('/api/meals', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const userId = user.uid;

    const mealData: MealData = await c.req.json();

    if (!mealData.name || !mealData.calories) {
      return c.json({
        success: false,
        message: 'Name and calories are required'
      }, 400);
    }

    // Ensure the meal has a timestamp
    if (!mealData.timestamp) {
      mealData.timestamp = Date.now();
    }

    // Add userId to the meal data
    mealData.userId = userId;

    // Set default values
    if (!mealData.imageUrl) {
      mealData.imageUrl = '/placeholder.svg';
    }

    // Check if Firestore is available
    if (!firestoreAvailable) {
      console.log('Using mock data for POST /api/meals endpoint (Firestore not available)');
      // Return mock response for development
      const mockId = 'mock-meal-' + Date.now();
      const insertedMeal = {
        id: mockId,
        ...mealData
      };

      return c.json({
        success: true,
        data: insertedMeal
      }, 201);
    }

    // Normal Firestore flow
    if (!db) {
      throw new Error('Firestore is not initialized');
    }
    
    // Add the meal to Firestore
    const mealRef = await db.collection(COLLECTIONS.MEALS).add(mealData);

    // Get the inserted document
    const mealDoc = await mealRef.get();
    const insertedMeal = { id: mealDoc.id, ...(mealDoc.data() as Omit<MealData, 'id'>) };

    return c.json({
      success: true,
      data: insertedMeal
    }, 201);
  } catch (error: unknown) {
    console.error('Error adding meal:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({
      success: false,
      message: `Failed to add meal: ${errorMessage}`
    }, 500);
  }
});

// Delete a meal
app.delete('/api/meals/:id', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const userId = user.uid;

    const mealId = c.req.param('id');

    if (!db) {
      throw new Error('Firestore is not initialized');
    }
    
    // Get the meal document and verify ownership
    const mealRef = db.collection(COLLECTIONS.MEALS).doc(mealId);
    const mealDoc = await mealRef.get();

    if (!mealDoc.exists) {
      return c.json({
        success: false,
        message: 'Meal not found'
      }, 404);
    }

    const mealData = mealDoc.data() as MealData;

    // Check if the user owns this meal
    if (mealData.userId !== userId) {
      return c.json({
        success: false,
        message: 'Unauthorized to delete this meal'
      }, 403);
    }

    // Delete the meal
    await mealRef.delete();

    return c.json({
      success: true,
      message: 'Meal deleted'
    });
  } catch (error: unknown) {
    console.error('Error deleting meal:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({
      success: false,
      message: `Failed to delete meal: ${errorMessage}`
    }, 500);
  }
});

// Clear all meals (for testing/admin purposes - restricted to authenticated users and their own meals)
app.delete('/api/meals', authMiddleware, async (c) => {
  try {
    const user = c.get('user');
    const userId = user.uid;

    if (!db) {
      throw new Error('Firestore is not initialized');
    }
    
    // Get all meals for this user
    const mealsRef = db.collection(COLLECTIONS.MEALS);
    const snapshot = await mealsRef.where('userId', '==', userId).get();

    // Delete each meal in a batch
    const batch = db.batch();
    snapshot.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    return c.json({
      success: true,
      message: 'All meals cleared'
    });
  } catch (error: unknown) {
    console.error('Error clearing meals:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({
      success: false,
      message: `Failed to clear meals: ${errorMessage}`
    }, 500);
  }
});

// Function to analyze image with Claude AI
async function analyzeImageWithClaude(imagePath: string, mimeType: string): Promise<ClaudeAnalysisResult> {
  try {
    // Initialize Anthropic client with the API key from environment
    if (!CLAUDE_API_KEY) {
      throw new Error('CLAUDE_API_KEY environment variable is not set');
    }
    
    const anthropic = new Anthropic({
      apiKey: CLAUDE_API_KEY,
    });

    // Validate that the file exists
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image file not found: ${imagePath}`);
    }

    // Read the image file
    const imageBuffer = fs.readFileSync(imagePath);

    // Verify the buffer is not empty
    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error('Image buffer is empty');
    }

    // Get image info before encoding
    console.log(`Raw image size: ${(imageBuffer.length / 1024).toFixed(2)}KB`);

    // Make sure image is not too large (Claude has ~10MB limit for all content)
    const maxSizeBytes = 4 * 1024 * 1024; // 4MB
    if (imageBuffer.length > maxSizeBytes) {
      console.log(`Image too large (${(imageBuffer.length / 1024 / 1024).toFixed(2)}MB), compressing...`);

      // Use sharp to resize and compress the image
      const format = mimeType.includes('png') ? 'png' : 'jpeg';
      const compressedImageBuffer = await sharp(imageBuffer)
        .resize({ width: 1280, fit: 'inside', withoutEnlargement: true })
        .toFormat(format, { quality: 80 })
        .toBuffer();

      console.log(`Compressed from ${(imageBuffer.length / 1024).toFixed(2)}KB to ${(compressedImageBuffer.length / 1024).toFixed(2)}KB`);

      // Use the compressed buffer instead
      if (compressedImageBuffer.length < imageBuffer.length) {
        console.log(`Using compressed image`);
        // Convert to base64
        const base64Image = compressedImageBuffer.toString('base64');

        // Use the provided MIME type, but strictly limit to supported types
        // According to Anthropic docs, only these media types are supported
        const supportedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        let mediaType = supportedTypes.includes(mimeType) ? mimeType : 'image/jpeg';
        if (format === 'png') mediaType = 'image/png';
        if (format === 'jpeg') mediaType = 'image/jpeg';

        return await sendImageToAnthropicAPI(anthropic, base64Image, mediaType);
      }
    }

    // If we didn't compress or compression wasn't effective, use original image
    // Convert to base64
    const base64Image = imageBuffer.toString('base64');

    // Verify base64 data is valid
    if (!base64Image || base64Image.length === 0) {
      throw new Error('Generated base64 image data is empty');
    }

    // Use the provided MIME type, but strictly limit to supported types
    // According to Anthropic docs, only these media types are supported
    const supportedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    let mediaType = supportedTypes.includes(mimeType) ? mimeType : 'image/jpeg';
    if (mimeType.includes('png')) mediaType = 'image/png';
    if (mimeType.includes('jpeg')) mediaType = 'image/jpeg';

    // For debugging
    console.log(`Using media type: ${mediaType} for Claude API request`);
    console.log(`Base64 length: ${base64Image.length} characters`);

    return await sendImageToAnthropicAPI(anthropic, base64Image, mediaType);
  } catch (error: unknown) {
    console.error('Error in Claude AI analysis:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: errorMessage || 'Unknown error in Claude analysis'
    };
  }
}

// Helper function to send image to Anthropic API and process response
async function sendImageToAnthropicAPI(anthropic: Anthropic, base64Image: string, mediaType: string): Promise<ClaudeAnalysisResult> {
  try {
    // Create the message with image content, following exactly the Anthropic documentation format
    const response = await anthropic.messages.create({
      model: "claude-3-sonnet-20240229",
      max_tokens: 1000,
      temperature: 0.7,
      system: "You are a food analysis assistant that helps identify foods, estimate their caloric content, and evaluate their healthiness.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Please analyze this food image. Identify what food item(s) are in the image and estimate the calorie count and healthiness. Return your response in JSON format with four fields: 'title' (a brief name of the food), 'description' (a detailed description of the food including ingredients and preparation style), 'calories' (your estimate of calories as a number), and 'healthRating' (an integer from 1 to 5, where 1 means highly processed unhealthy food and 5 means whole/nutritious healthy food)."
            },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data: base64Image
              }
            }
          ]
        }
      ]
    });

    // Parse Claude's response to extract the JSON data
    const claudeResponse = response.content[0].text;
    console.log('Claude response received successfully');

    // Extract the JSON part from Claude's response
    // This regex looks for a JSON object anywhere in the text
    const jsonMatch = claudeResponse.match(/\{[\s\S]*"title"[\s\S]*"description"[\s\S]*"calories"[\s\S]*"healthRating"[\s\S]*\}/);

    if (jsonMatch) {
      try {
        // Parse the extracted JSON
        const parsedResponse = JSON.parse(jsonMatch[0]);

        return {
          success: true,
          name: parsedResponse.title,
          description: parsedResponse.description,
          calories: parseInt(parsedResponse.calories, 10) || 0,
          healthScore: parsedResponse.healthRating || 3 // Default to middle value if missing
        };
      } catch (jsonError) {
        console.error('Error parsing Claude response as JSON:', jsonError);
      }
    }

    // If JSON extraction fails, attempt to parse the response differently
    // Look for patterns like "title: Pizza" and "calories: 350"
    const titleMatch = claudeResponse.match(/title[:\s]+([^,\n.]+)/i);
    const descriptionMatch = claudeResponse.match(/description[:\s]+([^,\n.]+)/i);
    const caloriesMatch = claudeResponse.match(/calories[:\s]+(\d+)/i);
    const healthRatingMatch = claudeResponse.match(/health[Rr]ating[:\s]+(\d+)/i);

    if (titleMatch && caloriesMatch) {
      return {
        success: true,
        name: titleMatch[1].trim(),
        description: descriptionMatch ? descriptionMatch[1].trim() : titleMatch[1].trim(),
        calories: parseInt(caloriesMatch[1], 10) || 0,
        healthScore: healthRatingMatch ? parseInt(healthRatingMatch[1], 10) : 3
      };
    }

    return {
      success: false,
      error: 'Could not parse Claude response'
    };
  } catch (claudeError: unknown) {
    console.error('Error calling Claude API:', claudeError);

    // Try to extract the detailed error message
    let errorMessage = 'Unknown Claude API error';
    if (claudeError instanceof Error) {
      errorMessage = claudeError.message;
    }

    return {
      success: false,
      error: errorMessage
    };
  }
}

// Analyze image endpoint with Claude AI integration
app.post('/api/analyze-image', optionalAuthMiddleware, async (c) => {
  try {
    const formData = await c.req.formData();
    const imageFile = formData.get('image') as File | null;

    if (!imageFile) {
      return c.json({ success: false, message: 'No image uploaded' }, 400);
    }

    // Check if API key is available in environment
    if (!CLAUDE_API_KEY) {
      return c.json({
        success: false,
        message: 'Server configuration error: API key not available'
      }, 500);
    }

    // No need to store user if it's not used
    // Commented out: const user = c.get('user');
    
    let originalFilePath: string | null = null;
    let processedFilePath: string | null = null;

    try {
      // Generate a unique filename
      const fileExt = imageFile.name ? path.extname(imageFile.name) : '.png';
      const filename = `${Date.now()}${fileExt}`;

      console.log(`Processing uploaded file: ${imageFile.name || 'unnamed'} (${fileExt})`);

      // Save the uploaded file
      originalFilePath = await saveUploadedFile(imageFile, filename);

      // Validate the image
      const validation = await validateImage(originalFilePath);
      if (!validation.valid) {
        return c.json({
          success: false,
          message: `Invalid image: ${validation.error}`
        }, 400);
      }

      console.log(`Image validated: ${validation.sizeInMB?.toFixed(2)}MB`);

      // Get MIME type from file or use extension-based detection
      let originalMimeType = imageFile.type;

      // If mimetype is missing or is octet-stream, try to determine from extension
      if (!originalMimeType || originalMimeType === 'application/octet-stream') {
        originalMimeType = getMimeTypeFromExtension(originalFilePath);
      }

      // Process the image to ensure it's in a Claude-compatible format
      const processedImage = await processImageForClaude(originalFilePath, originalMimeType);

      if (!processedImage.success) {
        console.warn(`Image processing warning: ${processedImage.error}. Using original image.`);
      } else {
        processedFilePath = processedImage.path;
      }

      // Use Claude AI to analyze the image
      const result = await analyzeImageWithClaude(
        processedImage.success ? processedImage.path : originalFilePath,
        processedImage.success ? processedImage.mimeType : originalMimeType
      );

      if (result.success) {
        return c.json({
          success: true,
          name: result.name,
          description: result.description,
          calories: result.calories,
          healthScore: result.healthScore,
          message: "Food analyzed with AI"
        });
      } else {
        // If analysis fails, return error
        console.error('Claude AI analysis failed:', result.error);
        return c.json({
          success: false,
          message: 'Failed to analyze image: ' + result.error
        }, 500);
      }
    } catch (apiError: unknown) {
      console.error('API recognition error:', apiError);
      const errorMessage = apiError instanceof Error ? apiError.message : 'Unknown error';
      return c.json({
        success: false,
        message: `API error: ${errorMessage}`
      }, 500);
    } finally {
      // Clean up - delete all temp files
      try {
        if (originalFilePath && fs.existsSync(originalFilePath)) {
          fs.unlinkSync(originalFilePath);
        }
        if (processedFilePath && fs.existsSync(processedFilePath)) {
          fs.unlinkSync(processedFilePath);
        }
      } catch (err) {
        console.warn('Failed to delete temporary files:', err);
      }
    }
  } catch (error: unknown) {
    console.error('Error analyzing image:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ success: false, message: `Server error: ${errorMessage}` }, 500);
  }
});

// Stream the analysis for real-time updates (optional feature)
app.post('/api/analyze-stream', optionalAuthMiddleware, async (c) => {
  try {
    const formData = await c.req.formData();
    const imageFile = formData.get('image') as File | null;

    if (!imageFile) {
      return c.json({ success: false, message: 'No image uploaded' }, 400);
    }

    // Check if API key is available in environment
    if (!CLAUDE_API_KEY) {
      return c.json({
        success: false,
        message: 'Server configuration error: API key not available'
      }, 500);
    }

    // No need to store user if it's not used
    // Commented out: const user = c.get('user');
    
    return streamText(c, async (stream) => {
      let originalFilePath: string | null = null;
      let processedFilePath: string | null = null;

      try {
        await stream.write('Starting analysis...\n');

        // Save the uploaded file
        const fileExt = imageFile.name ? path.extname(imageFile.name) : '.png';
        const filename = `${Date.now()}${fileExt}`;
        await stream.write('Saving uploaded file...\n');
        originalFilePath = await saveUploadedFile(imageFile, filename);

        // Validate image
        const validation = await validateImage(originalFilePath);
        if (!validation.valid) {
          await stream.write(`Error: Invalid image - ${validation.error}\n`);
          return;
        }

        await stream.write(`Image validated: ${validation.sizeInMB?.toFixed(2)}MB\n`);

        // Get MIME type
        let originalMimeType = imageFile.type;
        if (!originalMimeType || originalMimeType === 'application/octet-stream') {
          originalMimeType = getMimeTypeFromExtension(originalFilePath);
        }

        // Process the image
        await stream.write('Processing image for compatibility...\n');
        const processedImage = await processImageForClaude(originalFilePath, originalMimeType);

        if (!processedImage.success) {
          await stream.write(`Warning: Image processing failed - ${processedImage.error}. Using original image.\n`);
        } else {
          processedFilePath = processedImage.path;
          await stream.write(`Image processed successfully. Format: ${processedImage.mimeType}\n`);
        }

        // Analyze image
        await stream.write('Sending to Claude AI for analysis...\n');
        const result = await analyzeImageWithClaude(
          processedImage.success ? processedImage.path : originalFilePath,
          processedImage.success ? processedImage.mimeType : originalMimeType
        );

        if (result.success) {
          await stream.write(`Analysis complete!\n`);
          await stream.write(`Food: ${result.name}\n`);
          await stream.write(`Description: ${result.description}\n`);
          await stream.write(`Calories: ${result.calories}\n`);
          await stream.write(`Health Score: ${result.healthScore}\n`);
          await stream.write(JSON.stringify({
            success: true,
            name: result.name,
            description: result.description,
            calories: result.calories,
            healthScore: result.healthScore
          }, null, 2));
        } else {
          await stream.write(`Analysis failed: ${result.error}\n`);
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await stream.write(`Error: ${errorMessage}\n`);
      } finally {
        // Clean up
        try {
          if (originalFilePath && fs.existsSync(originalFilePath)) {
            fs.unlinkSync(originalFilePath);
          }
          if (processedFilePath && fs.existsSync(processedFilePath)) {
            fs.unlinkSync(processedFilePath);
          }
        } catch (err) {
          console.warn('Failed to delete temporary files:', err);
        }
      }
    });
  } catch (error: unknown) {
    console.error('Error in stream analysis:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ success: false, message: `Server error: ${errorMessage}` }, 500);
  }
});

// Export the Hono app for use in Firebase Cloud Functions
export default app;

// Export a function to set up routes on an existing app instance
export function setupRoutes(existingApp: Hono<UserEnv>): Hono<UserEnv> {
  // Copy all routes from our app to the existing app
  existingApp.routes = app.routes;
  
  // Copy all registered handlers/middleware
  existingApp.use('*', (_, next) => next());  // Dummy middleware to ensure middleware array is created
  
  // Use native Hono methods to add each middleware
  interface HonoMiddleware {
    path: string;
    handler: (c: Context<UserEnv>, next: Next) => Promise<Response | void>;
  }
  
  const middlewares = (app as { _middleware?: HonoMiddleware[] })._middleware || [];
  for (const middleware of middlewares) {
    if (middleware.path === '*') {
      existingApp.use('*', middleware.handler);
    } else {
      existingApp.use(middleware.path, middleware.handler);
    }
  }
  
  return existingApp;
}

// Start the server if this file is run directly (not imported as a module)
// @ts-expect-error - Bun-specific property
if (import.meta.url === import.meta.main) {
  // Start the server using Bun's native HTTP capabilities
  console.log(`Starting server on port ${SERVER_PORT}...`);

  // Directly use Bun's serve functionality with Hono
  const server = {
    port: SERVER_PORT,
    fetch: app.fetch
  };

  // @ts-expect-error - Bun-specific API
  Bun.serve(server);

  // Log successful startup and API key status
  console.log(`Server running on port ${SERVER_PORT}`);
  if (!CLAUDE_API_KEY) {
    console.warn('Warning: CLAUDE_API_KEY environment variable is not set. The AI analysis feature will not function properly.');
  }

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log('Shutting down server...');
    process.exit(0);
  });
} 