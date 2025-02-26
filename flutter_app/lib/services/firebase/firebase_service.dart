import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'dart:io' show Platform;

class FirebaseService {
  static final FirebaseAuth _auth = FirebaseAuth.instance;
  static final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  static final FirebaseStorage _storage = FirebaseStorage.instance;
  static final GoogleSignIn _googleSignIn = _initGoogleSignIn();

  // Initialize GoogleSignIn with the correct configuration based on platform
  static GoogleSignIn _initGoogleSignIn() {
    if (Platform.isMacOS) {
      // Use specific client ID for macOS
      return GoogleSignIn(
        clientId: '188202579094-jre4m5d16bnb0i1ukr1sq6kij2bamnp3.apps.googleusercontent.com',
        scopes: ['email', 'profile'],
        // On macOS, specify the redirect URI for the OAuth flow
        signInOption: SignInOption.standard,
        // Use the authorized redirect URI from your Google Cloud Console
        hostedDomain: '',
      );
    } else {
      // Default configuration for other platforms
      return GoogleSignIn();
    }
  }

  // Getter for auth
  static FirebaseAuth get auth => _auth;
  
  // Getter for firestore
  static FirebaseFirestore get firestore => _firestore;
  
  // Getter for storage
  static FirebaseStorage get storage => _storage;

  // Initialize Firebase
  static Future<void> initializeFirebase() async {
    await Firebase.initializeApp();
    
    // Check if we have a user saved in Firebase auth
    final currentUser = _auth.currentUser;
    if (currentUser != null) {
      print('Firebase: User already signed in: ${currentUser.uid}');
    }
  }

  // Sign in with Google
  static Future<UserCredential?> signInWithGoogle() async {
    try {
      // On macOS, check for existing authentication first
      if (Platform.isMacOS) {
        final currentUser = _auth.currentUser;
        if (currentUser != null) {
          print('Already signed in with user ${currentUser.uid}');
          // Instead of creating a UserCredential, just perform the sign-in again
          // with the existing user's tokens to get a proper UserCredential
          final idToken = await currentUser.getIdToken();
          if (idToken != null) {
            print('Refreshing credentials for existing user');
            // This will refresh the UserCredential without showing sign-in UI
            final credential = GoogleAuthProvider.credential(
              idToken: idToken,
              accessToken: '', // Not needed for refresh
            );
            return await _auth.signInWithCredential(credential);
          }
        }
      }
      
      // Begin Google sign in process
      final GoogleSignInAccount? googleUser = await _googleSignIn.signIn();
      if (googleUser == null) {
        print('Google Sign In: User cancelled the sign-in process');
        return null;
      }

      print('Google Sign In: Successfully signed in with Google account: ${googleUser.email}');

      // Obtain auth details
      final GoogleSignInAuthentication googleAuth = await googleUser.authentication;
      print('Google Sign In: Obtained authentication tokens');
      
      if (googleAuth.accessToken == null || googleAuth.idToken == null) {
        print('Google Sign In Error: Access token or ID token is null');
        return null;
      }
      
      // Create credential
      final OAuthCredential credential = GoogleAuthProvider.credential(
        accessToken: googleAuth.accessToken,
        idToken: googleAuth.idToken,
      );
      print('Google Sign In: Created Firebase credential');

      try {
        // Sign in with Firebase
        final UserCredential userCredential = await _auth.signInWithCredential(credential);
        print('Google Sign In: Successfully signed in with Firebase: ${userCredential.user?.uid}');
        return userCredential;
      } catch (firebaseError) {
        print('Error signing in with Firebase: $firebaseError');
        
        // Special handling for macOS keychain error
        if (Platform.isMacOS && firebaseError.toString().contains('keychain-error')) {
          print('Detected macOS keychain error - manual handling required');
          
          // Store the Google info in a static variable that can be accessed by AuthProvider
          _lastGoogleUser = googleUser;
          _lastGoogleAuth = googleAuth;
          
          // Return null but record that we have a valid Google sign-in
          // The AuthProvider will check _hasValidGoogleSignIn
          _hasValidGoogleSignIn = true;
          return null;
        }
        
        // Re-throw other Firebase errors
        throw firebaseError;
      }
    } catch (e) {
      print('Error signing in with Google: $e');
      return null;
    }
  }

  // For macOS keychain error workaround
  static GoogleSignInAccount? _lastGoogleUser;
  static GoogleSignInAuthentication? _lastGoogleAuth;
  static bool _hasValidGoogleSignIn = false;
  
  // Check if we have a valid Google sign-in (for macOS keychain error workaround)
  static bool get hasValidGoogleSignIn => _hasValidGoogleSignIn;
  
  // Get the last Google user (for macOS keychain error workaround)
  static GoogleSignInAccount? get lastGoogleUser => _lastGoogleUser;
  
  // Reset the Google sign-in state (after it's been handled)
  static void resetGoogleSignInState() {
    _hasValidGoogleSignIn = false;
    _lastGoogleUser = null;
    _lastGoogleAuth = null;
  }

  // Sign out
  static Future<void> signOut() async {
    await _googleSignIn.signOut();
    await _auth.signOut();
  }

  // Get current user
  static User? get currentUser => _auth.currentUser;

  // Get user token
  static Future<String?> getUserToken() async {
    return await _auth.currentUser?.getIdToken();
  }
}