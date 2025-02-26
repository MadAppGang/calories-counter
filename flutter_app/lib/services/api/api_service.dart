import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import '../firebase/firebase_service.dart';
import '../../models/meal.dart';

class ApiService {
  // Base URL of your API
  static const String baseUrl = 'http://localhost:3000'; // Replace with your actual API URL
  
  // Get headers with auth token
  static Future<Map<String, String>> _getHeaders() async {
    final token = await FirebaseService.getUserToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ${token ?? ""}',
    };
  }
  
  // Get all meals for the current user
  static Future<List<Meal>> getMeals() async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(
        Uri.parse('$baseUrl/meals'),
        headers: headers,
      );
      
      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        return data.map((json) => Meal.fromJson(json)).toList();
      } else {
        throw Exception('Failed to load meals: ${response.statusCode}');
      }
    } catch (e) {
      print('Error fetching meals: $e');
      rethrow;
    }
  }
  
  // Add a new meal with an image
  static Future<Meal> addMeal({
    required String name,
    String? description,
    required int calories,
    required File imageFile,
  }) async {
    try {
      final token = await FirebaseService.getUserToken();
      final uri = Uri.parse('$baseUrl/meals');
      
      // Create multipart request
      var request = http.MultipartRequest('POST', uri);
      
      // Add auth header
      request.headers['Authorization'] = 'Bearer $token';
      
      // Add text fields
      request.fields['name'] = name;
      if (description != null) request.fields['description'] = description;
      request.fields['calories'] = calories.toString();
      
      // Add file
      final fileExtension = imageFile.path.split('.').last;
      request.files.add(
        await http.MultipartFile.fromPath(
          'image',
          imageFile.path,
          contentType: MediaType('image', fileExtension),
        ),
      );
      
      // Send request
      final streamedResponse = await request.send();
      final response = await http.Response.fromStream(streamedResponse);
      
      if (response.statusCode == 201) {
        return Meal.fromJson(json.decode(response.body));
      } else {
        throw Exception('Failed to add meal: ${response.statusCode}');
      }
    } catch (e) {
      print('Error adding meal: $e');
      rethrow;
    }
  }
  
  // Delete a meal
  static Future<void> deleteMeal(String mealId) async {
    try {
      final headers = await _getHeaders();
      final response = await http.delete(
        Uri.parse('$baseUrl/meals/$mealId'),
        headers: headers,
      );
      
      if (response.statusCode != 200) {
        throw Exception('Failed to delete meal: ${response.statusCode}');
      }
    } catch (e) {
      print('Error deleting meal: $e');
      rethrow;
    }
  }
  
  // Analyze food in an image
  static Future<Map<String, dynamic>> analyzeFood(File imageFile) async {
    try {
      final token = await FirebaseService.getUserToken();
      final uri = Uri.parse('$baseUrl/analyze-food');
      
      // Create multipart request
      var request = http.MultipartRequest('POST', uri);
      
      // Add auth header
      request.headers['Authorization'] = 'Bearer $token';
      
      // Add file
      final fileExtension = imageFile.path.split('.').last;
      request.files.add(
        await http.MultipartFile.fromPath(
          'image',
          imageFile.path,
          contentType: MediaType('image', fileExtension),
        ),
      );
      
      // Send request
      final streamedResponse = await request.send();
      final response = await http.Response.fromStream(streamedResponse);
      
      if (response.statusCode == 200) {
        return json.decode(response.body);
      } else {
        throw Exception('Failed to analyze food: ${response.statusCode}');
      }
    } catch (e) {
      print('Error analyzing food: $e');
      rethrow;
    }
  }
}