import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'dart:io' show Platform;
import 'package:firebase_auth/firebase_auth.dart' as firebase_auth;
import '../../providers/auth/auth_provider.dart';
import '../../services/firebase/firebase_service.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  String? debugInfo;
  bool _checkingAuth = false;

  // Helper method to manually check auth state
  Future<void> _checkAuthState(BuildContext context) async {
    if (!mounted) return;
    
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    
    setState(() {
      _checkingAuth = true;
      debugInfo = "Checking authentication state...";
    });
    
    try {
      // Check if Firebase thinks we're authenticated
      final currentUser = firebase_auth.FirebaseAuth.instance.currentUser;
      
      if (!mounted) return;
      
      if (currentUser != null) {
        setState(() {
          debugInfo = "Found authenticated user: ${currentUser.uid}\nEmail: ${currentUser.email}";
        });
        
        // Force auth provider to update
        await Future.delayed(const Duration(milliseconds: 500));
        if (mounted) {
          Provider.of<AuthProvider>(context, listen: false).forceCheckCurrentUser();
        }
      } else {
        setState(() {
          debugInfo = "No authenticated user found";
        });
      }
    } catch (e) {
      if (!mounted) return;
      
      setState(() {
        debugInfo = "Error checking auth state: $e";
      });
    } finally {
      if (!mounted) return;
      
      setState(() {
        _checkingAuth = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // App logo
                const Icon(
                  Icons.restaurant_menu,
                  size: 100,
                  color: Colors.green,
                ),
                
                const SizedBox(height: 32),
                
                // App title
                const Text(
                  'Calorie Tracker',
                  style: TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                
                const SizedBox(height: 16),
                
                // App description
                const Text(
                  'Track your meals and monitor your calorie intake',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 16,
                    color: Colors.grey,
                  ),
                ),
                
                const SizedBox(height: 48),
                
                // Google Sign In button
                ElevatedButton.icon(
                  onPressed: authProvider.isLoading || _checkingAuth
                    ? null 
                    : () async {
                        if (!mounted) return;
                        setState(() {
                          debugInfo = "Starting Google sign-in...";
                        });
                        
                        final success = await authProvider.signInWithGoogle();
                        
                        // Always check if the widget is still mounted before calling setState
                        if (!mounted) return;
                        
                        if (!success) {
                          setState(() {
                            debugInfo = "Google sign-in failed: ${authProvider.error}";
                          });
                          
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text(authProvider.error ?? 'Failed to sign in'),
                              backgroundColor: Colors.red,
                            ),
                          );
                        } else {
                          setState(() {
                            debugInfo = "Google sign-in reported success!";
                          });
                          
                          // For macOS, manually check auth state
                          if (Platform.isMacOS && mounted) {
                            await _checkAuthState(context);
                          }
                        }
                      },
                  icon: Image.asset(
                    'assets/icons/google_logo.png',
                    height: 24,
                  ),
                  label: const Text(
                    'Sign in with Google',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 32,
                      vertical: 12,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(30),
                    ),
                  ),
                ),
                
                const SizedBox(height: 16),
                
                // Loading indicators
                if (authProvider.isLoading || _checkingAuth)
                  const CircularProgressIndicator(),
                
                // Error message
                if (authProvider.error != null && !authProvider.isLoading)
                  Padding(
                    padding: const EdgeInsets.only(top: 16),
                    child: Text(
                      authProvider.error!,
                      style: const TextStyle(
                        color: Colors.red,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),
                  
                // Debug info (only on macOS)
                if (Platform.isMacOS && debugInfo != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 16),
                    child: Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.grey[200],
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Column(
                        children: [
                          const Text(
                            'Debug Info:',
                            style: TextStyle(fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            debugInfo!,
                            style: const TextStyle(fontSize: 12),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    ),
                  ),
                  
                // Manual check button (only on macOS)
                if (Platform.isMacOS)
                  Padding(
                    padding: const EdgeInsets.only(top: 16),
                    child: TextButton(
                      onPressed: _checkingAuth ? null : () => _checkAuthState(context),
                      child: const Text('Check Auth State'),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}