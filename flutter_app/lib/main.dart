import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:firebase_core/firebase_core.dart';
import 'dart:io' show Platform;
import 'providers/auth/auth_provider.dart';
import 'providers/meal/meal_provider.dart';
import 'providers/settings/settings_provider.dart';
import 'screens/auth/login_screen.dart';
import 'screens/home/dashboard_screen.dart';
import 'services/firebase/firebase_service.dart';
import 'firebase_options.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize Firebase with the standard approach
  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
    print("Firebase initialized successfully");
  } catch (e) {
    print("Error initializing Firebase: $e");
    // If we're on macOS, we'll show a test screen later
  }

  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    // We'll only show the test screen if we're on macOS AND Firebase failed to initialize
    final bool showMacOSTestScreen = Platform.isMacOS &&
        Firebase.apps.isEmpty; // Check if Firebase failed to initialize

    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => MealProvider()),
        ChangeNotifierProvider(create: (_) => SettingsProvider()),
      ],
      child: MaterialApp(
        title: 'Calorie Tracker',
        theme: ThemeData(
          primarySwatch: Colors.green,
          useMaterial3: true,
          appBarTheme: const AppBarTheme(
            centerTitle: true,
            backgroundColor: Colors.green,
            foregroundColor: Colors.white,
            elevation: 0,
          ),
          elevatedButtonTheme: ElevatedButtonThemeData(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.green,
              foregroundColor: Colors.white,
            ),
          ),
        ),
        home: showMacOSTestScreen
            ? const MacOSTestScreen() // Only show test screen if Firebase failed to initialize on macOS
            : const AuthWrapper(),
        debugShowCheckedModeBanner: false,
      ),
    );
  }
}

// Simple test screen for macOS
class MacOSTestScreen extends StatelessWidget {
  const MacOSTestScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Calorie Tracker (macOS)'),
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: const [
            Text(
              'macOS Test Mode',
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
            ),
            SizedBox(height: 20),
            Text(
              'Firebase initialization is skipped for testing on macOS.',
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

class AuthWrapper extends StatelessWidget {
  const AuthWrapper({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    // Listen to auth state changes
    final authProvider = Provider.of<AuthProvider>(context);

    // Show loading indicator while checking auth state
    if (authProvider.isLoading) {
      return const Scaffold(
        body: Center(
          child: CircularProgressIndicator(),
        ),
      );
    }

    // Navigate to login screen or dashboard based on auth state
    return authProvider.isAuthenticated
        ? const DashboardScreen()
        : const LoginScreen();
  }
}
