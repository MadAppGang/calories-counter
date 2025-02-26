// Load environment variables based on environment
import { config } from 'dotenv';
import admin from 'firebase-admin';
import fs from 'fs';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';

import { authMiddleware, optionalAuthMiddleware } from './auth-middleware.js';

// Import handlers from the shared handlers file
import { 
  UserEnv, 
  healthCheck,
  getAllMeals,
  getTodaysMeals,
  addMeal,
  deleteMeal,
  clearAllMeals,
  analyzeImage,
  analyzeImageStream
} from './handlers.js';



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
try {
  // Get Firestore instance
  db = admin.firestore();

  // Set up Firestore settings
  db.settings({
    ignoreUndefinedProperties: true
  });

  console.log('Firestore initialized successfully');
} catch (error) {
  console.error('Error initializing Firestore:', error);
  console.warn('Running without Firestore. Mock data will be used.');
}

// Log mode information
if (isDevelopmentMode) {
  console.log('🔧 Running in DEVELOPMENT MODE with mock authentication');
  console.log('🔧 Set DEV_MODE=false in .env to use real Firebase authentication');
}



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


// Create Hono app with the custom environment
const app = new Hono<UserEnv>();

// Middleware
app.use('*', logger());
app.use('*', prettyJSON());
app.use('*', cors({
  origin: ['http://localhost:5174', 'https://api-wqgzc5qw7a-ts.a.run.app', 'https://caloriescounter-432de.web.app', '*'],
  allowHeaders: ['Content-Type', 'Authorization', 'Accept'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  exposeHeaders: ['Content-Length', 'Content-Type'],
  maxAge: 86400,
  credentials: true
}));

// API routes
app.get('/', healthCheck);
app.get('/api/meals', authMiddleware, getAllMeals);
app.get('/api/meals/today', authMiddleware, getTodaysMeals);
app.post('/api/meals', authMiddleware, addMeal);
app.delete('/api/meals/:id', authMiddleware, deleteMeal);
app.delete('/api/meals', authMiddleware, clearAllMeals);
app.post('/api/analyze-image', optionalAuthMiddleware, analyzeImage);
app.post('/api/analyze-stream', optionalAuthMiddleware, analyzeImageStream);

// Export the Hono app for use in Firebase Cloud Functions
export default app;

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