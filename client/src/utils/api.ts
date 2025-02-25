import { Meal } from '../types';
import { getSettings, saveSettings } from './storage';
import { auth } from '../lib/firebase/firebase';

// API Base URL
const API_BASE_URL = 'http://localhost:3002/api';

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
 * Get authentication token for API requests
 */
const getAuthToken = async (): Promise<string | null> => {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return null;
  }
  
  try {
    return await currentUser.getIdToken(true);
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
};

/**
 * Add authentication headers to fetch options
 */
const withAuth = async (options: RequestInit = {}): Promise<RequestInit> => {
  const token = await getAuthToken();
  
  return {
    ...options,
    headers: {
      ...options.headers,
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    }
  };
};

// Settings API - we'll keep settings in localStorage for simplicity
export const SettingsApi = {
  get: getSettings,
  
  updateCalorieTarget: (dailyCalorieTarget: number) => {
    const settings = getSettings();
    saveSettings({
      ...settings,
      dailyCalorieTarget
    });
    return { success: true };
  }
};

// Meals API - now using server endpoints instead of localStorage
export const MealsApi = {
  // Get all meals from the server
  getAll: async (): Promise<Meal[]> => {
    try {
      const options = await withAuth();
      const response = await fetch(`${API_BASE_URL}/meals`, options);
      const data = await response.json();
      
      if (data.success) {
        return data.data;
      } else {
        console.error('Failed to fetch meals:', data.message);
        return [];
      }
    } catch (error) {
      console.error('Error fetching meals:', error);
      return [];
    }
  },
  
  // Get today's meals from the server
  getToday: async (): Promise<Meal[]> => {
    try {
      const options = await withAuth();
      const response = await fetch(`${API_BASE_URL}/meals/today`, options);
      const data = await response.json();
      
      if (data.success) {
        return data.data;
      } else {
        console.error('Failed to fetch today\'s meals:', data.message);
        return [];
      }
    } catch (error) {
      console.error('Error fetching today\'s meals:', error);
      return [];
    }
  },
  
  // Add a new meal to the server
  add: async (meal: Omit<Meal, 'id'>): Promise<{ success: boolean; data?: Meal; message?: string }> => {
    try {
      const options = await withAuth({
        method: 'POST',
        body: JSON.stringify(meal)
      });
      
      const response = await fetch(`${API_BASE_URL}/meals`, options);
      
      return await response.json();
    } catch (error) {
      console.error('Error adding meal:', error);
      return { 
        success: false, 
        message: 'Failed to add meal due to network error' 
      };
    }
  },
  
  // Delete a meal from the server
  delete: async (id: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const options = await withAuth({
        method: 'DELETE'
      });
      
      const response = await fetch(`${API_BASE_URL}/meals/${id}`, options);
      
      return await response.json();
    } catch (error) {
      console.error('Error deleting meal:', error);
      return { 
        success: false, 
        message: 'Failed to delete meal due to network error' 
      };
    }
  },
  
  // Clear all meals (for testing/admin purposes)
  clearAll: async (): Promise<{ success: boolean; message?: string }> => {
    try {
      const options = await withAuth({
        method: 'DELETE'
      });
      
      const response = await fetch(`${API_BASE_URL}/meals`, options);
      
      return await response.json();
    } catch (error) {
      console.error('Error clearing meals:', error);
      return { 
        success: false, 
        message: 'Failed to clear meals due to network error' 
      };
    }
  },
  
  // Calculate today's total calories
  getTodayTotalCalories: async (): Promise<number> => {
    try {
      const todayMeals = await MealsApi.getToday();
      return todayMeals.reduce((total, meal) => total + meal.calories, 0);
    } catch (error) {
      console.error('Error calculating total calories:', error);
      return 0;
    }
  },
  
  // Calculate remaining calories based on daily target
  getRemainingCalories: async (): Promise<number> => {
    const settings = SettingsApi.get();
    const consumedCalories = await MealsApi.getTodayTotalCalories();
    return settings.dailyCalorieTarget - consumedCalories;
  }
};

// Meal analysis functionality
export const MealAnalysisApi = {
  /**
   * Analyze a meal image and get the food details including healthiness score
   */
  analyzeImage: async (imageFile: File): Promise<{ name: string, description: string, calories: number, healthScore: number }> => {
    const formData = new FormData();
    formData.append('image', imageFile);
    
    try {
      const token = await getAuthToken();
      
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`${API_BASE_URL}/analyze-image`, {
        method: 'POST',
        headers,
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
        description: data.description || data.name,
        calories: data.calories,
        healthScore: data.healthScore || 3 // Default to neutral if not provided
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Network error', 500);
    }
  }
}; 