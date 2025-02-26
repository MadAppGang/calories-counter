import 'dart:convert';
import 'package:http/http.dart' as http;
import '../firebase/firebase_service.dart';
import '../../models/user_settings.dart';

class SettingsService {
  static const String baseUrl = 'http://localhost:3000'; // Replace with your actual API URL
  
  // Get headers with auth token
  static Future<Map<String, String>> _getHeaders() async {
    final token = await FirebaseService.getUserToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ${token ?? ""}',
    };
  }
  
  // Get user settings
  static Future<UserSettings> getUserSettings() async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/settings'),
        headers: headers,
      );
      
      if (response.statusCode == 200) {
        return UserSettings.fromJson(json.decode(response.body));
      } else if (response.statusCode == 404) {
        // If settings don't exist yet, return default
        return UserSettings.defaultSettings(
          FirebaseService.currentUser?.uid ?? '',
        );
      } else {
        throw Exception('Failed to load settings: ${response.statusCode}');
      }
    } catch (e) {
      print('Error fetching settings: $e');
      // Return default settings if there's an error
      return UserSettings.defaultSettings(
        FirebaseService.currentUser?.uid ?? '',
      );
    }
  }
  
  // Update user settings
  static Future<UserSettings> updateSettings({
    required int dailyCalorieTarget,
  }) async {
    try {
      final headers = await _getHeaders();
      final userId = FirebaseService.currentUser?.uid;
      
      if (userId == null) {
        throw Exception('User not authenticated');
      }
      
      final body = json.encode({
        'dailyCalorieTarget': dailyCalorieTarget,
        'userId': userId,
      });
      
      final response = await http.put(
        Uri.parse('$baseUrl/settings'),
        headers: headers,
        body: body,
      );
      
      if (response.statusCode == 200) {
        return UserSettings.fromJson(json.decode(response.body));
      } else {
        throw Exception('Failed to update settings: ${response.statusCode}');
      }
    } catch (e) {
      print('Error updating settings: $e');
      rethrow;
    }
  }
}