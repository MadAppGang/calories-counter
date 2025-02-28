export interface Meal {
  id: string;
  name: string;
  description?: string;
  calories: number;
  // Macronutrients in grams
  protein?: number;
  carbs?: number;
  fats?: number;
  imageUrl: string;
  timestamp: number;
  healthScore?: number;
  time?: string;
}

export interface UserSettings {
  dailyCalorieTarget: number;
  // Optional targets for macronutrients (in grams)
  proteinTarget?: number;
  carbsTarget?: number;
  fatsTarget?: number;
} 