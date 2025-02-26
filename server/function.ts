import { onRequest, HttpsFunction } from 'firebase-functions/v2/https';
import { defineString } from 'firebase-functions/params';
import { Hono } from 'hono';

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

// Create the Hono app directly in this file
const app = new Hono<UserEnv>();

// Import and apply routes from your server.ts file
import { setupRoutes } from './server.js';
setupRoutes(app);

// Define environment parameters with defaults
const devMode = defineString('DEV_MODE', { default: 'false' });

// Export with proper type annotation to fix linting errors
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