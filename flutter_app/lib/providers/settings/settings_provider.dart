import 'package:flutter/material.dart';
import '../../models/user_settings.dart';
import '../../services/api/settings_service.dart';
import '../../services/firebase/firebase_service.dart';

class SettingsProvider with ChangeNotifier {
  UserSettings? _settings;
  bool _isLoading = false;
  String? _error;

  // Getters
  UserSettings? get settings => _settings;
  bool get isLoading => _isLoading;
  String? get error => _error;
  
  // Get daily calorie target with fallback
  int get dailyCalorieTarget {
    return _settings?.dailyCalorieTarget ?? 2000;
  }
  
  // Initialize settings
  Future<void> initSettings() async {
    await fetchSettings();
  }

  // Fetch user settings
  Future<void> fetchSettings() async {
    if (FirebaseService.currentUser == null) {
      _settings = null;
      notifyListeners();
      return;
    }
    
    _setLoading(true);
    _clearError();
    
    try {
      final settings = await SettingsService.getUserSettings();
      _settings = settings;
      notifyListeners();
    } catch (e) {
      _setError('Failed to fetch settings: $e');
      // Set default settings
      _settings = UserSettings.defaultSettings(
        FirebaseService.currentUser?.uid ?? '',
      );
      notifyListeners();
    } finally {
      _setLoading(false);
    }
  }
  
  // Update user settings
  Future<void> updateSettings({
    required int dailyCalorieTarget,
  }) async {
    _setLoading(true);
    _clearError();
    
    try {
      final updatedSettings = await SettingsService.updateSettings(
        dailyCalorieTarget: dailyCalorieTarget,
      );
      
      _settings = updatedSettings;
      notifyListeners();
    } catch (e) {
      _setError('Failed to update settings: $e');
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