import { Context } from 'hono';
import { streamText } from 'hono/streaming';
import { Anthropic } from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import fs from 'fs';
import * as fsPromises from 'fs/promises';
import path from 'path';
import admin from 'firebase-admin';
import sharp from 'sharp';
import os from 'os';

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
  protein?: number;
  carbs?: number;
  fats?: number;
  healthScore?: number;
  error?: string;
}

// Define the custom user environment for Hono context
export interface UserEnv {
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

// Define collection names
const COLLECTIONS: FirestoreCollections = {
  MEALS: 'meals'
};

// Get environment variables
const CLAUDE_API_KEY: string | undefined = process.env.CLAUDE_API_KEY;
const OPENAI_API_KEY: string | undefined = process.env.OPENAI_API_KEY;

// Helper functions for working with images and files
export function getMimeTypeFromExtension(filePath: string): string {
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

export async function saveUploadedFile(file: File, filename: string): Promise<string> {
  const filePath = path.join('uploads', filename);

  try {
    // With Bun, we can directly use the arrayBuffer() method
    if (typeof file.arrayBuffer === 'function') {
      const buffer = Buffer.from(await file.arrayBuffer());
      await fsPromises.writeFile(filePath, buffer);
      return filePath;
    }

    // Fallback for other environments
    console.log('Using fallback file writing method');
    // @ts-expect-error - file.stream might not be properly typed in all environments
    await fsPromises.writeFile(filePath, file.stream);
    return filePath;
  } catch (error: unknown) {
    console.error('Error saving file:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to save file: ${errorMessage}`);
  }
}

export async function validateImage(filePath: string): Promise<ValidationResult> {
  try {
    const stats = await fsPromises.stat(filePath);
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

export async function processImageForClaude(inputPath: string, originalMimeType: string): Promise<ProcessedImageResult> {
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

// Function to analyze image with Claude AI
export async function analyzeImageWithClaude(imagePath: string, mimeType: string): Promise<ClaudeAnalysisResult> {
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

// Function to analyze image with OpenAI
export async function analyzeImageWithOpenAI(
  imagePath: string, 
  mimeType: string,
  correctionInfo?: { previousResult: string, correctionText: string }
): Promise<ClaudeAnalysisResult> {
  try {
    console.log('Sending image to OpenAI for analysis');
    
    // Check for OpenAI API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('OpenAI API key is missing');
      return {
        success: false,
        error: 'OpenAI API key is missing'
      };
    }
    
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey
    });
    
    // Read the image file
    const imageBuffer = await fsPromises.readFile(imagePath);
    const base64Image = imageBuffer.toString('base64');
    
    // Prepare system message
    const systemMessage = `You are a meal analysis assistant. Analyze the food image and extract the following information:
1. Name of the dish/meal
2. Brief description
3. Estimated calories
4. Estimated macronutrients (protein, carbs, fats in grams)
5. Health score (1-10)

Format your response as a valid JSON object with the following keys:
{
  "name": "string",
  "description": "string",
  "calories": number,
  "protein": number,
  "carbs": number,
  "fats": number,
  "healthScore": number
}`;

    // Prepare user message
    let userPrompt = "Analyze this food image and provide nutritional information.";
    if (correctionInfo) {
      userPrompt = `Previous analysis result: ${correctionInfo.previousResult}\n\nUser correction: ${correctionInfo.correctionText}\n\nPlease reanalyze the food image with this correction in mind.`;
    }
    
    try {
      // Send the API request
      const response = await openai.chat.completions.create({
        model: "gpt-4.5-preview",
        messages: [
          { role: "system", content: systemMessage },
          { 
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`
                }
              }
            ]
          }
        ],
        max_tokens: 800
      });
      
      // Check if we got a valid response
      if (!response.choices || response.choices.length === 0 || !response.choices[0].message.content) {
        return {
          success: false,
          error: "No valid response from OpenAI"
        };
      }
      
      // Parse the response
      const gptResponse = response.choices[0].message.content;
      console.log('OpenAI response received successfully');
      
      // Try to extract and parse JSON
      const jsonMatch = gptResponse.match(/\{[\s\S]*"name"[\s\S]*"description"[\s\S]*"calories"[\s\S]*"protein"[\s\S]*"carbs"[\s\S]*"fats"[\s\S]*"healthScore"[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsedResponse = JSON.parse(jsonMatch[0]);
          
          return {
            success: true,
            name: parsedResponse.name,
            description: parsedResponse.description,
            calories: parseInt(parsedResponse.calories, 10) || 0,
            protein: parseInt(parsedResponse.protein, 10) || 0,
            carbs: parseInt(parsedResponse.carbs, 10) || 0,
            fats: parseInt(parsedResponse.fats, 10) || 0,
            healthScore: parseInt(parsedResponse.healthScore, 10) || 0
          };
        } catch (jsonError) {
          console.error('Failed to parse JSON from OpenAI response:', jsonError);
        }
      }
      
      // Fallback to regex extraction
      const titleMatch = gptResponse.match(/name[:\s]+([^,\n.]+)/i);
      const descriptionMatch = gptResponse.match(/description[:\s]+([^,\n.]+)/i);
      const caloriesMatch = gptResponse.match(/calories[:\s]+(\d+)/i);
      const proteinMatch = gptResponse.match(/protein[:\s]+(\d+)/i);
      const carbsMatch = gptResponse.match(/carbs[:\s]+(\d+)/i);
      const fatsMatch = gptResponse.match(/fats[:\s]+(\d+)/i);
      const healthScoreMatch = gptResponse.match(/health\s*score[:\s]+(\d+)/i);
      
      return {
        success: true,
        name: titleMatch ? titleMatch[1].trim() : "Unknown Food",
        description: descriptionMatch ? descriptionMatch[1].trim() : "No description available",
        calories: caloriesMatch ? parseInt(caloriesMatch[1], 10) : 0,
        protein: proteinMatch ? parseInt(proteinMatch[1], 10) : 0,
        carbs: carbsMatch ? parseInt(carbsMatch[1], 10) : 0,
        fats: fatsMatch ? parseInt(fatsMatch[1], 10) : 0,
        healthScore: healthScoreMatch ? parseInt(healthScoreMatch[1], 10) : 0
      };
    } catch (apiError) {
      console.error('OpenAI API error:', apiError);
      return {
        success: false,
        error: `OpenAI API error: ${apiError instanceof Error ? apiError.message : String(apiError)}`
      };
    }
  } catch (error) {
    console.error('OpenAI analysis error:', error);
    return {
      success: false,
      error: `OpenAI analysis failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

// Check if Firestore is available and initialized
export function getFirestore() {
  let db: FirebaseFirestore.Firestore | undefined;
  let firestoreAvailable: boolean = false;
  try {
    // Get Firestore instance
    db = admin.firestore();
    firestoreAvailable = true;
    return { db, firestoreAvailable };
  } catch (error) {
    console.error('Error getting Firestore:', error);
    console.warn('Running without Firestore. Mock data will be used.');
    return { db: undefined, firestoreAvailable: false };
  }
}

// Route handlers
export const healthCheck = (c: Context<UserEnv>) => c.text('Calorie Tracker API is running');

// CORS OPTIONS handlers
export const corsOptionsHandler = () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
      'Access-Control-Max-Age': '86400'
    }
  });
};

// API route handlers
export const getAllMeals = async (c: Context<UserEnv>) => {
  try {
    const user = c.get('user');
    const userId = user.uid;
    
    const { db, firestoreAvailable } = getFirestore();

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
};

export const getTodaysMeals = async (c: Context<UserEnv>) => {
  try {
    const user = c.get('user');
    const userId = user.uid;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfDay = today.getTime();

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const endOfDay = tomorrow.getTime();

    const { db, firestoreAvailable } = getFirestore();

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
};

export const addMeal = async (c: Context<UserEnv>) => {
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

    const { db, firestoreAvailable } = getFirestore();

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
};

export const deleteMeal = async (c: Context<UserEnv>) => {
  try {
    const user = c.get('user');
    const userId = user.uid;

    const mealId = c.req.param('id');

    const { db, firestoreAvailable } = getFirestore();
    
    if (!firestoreAvailable || !db) {
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
};

export const clearAllMeals = async (c: Context<UserEnv>) => {
  try {
    const user = c.get('user');
    const userId = user.uid;

    const { db, firestoreAvailable } = getFirestore();
    
    if (!firestoreAvailable || !db) {
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
};

export const analyzeImage = async (c: Context<UserEnv>) => {
  try {
    const formData = await c.req.formData();
    const imageFile = formData.get('image') as File | null;

    if (!imageFile) {
      return c.json({ success: false, message: 'No image uploaded' }, 400);
    }

    // Check if API key is available in environment
    if (!OPENAI_API_KEY) {
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

      // Process the image to ensure it's in a compatible format
      const processedImage = await processImageForClaude(originalFilePath, originalMimeType);

      if (!processedImage.success) {
        console.warn(`Image processing warning: ${processedImage.error}. Using original image.`);
      } else {
        processedFilePath = processedImage.path;
      }

      // Use OpenAI to analyze the image
      const result = await analyzeImageWithOpenAI(
        processedImage.success ? processedImage.path : originalFilePath,
        processedImage.success ? processedImage.mimeType : originalMimeType
      );

      if (result.success) {
        // Log the analysis result for debugging
        console.log('Analysis result:', {
          name: result.name,
          calories: result.calories,
          protein: result.protein || 0,
          carbs: result.carbs || 0,
          fats: result.fats || 0,
          healthScore: result.healthScore
        });
        
        return c.json({
          success: true,
          name: result.name,
          description: result.description,
          calories: result.calories,
          protein: result.protein || 0,
          carbs: result.carbs || 0,
          fats: result.fats || 0,
          healthScore: result.healthScore,
          message: "Food analyzed with AI"
        });
      } else {
        // If analysis fails, return error
        console.error('OpenAI analysis failed:', result.error);
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
};

export const analyzeImageStream = async (c: Context<UserEnv>) => {
  try {
    const formData = await c.req.formData();
    const imageFile = formData.get('image') as File | null;

    if (!imageFile) {
      return c.json({ success: false, message: 'No image uploaded' }, 400);
    }

    // Check if API key is available in environment
    if (!OPENAI_API_KEY) {
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
        await stream.write('Sending to OpenAI for analysis...\n');
        const result = await analyzeImageWithOpenAI(
          processedImage.success ? processedImage.path : originalFilePath,
          processedImage.success ? processedImage.mimeType : originalMimeType
        );

        if (result.success) {
          await stream.write(`Analysis complete!\n`);
          await stream.write(`Food: ${result.name}\n`);
          await stream.write(`Description: ${result.description}\n`);
          await stream.write(`Calories: ${result.calories}\n`);
          await stream.write(`Protein: ${result.protein || 0}g\n`);
          await stream.write(`Carbs: ${result.carbs || 0}g\n`);
          await stream.write(`Fats: ${result.fats || 0}g\n`);
          await stream.write(`Health Score: ${result.healthScore}\n`);
          await stream.write(JSON.stringify({
            success: true,
            name: result.name,
            description: result.description,
            calories: result.calories,
            protein: result.protein || 0,
            carbs: result.carbs || 0,
            fats: result.fats || 0,
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
};

// Handler for correcting a meal analysis
export const correctMealAnalysis = async (c: Context<UserEnv>) => {
  try {
    // Get the form data containing the image and correction info
    const formData = await c.req.formData();
    
    // Get the image file
    const imageFile = formData.get('image') as File | null;
    if (!imageFile) {
      return c.json({
        success: false,
        message: 'No image provided'
      }, 400);
    }
    
    // Get correction information
    const previousResult = formData.get('previousResult') as string;
    const correctionText = formData.get('correctionText') as string;
    
    if (!previousResult || !correctionText) {
      return c.json({
        success: false,
        message: 'Previous result and correction text are required'
      }, 400);
    }
    
    // Log the correction request
    console.log('Processing correction request:', {
      previousResult,
      correctionText
    });
    
    // Process the file
    const imageBytes = await imageFile.arrayBuffer();
    const buffer = Buffer.from(imageBytes);
    
    // Save the original file to disk temporarily
    const originalFileFolder = path.join(os.tmpdir(), 'calorie-tracker', 'uploads');
    await fsPromises.mkdir(originalFileFolder, { recursive: true });
    
    const originalFilename = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.image`;
    const originalFilePath = path.join(originalFileFolder, originalFilename);
    await fsPromises.writeFile(originalFilePath, buffer);
    
    // Determine the MIME type
    const originalMimeType = imageFile.type || 'image/jpeg';
    
    // Process the image (resize if necessary)
    const processedImage = await processImageForClaude(originalFilePath, originalMimeType);
    let processedFilePath = originalFilePath;
    
    if (!processedImage.success) {
      console.warn(`Image processing warning: ${processedImage.error}. Using original image.`);
    } else {
      processedFilePath = processedImage.path;
    }
    
    // Use OpenAI to analyze the image with correction context
    const result = await analyzeImageWithOpenAI(
      processedImage.success ? processedImage.path : originalFilePath,
      processedImage.success ? processedImage.mimeType : originalMimeType,
      { previousResult, correctionText }
    );
    
    if (result.success) {
      // Log the corrected analysis result
      console.log('Corrected analysis result:', {
        name: result.name,
        calories: result.calories,
        protein: result.protein || 0,
        carbs: result.carbs || 0,
        fats: result.fats || 0,
        healthScore: result.healthScore
      });
      
      return c.json({
        success: true,
        name: result.name,
        description: result.description,
        calories: result.calories,
        protein: result.protein || 0,
        carbs: result.carbs || 0,
        fats: result.fats || 0,
        healthScore: result.healthScore,
        message: "Food reanalyzed with correction"
      });
    } else {
      // If analysis fails, return error
      console.error('OpenAI correction analysis failed:', result.error);
      return c.json({
        success: false,
        message: 'Failed to analyze corrected image: ' + result.error
      }, 500);
    }
  } catch (error: unknown) {
    console.error('API correction error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({
      success: false,
      message: `API correction error: ${errorMessage}`
    }, 500);
  }
};

// Function to analyze text description with Claude AI
export async function analyzeDescription(c: Context): Promise<Response> {
  try {
    const body = await c.req.json();
    const { description, previousNutritionalInfo } = body;

    console.log('\n=== Text Recognition Request ===');
    console.log('Input description:', description);
    if (previousNutritionalInfo) {
      console.log('Previous nutritional info:', previousNutritionalInfo);
    }

    if (!description) {
      console.log('Error: Description is required');
      return c.json({ 
        success: false, 
        message: 'Description is required' 
      }, 400);
    }

    // Check for OpenAI API key
    if (!OPENAI_API_KEY) {
      console.log('Error: OpenAI API key not set');
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }

    const openai = new OpenAI({
      apiKey: OPENAI_API_KEY
    });

    // Prepare system message with additional context if we have previous nutritional info
    let systemMessage = "You are a nutrition analysis assistant. Always respond with valid JSON only, no explanations or other text.";
    let userMessage = `Analyze this meal description and provide nutritional information. Respond ONLY with a JSON object in this exact format, with no additional text or explanation:
    {
      "name": "Brief name of the meal",
      "description": "Detailed description of the meal",
      "calories": number,
      "protein": number,
      "carbs": number,
      "fats": number,
      "healthScore": number from 1-5
    }
    
    Meal to analyze: "${description}"`;

    // If this is a correction, add the previous nutritional info to the prompt
    if (previousNutritionalInfo) {
      userMessage = `I'm correcting a previous meal analysis. The previous analysis identified the meal as: 
      ${previousNutritionalInfo}
      
      The user is providing this correction: "${description}"
      
      Please analyze this correction and provide COMPLETE updated nutritional information. 
      DO NOT zero out values unless specifically mentioned in the correction.
      If the user doesn't mention specific nutrients, estimate reasonable values based on the correction.
      
      For example, if the user says "This is actually a chocolate cake", provide complete nutritional 
      information for a chocolate cake, not zero values.
      
      Respond ONLY with a JSON object in this exact format, with no additional text or explanation:
      {
        "name": "Brief name of the corrected meal",
        "description": "Detailed description of the corrected meal",
        "calories": number (realistic estimate),
        "protein": number (realistic estimate),
        "carbs": number (realistic estimate),
        "fats": number (realistic estimate),
        "healthScore": number from 1-5 (realistic estimate)
      }`;
    }

    console.log('\nSending request to GPT-4...');
    // First, analyze the description with GPT-4
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: systemMessage
        },
        {
          role: "user",
          content: userMessage
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    console.log('\nGPT-4 Response received:');
    console.log(completion.choices[0].message.content);

    // Parse GPT's response with error handling
    let analysisResult;
    try {
      const responseText = completion.choices[0].message.content?.trim() || '';
      // Try to extract JSON if there's any surrounding text
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.log('Error: No JSON object found in response');
        throw new Error('No JSON object found in response');
      }
      analysisResult = JSON.parse(jsonMatch[0]);
      
      console.log('\nParsed analysis result:');
      console.log(JSON.stringify(analysisResult, null, 2));

      // Validate the required fields
      const requiredFields = ['name', 'description', 'calories', 'protein', 'carbs', 'fats', 'healthScore'];
      for (const field of requiredFields) {
        if (!(field in analysisResult)) {
          console.log(`Error: Missing required field: ${field}`);
          throw new Error(`Missing required field: ${field}`);
        }
      }
    } catch (parseError: unknown) {
      console.error('Error parsing GPT response:', completion.choices[0].message.content);
      throw new Error(`Failed to parse nutrition analysis: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }

    // Skip image generation if this is a correction
    let imageUrl: string = '';
    if (!previousNutritionalInfo) {
      console.log('\nGenerating image with DALL-E...');
      // Generate an image with DALL-E
      const imageResponse = await openai.images.generate({
        model: "dall-e-3",
        prompt: `A photorealistic image of: ${description}. The image should be well-lit, appetizing, and styled like a professional food photograph.`,
        n: 1,
        size: "1024x1024",
        quality: "standard",
        style: "natural"
      });

      console.log('Image URL generated:', imageResponse.data[0].url);
      
      // Download and process the DALL-E generated image
      try {
        const dallEUrl = imageResponse.data[0].url || '';
        if (dallEUrl) {
          console.log('Downloading DALL-E image and creating thumbnail...');
          
          // Fetch the image from DALL-E
          const imageResponse = await fetch(dallEUrl);
          if (!imageResponse.ok) {
            throw new Error(`Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}`);
          }
          
          const imageBuffer = await imageResponse.arrayBuffer();
          
          // Resize and compress the image using Sharp
          // Set max width to 500px to keep file size manageable for Firestore
          const processedBuffer = await sharp(Buffer.from(imageBuffer))
            .resize({ width: 500, withoutEnlargement: true })
            .jpeg({ quality: 80 }) // Use JPEG compression with 80% quality
            .toBuffer();
          
          // Convert to base64 data URL
          const base64Image = processedBuffer.toString('base64');
          const mimeType = 'image/jpeg';
          const dataUrl = `data:${mimeType};base64,${base64Image}`;
          
          // Use the data URL for the meal image
          imageUrl = dataUrl;
          console.log('Image converted to thumbnail data URL successfully');
          
          // For debugging, log the size of the data URL
          const dataSizeKB = Math.round(dataUrl.length / 1024);
          console.log(`Data URL size: ${dataSizeKB} KB (${dataUrl.length} bytes)`);
          
          if (dataUrl.length > 1000000) {
            console.warn('WARNING: Image data URL is approaching Firestore limit (1MB)');
          }
        }
      } catch (imageError) {
        console.error('Error processing DALL-E image:', imageError);
        // Fall back to placeholder image
        imageUrl = '/placeholder.svg';
        console.log('Falling back to placeholder image due to processing error');
      }
    }

    // Combine the analysis and image URL
    const result = {
      success: true,
      name: analysisResult.name,
      description: analysisResult.description,
      calories: analysisResult.calories,
      protein: analysisResult.protein,
      carbs: analysisResult.carbs,
      fats: analysisResult.fats,
      healthScore: analysisResult.healthScore,
      imageUrl: imageUrl
    };

    console.log('\n=== Final Response ===');
    console.log(JSON.stringify(result, null, 2));
    console.log('=====================\n');

    return c.json(result);
  } catch (error) {
    console.error('\nError in analyzeDescription:', error);
    return c.json({ 
      success: false, 
      message: error instanceof Error ? error.message : 'Failed to analyze description' 
    }, 500);
  }
} 