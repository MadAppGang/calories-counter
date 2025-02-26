# Calorie Tracker Flutter App

A calorie tracking mobile application built with Flutter that allows users to track their daily meals, monitor calorie consumption, and analyze their eating habits.

## Features

- **Google Authentication**: Sign in securely with your Google account
- **Meal Tracking**: Add meals with photos, descriptions, and calorie information
- **Food Analysis**: Take pictures of your food for automatic recognition and calorie estimation
- **Dashboard**: View your daily calorie consumption and remaining target
- **Meal History**: Browse through your meal history with images and details
- **Customizable Settings**: Set your daily calorie goals based on your needs

## Setup Instructions

### Prerequisites

- Flutter SDK (version 3.0.0 or higher)
- Dart (version 3.0.0 or higher)
- Firebase account
- Android Studio / VS Code with Flutter extensions

### Firebase Setup

1. Create a new Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Add an Android and/or iOS app to your Firebase project
3. Download the configuration files:
   - For Android: `google-services.json` (place in `android/app/`)
   - For iOS: `GoogleService-Info.plist` (place in `ios/Runner/`)
4. Enable Google Authentication in Firebase Authentication
5. Set up Firebase Storage and Firestore with appropriate security rules

### Project Setup

1. Clone the repository
   ```
   git clone <repository-url>
   cd flutter_app
   ```

2. Install dependencies
   ```
   flutter pub get
   ```

3. Create an assets folder structure
   ```
   mkdir -p assets/icons assets/images
   ```

4. Add Google sign-in assets
   - Download Google logo and place in `assets/icons/google_logo.png`

5. Run the app
   ```
   flutter run
   ```

## API Configuration

The app connects to the same backend API as the web client. Update the base URL in:
- `lib/services/api/api_service.dart`
- `lib/services/api/settings_service.dart`

## Project Structure

```
lib/
├── models/           # Data models
│   ├── auth/         # Authentication models
│   ├── meal.dart     # Meal data model
│   └── user_settings.dart # User settings model
├── providers/        # State management
│   ├── auth/         # Authentication state
│   ├── meal/         # Meal data state
│   └── settings/     # User settings state
├── screens/          # UI screens
│   ├── auth/         # Authentication screens
│   ├── home/         # Dashboard/home screens
│   ├── meal_entry/   # Meal entry screens
│   └── settings/     # Settings screens
├── services/         # API and service integrations
│   ├── api/          # API client services
│   ├── firebase/     # Firebase services
│   └── storage/      # Local storage services
├── utils/            # Utility functions
│   └── helpers/      # Helper functions
├── widgets/          # Reusable UI components
│   ├── auth/         # Authentication widgets
│   ├── common/       # Common widgets
│   └── meal/         # Meal-related widgets
└── main.dart         # App entry point
```

## Development Notes

- The app uses Provider for state management
- Firebase Authentication for user management
- HTTP package for API calls
- Image picker for camera/gallery integration

## License

This project is licensed under the MIT License - see the LICENSE file for details.