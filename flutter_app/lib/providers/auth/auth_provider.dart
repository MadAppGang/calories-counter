import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'dart:io' show Platform;
import '../../models/auth/user_model.dart';
import '../../services/firebase/firebase_service.dart';

class AuthProvider with ChangeNotifier {
  User? _firebaseUser;
  UserModel? _user;
  bool _isLoading = false;
  String? _error;
  // Flag to handle macOS keychain workaround
  bool _hasMacOSKeychainWorkaround = false;

  AuthProvider() {
    _initAuthListener();
    _checkCurrentUser(); // Immediately check for current user
  }

  // Getters
  User? get firebaseUser => _firebaseUser;
  UserModel? get user => _user;
  bool get isLoading => _isLoading;
  // For macOS keychain workaround, consider the user authenticated if we have the workaround flag
  bool get isAuthenticated => _firebaseUser != null || _hasMacOSKeychainWorkaround;
  String? get error => _error;

  // Initialize auth state listener
  void _initAuthListener() {
    FirebaseService.auth.authStateChanges().listen((User? firebaseUser) {
      print("Auth state changed: User is ${firebaseUser != null ? 'signed in' : 'signed out'}");
      _updateUser(firebaseUser);
    });
  }
  
  // Public method to force check for current user
  Future<void> forceCheckCurrentUser() async {
    await _checkCurrentUser();
  }

  // Check if there's a current user
  Future<void> _checkCurrentUser() async {
    final currentUser = FirebaseService.currentUser;
    if (currentUser != null && _firebaseUser == null) {
      print("Found current user that wasn't in state: ${currentUser.uid}");
      _updateUser(currentUser);
    }
    
    // Check for macOS keychain workaround state
    if (Platform.isMacOS && 
        FirebaseService.hasValidGoogleSignIn && 
        FirebaseService.lastGoogleUser != null) {
      _handleMacOSKeychainWorkaround();
    }
  }
  
  // Handle macOS keychain workaround
  void _handleMacOSKeychainWorkaround() {
    final googleUser = FirebaseService.lastGoogleUser;
    if (googleUser != null) {
      print("Using macOS keychain workaround for user: ${googleUser.email}");
      
      // Create a manual user model
      _user = UserModel(
        uid: googleUser.id,
        email: googleUser.email,
        displayName: googleUser.displayName,
        photoURL: googleUser.photoUrl,
      );
      
      // Set workaround flag
      _hasMacOSKeychainWorkaround = true;
      
      // Reset the FirebaseService workaround state so we don't reuse it
      FirebaseService.resetGoogleSignInState();
      
      // Notify listeners to update UI
      notifyListeners();
    }
  }
  
  // Update user state
  void _updateUser(User? firebaseUser) {
    _firebaseUser = firebaseUser;
    
    if (firebaseUser != null) {
      _user = UserModel(
        uid: firebaseUser.uid,
        email: firebaseUser.email ?? '',
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
      );
      print("User updated: ${_user?.displayName} (${_user?.email})");
    } else if (!_hasMacOSKeychainWorkaround) {
      // Only clear user if we don't have a macOS workaround active
      _user = null;
      print("User cleared from state");
    }
    
    notifyListeners();
  }

  // Sign in with Google
  Future<bool> signInWithGoogle() async {
    _setLoading(true);
    _clearError();
    
    try {
      final result = await FirebaseService.signInWithGoogle();
      
      if (result != null) {
        print("Google sign-in successful: ${result.user?.uid}");
        
        // Force update the user state
        _updateUser(result.user);
        
        // Double-check current user
        await Future.delayed(const Duration(milliseconds: 500));
        await _checkCurrentUser();
        
        _setLoading(false);
        return true;
      } else {
        // Check for macOS keychain error workaround
        if (Platform.isMacOS && FirebaseService.hasValidGoogleSignIn) {
          print("Google sign-in successful via macOS workaround");
          _handleMacOSKeychainWorkaround();
          _setLoading(false);
          return true;
        }
        
        print("Google sign-in failed: No UserCredential returned");
        _setError('Failed to sign in with Google');
        _setLoading(false);
        return false;
      }
    } catch (e) {
      print("Google sign-in exception: $e");
      _setError('Failed to sign in with Google: $e');
      _setLoading(false);
      return false;
    }
  }

  // Sign out
  Future<void> signOut() async {
    _setLoading(true);
    _clearError();
    
    try {
      // Clear the macOS workaround state if active
      if (_hasMacOSKeychainWorkaround) {
        _hasMacOSKeychainWorkaround = false;
      }
      
      await FirebaseService.signOut();
      // Force update after sign out
      _updateUser(null);
    } catch (e) {
      _setError('Failed to sign out: $e');
    } finally {
      _setLoading(false);
    }
  }

  // Helper methods
  void _setLoading(bool value) {
    _isLoading = value;
    notifyListeners();
  }

  void _setError(String? error) {
    _error = error;
    notifyListeners();
  }

  void _clearError() {
    _error = null;
    notifyListeners();
  }
}