import { verifyToken } from './firebase-admin.js';
import { config } from 'dotenv';
import { Context, Next } from 'hono';

// Load environment variables if not in Firebase Functions
if (!process.env.FUNCTION_TARGET && !process.env.FIREBASE_CONFIG) {
  config();
}

// Check if development mode is enabled
const isDevelopmentMode: boolean = process.env.DEV_MODE === 'true';

// Define interface for user's environment in Hono
interface UserEnv {
  Variables: {
    user: {
      uid: string;
      email?: string;
      name?: string;
      picture?: string;
      [key: string]: any;
    }
  }
}

// Auth middleware that requires authentication
export async function authMiddleware(c: Context<UserEnv>, next: Next): Promise<Response | void> {
  try {
    // Skip authentication in development mode if configured to do so
    if (isDevelopmentMode) {
      console.log('🔧 Development mode: Using mock authentication');
      // Use mock user for development
      c.set('user', {
        uid: 'dev-user-123',
        email: 'dev@example.com',
        name: 'Development User',
        picture: '/dev-avatar.png'
      });
      return await next();
    }

    // Get authorization header
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({
        success: false,
        message: 'Unauthorized: No token provided'
      }, 401);
    }

    // Extract the token
    const idToken = authHeader.split('Bearer ')[1];

    // Verify the token
    try {
      const decodedToken = await verifyToken(idToken);
      c.set('user', decodedToken);
      return await next();
    } catch (error: any) {
      console.error('Error verifying token:', error);
      return c.json({
        success: false,
        message: 'Unauthorized: Invalid token'
      }, 401);
    }
  } catch (error: any) {
    console.error('Error in auth middleware:', error);
    return c.json({
      success: false,
      message: 'Internal server error'
    }, 500);
  }
}

// Optional auth middleware - proceeds even without authentication
export async function optionalAuthMiddleware(c: Context<UserEnv>, next: Next): Promise<Response | void> {
  try {
    // Skip authentication in development mode if configured to do so
    if (isDevelopmentMode) {
      console.log('🔧 Development mode: Using mock authentication (optional)');
      // Use mock user for development
      c.set('user', {
        uid: 'dev-user-123',
        email: 'dev@example.com',
        name: 'Development User',
        picture: '/dev-avatar.png'
      });
      return await next();
    }

    // Get authorization header
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token, but that's okay with optional auth
      console.log('No auth token provided (optional auth)');
      return await next();
    }

    // Extract the token
    const idToken = authHeader.split('Bearer ')[1];

    // Verify the token
    try {
      const decodedToken = await verifyToken(idToken);
      c.set('user', decodedToken);
    } catch (error: any) {
      // Invalid token but we continue anyway since auth is optional
      console.warn('Invalid auth token (optional auth):', error.message);
    }
    
    return await next();
  } catch (error: any) {
    console.error('Error in optional auth middleware:', error);
    return c.json({
      success: false,
      message: 'Internal server error'
    }, 500);
  }
} 