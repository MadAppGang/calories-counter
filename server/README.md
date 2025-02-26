# Calorie Tracker Server

This is the backend server for the Calorie Tracker application. It can run both as a standalone server and as a Firebase Cloud Function.

## Local Development

1. **Install dependencies**
   ```bash
   pnpm install
   ```

2. **Set up environment variables**
   Copy `.env.example` to `.env` and fill in the required values:
   ```bash
   cp .env.example .env
   ```

3. **Run the development server**
   ```bash
   pnpm run dev
   ```

   The server will be available at http://localhost:3002.

## Deploying to Firebase Cloud Functions

1. **Install Firebase CLI**
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**
   ```bash
   firebase login
   ```

3. **Set environment variables on Firebase**
   
   You can set environment variables using the Firebase Functions config:
   
   ```bash
   # Set Claude API Key
   firebase functions:config:set claude.api_key="YOUR_CLAUDE_API_KEY"
   
   # Set Firebase Admin SDK configuration (if not using default credentials)
   firebase functions:config:set firebase.project_id="YOUR_PROJECT_ID"
   firebase functions:config:set firebase.client_email="YOUR_CLIENT_EMAIL"
   firebase functions:config:set firebase.private_key="YOUR_PRIVATE_KEY"
   
   # Set development mode (usually false in production)
   firebase functions:config:set app.dev_mode="false"
   ```
   
   Note: When setting `private_key`, you might need to escape newlines:
   ```bash
   firebase functions:config:set firebase.private_key="$(cat /path/to/private-key.txt)"
   ```
   
   Alternatively, you can set environment variables in the Firebase Console:
   1. Go to the [Firebase Console](https://console.firebase.google.com/) > Your Project > Functions
   2. Click on "Edit" for your function
   3. Scroll down to "Environment variables" section
   4. Add your environment variables there

4. **Build the TypeScript code**
   ```bash
   pnpm run build
   ```

5. **Deploy to Firebase**
   ```bash
   pnpm run deploy
   # or use the Firebase CLI directly:
   firebase deploy --only functions
   ```

## Function Configuration

The Firebase Function is configured in `function.ts`. It uses the Hono app from `server.js` to handle requests. The function is configured with the following settings:

- Memory: 1GB
- Timeout: 300 seconds (5 minutes)
- Min Instances: 0
- Max Instances: 10

## Using Environment Variables in the Function

In the Cloud Function, environment variables are accessed through `process.env`. The server code has been designed to work both locally and in the Cloud Function environment.