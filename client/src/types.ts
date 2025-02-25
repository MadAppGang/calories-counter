export interface Meal {
  id: string;
  name: string;
  description?: string;
  calories: number;
  imageUrl: string;
  timestamp: number;
  healthScore?: number;
  time?: string;
}

export interface UserSettings {
  dailyCalorieTarget: number;
} 