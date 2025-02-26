import 'dart:io';
import 'package:flutter/material.dart';
import '../../models/meal.dart';
import '../../services/api/api_service.dart';

class MealProvider with ChangeNotifier {
  List<Meal> _meals = [];
  bool _isLoading = false;
  String? _error;

  // Getters
  List<Meal> get meals => _meals;
  bool get isLoading => _isLoading;
  String? get error => _error;
  
  // Get today's meals only
  List<Meal> get todayMeals {
    final now = DateTime.now();
    final startOfDay = DateTime(now.year, now.month, now.day).millisecondsSinceEpoch;
    final endOfDay = DateTime(now.year, now.month, now.day, 23, 59, 59).millisecondsSinceEpoch;
    
    return _meals.where((meal) {
      return meal.timestamp >= startOfDay && meal.timestamp <= endOfDay;
    }).toList();
  }
  
  // Get total calories consumed today
  int get todayCalories {
    return todayMeals.fold(0, (sum, meal) => sum + meal.calories);
  }
  
  // Get average health score for today
  double get todayHealthScore {
    if (todayMeals.isEmpty) return 0;
    final total = todayMeals.fold(0, (sum, meal) => sum + meal.healthScore);
    return total / todayMeals.length;
  }

  // Fetch all meals
  Future<void> fetchMeals() async {
    _setLoading(true);
    _clearError();
    
    try {
      final meals = await ApiService.getMeals();
      _meals = meals;
      notifyListeners();
    } catch (e) {
      _setError('Failed to fetch meals: $e');
    } finally {
      _setLoading(false);
    }
  }
  
  // Add a new meal
  Future<void> addMeal({
    required String name,
    String? description,
    required int calories,
    required File imageFile,
    int? healthScore,
  }) async {
    _setLoading(true);
    _clearError();
    
    try {
      final meal = await ApiService.addMeal(
        name: name,
        description: description,
        calories: calories,
        imageFile: imageFile,
      );
      
      _meals.add(meal);
      _sortMeals();
      notifyListeners();
    } catch (e) {
      _setError('Failed to add meal: $e');
    } finally {
      _setLoading(false);
    }
  }
  
  // Delete a meal
  Future<void> deleteMeal(String mealId) async {
    _setLoading(true);
    _clearError();
    
    try {
      await ApiService.deleteMeal(mealId);
      _meals.removeWhere((meal) => meal.id == mealId);
      notifyListeners();
    } catch (e) {
      _setError('Failed to delete meal: $e');
    } finally {
      _setLoading(false);
    }
  }
  
  // Analyze food in an image
  Future<Map<String, dynamic>> analyzeFoodImage(File imageFile) async {
    _setLoading(true);
    _clearError();
    
    try {
      final result = await ApiService.analyzeFood(imageFile);
      return result;
    } catch (e) {
      _setError('Failed to analyze food: $e');
      return {};
    } finally {
      _setLoading(false);
    }
  }
  
  // Helper method to sort meals by timestamp (newest first)
  void _sortMeals() {
    _meals.sort((a, b) => b.timestamp.compareTo(a.timestamp));
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