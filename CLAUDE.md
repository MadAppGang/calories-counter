# CLAUDE.md - Calorie Tracker App

## Build & Run Commands
- `pnpm install` - Install dependencies
- `pnpm run dev` - Run client development server
- `cd client && pnpm run dev` - Run client independently 
- `cd server && pnpm run dev` - Run server with auto-reload
- `pnpm run build` - Build the application
- `pnpm run lint` - Run ESLint to check code quality

## Code Style Guidelines
- **Imports**: Group by external libraries first, then internal modules. Sort alphabetically.
- **Components**: Use functional components with named exports. Include JSDoc comments for props.
- **Types**: Declare explicit types/interfaces in `types.ts`. Prefer interfaces for objects.
- **Error Handling**: Use try/catch with specific error messages. Log errors in console.
- **Naming**: camelCase for variables/functions, PascalCase for components, ALL_CAPS for constants.
- **Formatting**: 2-space indentation, semicolons required, 80-char line limit when possible.
- **State Management**: Use React hooks for local state, context for shared state.
- **API Calls**: Centralize in `utils/api.ts`. Handle errors gracefully with ApiError class.
- **Authentication**: Use Firebase auth with token-based API requests.