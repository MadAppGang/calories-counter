import { Hono } from 'hono';

declare const app: Hono;
export default app;

// Add setupRoutes function declaration
export function setupRoutes(app: Hono): void;

 