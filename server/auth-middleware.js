import { verifyToken } from './firebase-admin.js';

/**
 * Middleware that checks for a valid Firebase ID token in the Authorization header
 * and adds the decoded token to the request object as req.user.
 * 
 * If no token is present or the token is invalid, it returns a 401 error.
 * 
 * @param {import('hono').Context} c - Hono context
 * @param {import('hono').Next} next - Hono next function
 */
export const authMiddleware = async (c, next) => {
  try {
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ success: false, message: 'Unauthorized - No token provided' }, 401);
    }
    
    const token = authHeader.split('Bearer ')[1];
    
    try {
      const decodedToken = await verifyToken(token);
      // Add the decoded token to the request
      c.set('user', decodedToken);
      await next();
    } catch (error) {
      console.error('Error verifying token:', error);
      return c.json({ success: false, message: 'Unauthorized - Invalid token' }, 401);
    }
  } catch (error) {
    console.error('Unexpected error in auth middleware:', error);
    return c.json({ success: false, message: 'Internal server error' }, 500);
  }
};

/**
 * Optional authentication middleware that adds the user to the request if a token is provided,
 * but does not require authentication. Useful for routes that can be accessed with or without auth.
 * 
 * @param {import('hono').Context} c - Hono context
 * @param {import('hono').Next} next - Hono next function
 */
export const optionalAuthMiddleware = async (c, next) => {
  try {
    const authHeader = c.req.header('Authorization');
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1];
      
      try {
        const decodedToken = await verifyToken(token);
        c.set('user', decodedToken);
      } catch (error) {
        console.error('Error verifying token in optional auth:', error);
        // Continue without setting user
      }
    }
    
    await next();
  } catch (error) {
    console.error('Unexpected error in optional auth middleware:', error);
    await next();
  }
}; 