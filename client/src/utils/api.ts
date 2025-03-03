import { Meal } from '../types';
import { getSettings, saveSettings } from './storage';
import { 
  auth, 
  db, 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  doc, 
  addDoc, 
  deleteDoc, 
  COLLECTIONS,
} from '../lib/firebase/firebase';

// Define Vite environment module augmentation
/// <reference types="vite/client" />

// Get API Base URL from Vite environment variables with fallback
// @ts-expect-error: Vite specific type
const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || 'http://localhost:3002/api';

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

// Firestore types for better type safety
interface FirestoreTimestamp {
  toMillis: () => number;
}

interface FirestoreDocData {
  name?: string;
  description?: string;
  calories?: number;
  protein?: number; // Protein in grams
  carbs?: number;   // Carbs in grams
  fats?: number;    // Fats in grams
  imageUrl?: string;
  timestamp?: number | FirestoreTimestamp;
  healthScore?: number;
  time?: string;
  [key: string]: unknown; // Allow for other properties
}

interface FirestoreDoc {
  id: string;
  data: () => FirestoreDocData;
}

/**
 * Converts Firestore data to a Meal object
 */
const convertToMeal = (doc: FirestoreDoc): Meal => {
  const data = doc.data();
  
  // Handle Firestore timestamp conversion
  let timestamp = data.timestamp;
  if (timestamp && typeof timestamp === 'object' && 'toMillis' in timestamp) {
    timestamp = timestamp.toMillis();
  }
  
  return {
    id: doc.id,
    name: data.name || '',
    description: data.description || '',
    calories: data.calories || 0,
    protein: data.protein || 0,
    carbs: data.carbs || 0,
    fats: data.fats || 0,
    imageUrl: data.imageUrl || '/placeholder.svg',
    timestamp: timestamp as number || Date.now(),
    healthScore: data.healthScore || 0,
    time: data.time || ''
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
  },

  updateMacroTargets: (proteinTarget: number, carbsTarget: number, fatsTarget: number) => {
    const settings = getSettings();
    saveSettings({
      ...settings,
      proteinTarget,
      carbsTarget,
      fatsTarget
    });
    return { success: true };
  },

  updateAllTargets: (dailyCalorieTarget: number, proteinTarget: number, carbsTarget: number, fatsTarget: number) => {
    saveSettings({
      dailyCalorieTarget,
      proteinTarget,
      carbsTarget,
      fatsTarget
    });
    return { success: true };
  }
};

// Meals API - now using Firestore directly
export const MealsApi = {
  // Get all meals from Firestore
  getAll: async (): Promise<Meal[]> => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.error('No authenticated user found');
        return [];
      }
      
      const mealsCollection = collection(db, COLLECTIONS.MEALS);
      const mealsQuery = query(
        mealsCollection,
        where('userId', '==', currentUser.uid),
        orderBy('timestamp', 'desc')
      );
      
      const querySnapshot = await getDocs(mealsQuery);
      
      const meals: Meal[] = [];
      querySnapshot.forEach((doc) => {
        meals.push(convertToMeal(doc));
      });
      
      return meals;
    } catch (error) {
      console.error('Error fetching meals from Firestore:', error);
      return [];
    }
  },
  
  // Get today's meals from Firestore
  getToday: async (): Promise<Meal[]> => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.error('No authenticated user found');
        return [];
      }
      
      // Calculate start of day and end of day timestamps
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startOfDay = today.getTime();
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const endOfDay = tomorrow.getTime();
      
      const mealsCollection = collection(db, COLLECTIONS.MEALS);
      const mealsQuery = query(
        mealsCollection,
        where('userId', '==', currentUser.uid),
        where('timestamp', '>=', startOfDay),
        where('timestamp', '<', endOfDay),
        orderBy('timestamp', 'desc')
      );
      
      const querySnapshot = await getDocs(mealsQuery);
      
      const meals: Meal[] = [];
      querySnapshot.forEach((doc) => {
        meals.push(convertToMeal(doc));
      });
      
      return meals;
    } catch (error) {
      console.error('Error fetching today\'s meals from Firestore:', error);
      return [];
    }
  },
  
  // Add a new meal to Firestore
  add: async (meal: Omit<Meal, 'id'>): Promise<{ success: boolean; data?: Meal; message?: string }> => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        return { 
          success: false, 
          message: 'No authenticated user found' 
        };
      }
      
      // Ensure the meal has a timestamp if not already set
      if (!meal.timestamp) {
        meal.timestamp = Date.now();
      }
      
      // Prepare the meal data with user ID
      const mealData = {
        ...meal,
        userId: currentUser.uid,
        // If imageUrl is not set, use a placeholder
        imageUrl: meal.imageUrl || '/placeholder.svg'
      };
      
      // Add the meal to Firestore
      const mealsCollection = collection(db, COLLECTIONS.MEALS);
      const docRef = await addDoc(mealsCollection, mealData);
      
      // Construct the meal with ID
      const newMeal: Meal = {
        id: docRef.id,
        ...mealData
      } as Meal;
      
      return {
        success: true,
        data: newMeal
      };
    } catch (error) {
      console.error('Error adding meal to Firestore:', error);
      return { 
        success: false, 
        message: 'Failed to add meal to Firestore' 
      };
    }
  },
  
  // Delete a meal from Firestore
  delete: async (id: string): Promise<{ success: boolean; message?: string }> => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        return { 
          success: false, 
          message: 'No authenticated user found' 
        };
      }
      
      // Delete the meal from Firestore
      const mealRef = doc(db, COLLECTIONS.MEALS, id);
      await deleteDoc(mealRef);
      
      return {
        success: true,
        message: 'Meal deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting meal from Firestore:', error);
      return { 
        success: false, 
        message: 'Failed to delete meal from Firestore' 
      };
    }
  },
  
  // Clear all meals (for testing/admin purposes)
  clearAll: async (): Promise<{ success: boolean; message?: string }> => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        return { 
          success: false, 
          message: 'No authenticated user found' 
        };
      }
      
      // Get all meals for the current user
      const meals = await MealsApi.getAll();
      
      // Delete each meal
      const deletionPromises = meals.map(meal => MealsApi.delete(meal.id));
      await Promise.all(deletionPromises);
      
      return {
        success: true,
        message: 'All meals cleared successfully'
      };
    } catch (error) {
      console.error('Error clearing meals from Firestore:', error);
      return { 
        success: false, 
        message: 'Failed to clear meals from Firestore' 
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
  },
  
  // Get meals for a date range (for calendar view)
  getMealsByDateRange: async (startDate: Date | number, endDate: Date | number): Promise<Meal[]> => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.error('No authenticated user found');
        return [];
      }
      
      // Convert input parameters to timestamps if they're Date objects
      const startTimestamp = startDate instanceof Date ? startDate.getTime() : startDate;
      const endTimestamp = endDate instanceof Date ? endDate.getTime() : endDate;
      
      try {
        // First try with the compound query (requires index)
        const mealsCollection = collection(db, COLLECTIONS.MEALS);
        const mealsQuery = query(
          mealsCollection,
          where('userId', '==', currentUser.uid),
          where('timestamp', '>=', startTimestamp),
          where('timestamp', '<', endTimestamp),
          orderBy('timestamp', 'asc')
        );
        
        const querySnapshot = await getDocs(mealsQuery);
        
        const meals: Meal[] = [];
        querySnapshot.forEach((doc) => {
          meals.push(convertToMeal(doc));
        });
        
        return meals;
      } catch (indexError) {
        // If we get an index error, fallback to a simpler approach
        console.warn('Index not ready, using fallback query method:', indexError);
        
        // Get all user's meals and filter client-side
        const mealsCollection = collection(db, COLLECTIONS.MEALS);
        const simpleQuery = query(
          mealsCollection,
          where('userId', '==', currentUser.uid)
        );
        
        const querySnapshot = await getDocs(simpleQuery);
        
        const meals: Meal[] = [];
        querySnapshot.forEach((doc) => {
          const meal = convertToMeal(doc);
          // Filter by timestamp client-side
          if (meal.timestamp >= startTimestamp && meal.timestamp < endTimestamp) {
            meals.push(meal);
          }
        });
        
        // Sort by timestamp (ascending) client-side
        meals.sort((a, b) => a.timestamp - b.timestamp);
        
        return meals;
      }
    } catch (error) {
      console.error('Error fetching meals for date range from Firestore:', error);
      return [];
    }
  },
  
  // Get daily total calories for a specific date
  getDailyTotalCalories: async (date: Date): Promise<number> => {
    try {
      // Calculate start and end of the specific day
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);
      
      // Get meals for this day
      const mealsForDay = await MealsApi.getMealsByDateRange(startOfDay, endOfDay);
      
      // Sum up calories
      return mealsForDay.reduce((total, meal) => total + meal.calories, 0);
    } catch (error) {
      console.error('Error calculating daily total calories:', error);
      return 0;
    }
  },

  // Get daily total macronutrients for a specific date
  getDailyMacros: async (date: Date = new Date()): Promise<{ protein: number, carbs: number, fats: number }> => {
    try {
      // Calculate start and end of day timestamps for the specified date
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(startOfDay);
      endOfDay.setDate(endOfDay.getDate() + 1);
      
      // Get all meals for the specified day - pass Date objects
      const meals = await MealsApi.getMealsByDateRange(startOfDay, endOfDay);
      
      // Calculate total macros
      const macros = meals.reduce((totals, meal) => {
        return {
          protein: totals.protein + (meal.protein || 0),
          carbs: totals.carbs + (meal.carbs || 0),
          fats: totals.fats + (meal.fats || 0)
        };
      }, { protein: 0, carbs: 0, fats: 0 });
      
      return macros;
    } catch (error) {
      console.error('Error getting daily macros:', error);
      return { protein: 0, carbs: 0, fats: 0 };
    }
  },
  
  // Get remaining macronutrients based on daily targets
  getRemainingMacros: async (): Promise<{protein: number, carbs: number, fats: number}> => {
    const settings = SettingsApi.get();
    const consumedMacros = await MealsApi.getDailyMacros(new Date());
    
    return {
      protein: (settings.proteinTarget || 0) - consumedMacros.protein,
      carbs: (settings.carbsTarget || 0) - consumedMacros.carbs,
      fats: (settings.fatsTarget || 0) - consumedMacros.fats,
    };
  },
};

// Meal analysis functionality - still using the server for Claude AI integration
export const MealAnalysisApi = {
  /**
   * Analyze a meal image and get the food details including healthiness score
   */
  analyzeImage: async (imageFile: File): Promise<{ 
    name: string, 
    description: string, 
    calories: number, 
    protein: number, 
    carbs: number, 
    fats: number,
    healthScore: number 
  }> => {
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
      console.log('Raw API response:', data); // Add logging for debugging
      
      if (!data.success) {
        throw new ApiError(data.message || 'Image analysis failed', 400);
      }
      
      // Ensure all values are properly parsed as numbers
      const result = {
        name: data.name,
        description: data.description || data.name,
        calories: Number(data.calories) || 0,
        // Include macronutrients with defaults if not provided
        protein: Number(data.protein) || 0,
        carbs: Number(data.carbs) || 0,
        fats: Number(data.fats) || 0,
        healthScore: Number(data.healthScore) || 3 // Default to neutral if not provided
      };
      
      console.log('Processed analysis result:', result); // Add logging for debugging
      return result;
    } catch (error) {
      console.error('Error in analyzeImage:', error); // Add more detailed error logging
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Network error', 500);
    }
  },

  /**
   * Correct a meal analysis with user feedback
   */
  correctMealAnalysis: async (
    imageFile: File, 
    previousResult: string, 
    correctionText: string
  ): Promise<{ 
    name: string, 
    description: string, 
    calories: number, 
    protein: number, 
    carbs: number, 
    fats: number,
    healthScore: number 
  }> => {
    const formData = new FormData();
    formData.append('image', imageFile);
    formData.append('previousResult', previousResult);
    formData.append('correctionText', correctionText);
    
    try {
      const token = await getAuthToken();
      
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      console.log('Sending correction request:', { previousResult, correctionText });
      
      const response = await fetch(`${API_BASE_URL}/correct-meal`, {
        method: 'POST',
        headers,
        body: formData,
      });
      
      if (!response.ok) {
        throw new ApiError('Failed to process meal correction', response.status);
      }
      
      const data = await response.json();
      console.log('Correction API response:', data);
      
      if (!data.success) {
        throw new ApiError(data.message || 'Meal correction failed', 400);
      }
      
      // Ensure all values are properly parsed as numbers
      const result = {
        name: data.name,
        description: data.description || data.name,
        calories: Number(data.calories) || 0,
        protein: Number(data.protein) || 0,
        carbs: Number(data.carbs) || 0,
        fats: Number(data.fats) || 0,
        healthScore: Number(data.healthScore) || 3
      };
      
      console.log('Processed correction result:', result);
      return result;
    } catch (error) {
      console.error('Error in correctMealAnalysis:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Network error', 500);
    }
  },
  
  analyzeDescription: async (description: string, previousNutritionalInfo?: string): Promise<{ 
    name: string, 
    description: string, 
    calories: number, 
    protein: number, 
    carbs: number, 
    fats: number,
    healthScore: number,
    imageUrl?: string
  }> => {
    try {
      const token = await getAuthToken();
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const body = previousNutritionalInfo 
        ? { description, previousNutritionalInfo } 
        : { description };

      const response = await fetch(`${API_BASE_URL}/analyze-description`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      
      if (!response.ok) {
        throw new ApiError('Failed to analyze description', response.status);
      }
      
      const data = await response.json();
      console.log('Raw API response:', data);
      
      if (!data.success) {
        throw new ApiError(data.message || 'Description analysis failed', 400);
      }
      
      // Ensure all values are properly parsed as numbers
      const result = {
        name: data.name,
        description: data.description || data.name,
        calories: Number(data.calories) || 0,
        protein: Number(data.protein) || 0,
        carbs: Number(data.carbs) || 0,
        fats: Number(data.fats) || 0,
        healthScore: Number(data.healthScore) || 3,
        imageUrl: data.imageUrl
      };
      
      console.log('Processed analysis result:', result);
      return result;
    } catch (error) {
      console.error('Error in analyzeDescription:', error);
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Network error', 500);
    }
  },
}; 