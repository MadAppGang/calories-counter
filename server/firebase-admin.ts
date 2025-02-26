import admin from 'firebase-admin';
import { config } from 'dotenv';

// Load environment variables
config();

// Initialize Firebase Admin SDK
// Note: In production, you should use a service account
// In this example, we'll use environment variables
try {
  // Check if Firebase Admin SDK is already initialized
  if (!admin.apps.length) {
    // Check if running in Firebase Functions environment
    const isFirebaseFunctions = !!process.env.FUNCTION_TARGET || !!process.env.FIREBASE_CONFIG;
    
    if (isFirebaseFunctions) {
      // In Firebase Functions, use the default credentials
      admin.initializeApp();
      console.log('Firebase Admin SDK initialized with default app credentials');
    } else {
      // For local development, use environment variables
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.PROJECT_ID,
          clientEmail: process.env.CLIENT_EMAIL,
          privateKey: process.env.PRIVATE_KEY?.replace(/\\n/g, '\n')
        })
      });
      console.log('Firebase Admin SDK initialized with service account credentials');
    }
  }
} catch (error: any) {
  console.error('Error initializing Firebase Admin SDK:', error);
}

/**
 * Verifies a Firebase ID token and returns the decoded token
 * @param token The Firebase ID token to verify
 * @returns The decoded token if valid
 * @throws Error if token is missing or invalid
 */
export const verifyToken = async (token: string): Promise<admin.auth.DecodedIdToken> => {
  if (!token) {
    throw new Error('No token provided');
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    return decodedToken;
  } catch (error: any) {
    console.error('Error verifying token:', error);
    throw error;
  }
};

export default admin; 