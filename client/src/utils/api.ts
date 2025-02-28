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
  getMealsByDateRange: async (startDate: Date, endDate: Date): Promise<Meal[]> => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        console.error('No authenticated user found');
        return [];
      }
      
      // Convert dates to timestamps
      const startTimestamp = startDate.getTime();
      const endTimestamp = endDate.getTime();
      
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
};

// Meal analysis functionality - still using the server for Claude AI integration
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