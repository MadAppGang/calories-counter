import { onRequest, HttpsFunction } from 'firebase-functions/v2/https';
import { defineString } from 'firebase-functions/params';
import admin from 'firebase-admin';

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  try {
    // For Firebase Functions, use the default credentials
    if (process.env.FIREBASE_CONFIG) {
      const functionConfig = JSON.parse(process.env.FIREBASE_CONFIG || '{}');
      // If custom config is provided, use it
      if (functionConfig?.project?.id) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: functionConfig.project.id,
            clientEmail: functionConfig.client.email,
            privateKey: functionConfig.private.key?.replace(/\\n/g, '\n')
          })
        });
        console.log('Firebase Admin SDK initialized with service account credentials');
      } else {
        // Otherwise use default app credentials
        admin.initializeApp();
        console.log('Firebase Admin SDK initialized with default app credentials');
      }
    } else {
      // Simple initialization for local dev
      admin.initializeApp();
      console.log('Firebase Admin SDK initialized with default app credentials (local)');
    }
  } catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error);
  }
}

// Create the Hono app
import app from './server.js';
// Define environment parameters with defaults
const devMode = defineString('DEV_MODE', { default: 'false' });

// Export with proper type annotation
export const api: HttpsFunction = onRequest({
  // Function configuration with proper secrets handling
  memory: '1GiB',
  timeoutSeconds: 300,
  minInstances: 0,
  maxInstances: 10,
  region: 'australia-southeast1', // Sydney region
  secrets: []
}, async (request, response) => {
  try {
    // Log the dev mode status
    console.log(`Running in ${devMode.value() === 'true' ? 'development' : 'production'} mode`);
    
    // First convert Firebase request to a web Request that Hono can handle
    const url = new URL(request.url, `https://${request.hostname}`);
    const webRequest = new Request(url.toString(), {
      method: request.method,
      headers: request.headers as HeadersInit,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.rawBody : undefined
    });
    
    // Use app.request() approach with the properly formatted request
    const honoResponse = await app.request(webRequest);
    
    // Set status code from Hono's Response
    response.status(honoResponse.status);
    
    // Copy headers from the Hono Response
    honoResponse.headers.forEach((value, key) => {
      response.set(key, value);
    });
    
    // Read the body and send it in the response
    if (honoResponse.body) {
      const responseBody = await honoResponse.text();
      response.send(responseBody);
    } else {
      response.end();
    }
  } catch (error: unknown) {
    // Handle errors properly
    console.error('Error processing request:', error);
    response.status(500).send(error instanceof Error ? error.toString() : 'Unknown error');
  }
});