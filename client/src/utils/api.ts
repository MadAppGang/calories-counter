import { Meal, UserSettings } from '../types';
import { getSettings, saveSettings, getMeals, saveMeal } from './storage';

// API Configuration
const API_URL = 'http://localhost:3002/api';

/**
 * API error class for better error handling
 */
export class ApiError extends Error {
  status: number;
  
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Meal API interface
 */
export const MealApi = {
  /**
   * Get all meals
   */
  getAll: async (): Promise<Meal[]> => {
    // Currently this just returns from local storage
    // In a real app, this would fetch from the server
    return getMeals();
  },

  /**
   * Get today's meals
   */
  getToday: (): Meal[] => {
    const meals = getMeals();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return meals.filter(meal => {
      const mealDate = new Date(meal.timestamp);
      mealDate.setHours(0, 0, 0, 0);
      return mealDate.getTime() === today.getTime();
    });
  },

  /**
   * Add a new meal
   */
  add: async (name: string, calories: number, imageUrl: string = '/placeholder.svg'): Promise<Meal> => {
    const newMeal: Meal = {
      id: Date.now().toString(),
      name,
      calories,
      imageUrl,
      timestamp: Date.now()
    };
    
    saveMeal(newMeal);
    return newMeal;
  },

  /**
   * Analyze a meal image and get the food details
   */
  analyzeImage: async (imageFile: File): Promise<{ name: string, calories: number }> => {
    const formData = new FormData();
    formData.append('image', imageFile);
    
    try {
      const response = await fetch(`${API_URL}/analyze-image`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new ApiError('Failed to analyze image', response.status);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new ApiError(data.message || 'Image analysis failed', 400);
      }
      
      return {
        name: data.name,
        calories: data.calories
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Network error', 500);
    }
  },

  /**
   * Get total calories consumed today
   */
  getTodayCalories: (): number => {
    const todayMeals = MealApi.getToday();
    return todayMeals.reduce((total, meal) => total + meal.calories, 0);
  },

  /**
   * Get remaining calories for today
   */
  getRemainingCalories: (): number => {
    const { dailyCalorieTarget } = getSettings();
    const consumedCalories = MealApi.getTodayCalories();
    return dailyCalorieTarget - consumedCalories;
  }
};

/**
 * Settings API interface
 */
export const SettingsApi = {
  /**
   * Get user settings
   */
  get: (): UserSettings => {
    return getSettings();
  },
  
  /**
   * Update user settings
   */
  update: (settings: UserSettings): void => {
    saveSettings(settings);
  },
  
  /**
   * Update daily calorie target
   */
  updateCalorieTarget: (target: number): void => {
    const settings = getSettings();
    settings.dailyCalorieTarget = target;
    saveSettings(settings);
  }
}; 