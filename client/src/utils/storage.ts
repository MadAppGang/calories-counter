import { Meal, UserSettings } from '../types';

const MEALS_STORAGE_KEY = 'calorieTracker_meals';
const SETTINGS_STORAGE_KEY = 'calorieTracker_settings';
const MAX_MEALS_TO_KEEP = 50; // Maximum number of meals to store

// Settings functions
export const getSettings = (): UserSettings => {
  const settings = localStorage.getItem(SETTINGS_STORAGE_KEY);
  return settings ? JSON.parse(settings) : { 
    dailyCalorieTarget: 2000
  };
};

export const saveSettings = (settings: UserSettings): void => {
  localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
};

// Storage management function
export const cleanupOldMeals = (meals: Meal[]): Meal[] => {
  // If we have too many meals, remove the oldest ones
  if (meals.length > MAX_MEALS_TO_KEEP) {
    console.log(`Cleaning up old meals: ${meals.length} → ${MAX_MEALS_TO_KEEP}`);
    // Sort by timestamp (newest first) and keep only the most recent MAX_MEALS_TO_KEEP
    return meals
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, MAX_MEALS_TO_KEEP);
  }
  return meals;
};

// Calculate approx size of data in localStorage
export const getLocalStorageUsage = (): { used: number, max: number, percentage: number } => {
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      const value = localStorage.getItem(key) || '';
      total += key.length + value.length;
    }
  }
  
  // Convert to MB (rough approximation)
  const usedMB = total / (1024 * 1024);
  // Most browsers have ~5MB limit
  const maxMB = 5;
  const percentage = (usedMB / maxMB) * 100;
  
  return {
    used: usedMB,
    max: maxMB,
    percentage
  };
};

// Meal functions
export const getMeals = (): Meal[] => {
  const meals = localStorage.getItem(MEALS_STORAGE_KEY);
  return meals ? JSON.parse(meals) : [];
};

export const saveMeal = (meal: Meal): void => {
  try {
    const meals = getMeals();
    
    // Add the new meal
    meals.push(meal);
    
    // Cleanup old meals if needed
    const cleanedMeals = cleanupOldMeals(meals);
    
    // Check storage usage
    const usage = getLocalStorageUsage();
    console.log(`LocalStorage usage: ${usage.used.toFixed(2)}MB / ${usage.max}MB (${usage.percentage.toFixed(1)}%)`);
    
    // Save the cleaned up meals list
    localStorage.setItem(MEALS_STORAGE_KEY, JSON.stringify(cleanedMeals));
  } catch (error) {
    console.error('Error saving meal to localStorage:', error);
    throw new Error('Failed to save meal due to storage constraints');
  }
};

export const getTodayMeals = (): Meal[] => {
  const meals = getMeals();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return meals.filter(meal => {
    const mealDate = new Date(meal.timestamp);
    mealDate.setHours(0, 0, 0, 0);
    return mealDate.getTime() === today.getTime();
  });
};

export const getTodayCalories = (): number => {
  const todayMeals = getTodayMeals();
  return todayMeals.reduce((total, meal) => total + meal.calories, 0);
};

export const getRemainingCalories = (): number => {
  const { dailyCalorieTarget } = getSettings();
  const consumedCalories = getTodayCalories();
  return dailyCalorieTarget - consumedCalories;
};

// Function to clean up any existing oversized data
export const cleanupStorageIfNeeded = (): void => {
  try {
    // Check current storage usage
    const usage = getLocalStorageUsage();
    
    // If we're using more than 80% of available storage, take action
    if (usage.percentage > 80) {
      console.log(`Storage usage high (${usage.percentage.toFixed(1)}%), cleaning up...`);
      
      // Get current meals and optimize them
      const meals = getMeals();
      
      // First, clean up by keeping only recent meals
      let cleanedMeals = cleanupOldMeals(meals);
      
      // If we have meals with full-sized images, downsize them
      cleanedMeals = cleanedMeals.map(meal => {
        // Check if the imageUrl is a large data URL
        if (meal.imageUrl && meal.imageUrl.startsWith('data:image') && meal.imageUrl.length > 10000) {
          console.log(`Found large image for meal: ${meal.name}, replacing with placeholder`);
          // Replace with placeholder to save space
          return {
            ...meal,
            imageUrl: '/placeholder.svg' 
          };
        }
        return meal;
      });
      
      // Save the cleaned up data
      localStorage.setItem(MEALS_STORAGE_KEY, JSON.stringify(cleanedMeals));
      
      // Log the new usage
      const newUsage = getLocalStorageUsage();
      console.log(`Storage cleanup complete. Usage: ${usage.used.toFixed(2)}MB → ${newUsage.used.toFixed(2)}MB`);
    }
  } catch (error) {
    console.error('Error cleaning up storage:', error);
  }
}; 