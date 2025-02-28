import React, { useState, useEffect } from 'react';
import { getSettings, saveSettings } from '../utils/storage';
import { useNavigate } from 'react-router-dom';
import { SettingsApi, MealsApi } from '../utils/api';
import { useAuth } from '../lib/firebase/AuthContext';
import { LogOut } from 'lucide-react';

const Settings: React.FC = () => {
  const [dailyCalorieTarget, setDailyCalorieTarget] = useState<number>(2000);
  const [proteinTarget, setProteinTarget] = useState<number>(0);
  const [carbsTarget, setCarbsTarget] = useState<number>(0);
  const [fatsTarget, setFatsTarget] = useState<number>(0);
  const [isClearing, setIsClearing] = useState<boolean>(false);
  const navigate = useNavigate();
  const { logout } = useAuth();

  useEffect(() => {
    const settings = SettingsApi.get();
    setDailyCalorieTarget(settings.dailyCalorieTarget);
    setProteinTarget(settings.proteinTarget || calculateDefaultProtein(settings.dailyCalorieTarget));
    setCarbsTarget(settings.carbsTarget || calculateDefaultCarbs(settings.dailyCalorieTarget));
    setFatsTarget(settings.fatsTarget || calculateDefaultFats(settings.dailyCalorieTarget));
  }, []);

  // Functions to calculate default macros based on calorie target
  const calculateDefaultProtein = (calories: number): number => {
    // Protein is generally recommended at 0.8-1.2g per pound of body weight
    // As a simplification, we'll use 30% of calories from protein (4 calories per gram)
    return Math.round((calories * 0.3) / 4);
  };

  const calculateDefaultCarbs = (calories: number): number => {
    // Typically 45-65% of calories from carbs (4 calories per gram)
    return Math.round((calories * 0.5) / 4);
  };

  const calculateDefaultFats = (calories: number): number => {
    // Typically 20-35% of calories from fats (9 calories per gram)
    return Math.round((calories * 0.2) / 9);
  };

  // Recalculate macros when calorie target changes
  const handleCalorieTargetChange = (newCalorieTarget: number) => {
    setDailyCalorieTarget(newCalorieTarget);
    
    // Only update default macros if they haven't been customized or are zero
    if (proteinTarget === 0 || proteinTarget === calculateDefaultProtein(dailyCalorieTarget)) {
      setProteinTarget(calculateDefaultProtein(newCalorieTarget));
    }
    
    if (carbsTarget === 0 || carbsTarget === calculateDefaultCarbs(dailyCalorieTarget)) {
      setCarbsTarget(calculateDefaultCarbs(newCalorieTarget));
    }
    
    if (fatsTarget === 0 || fatsTarget === calculateDefaultFats(dailyCalorieTarget)) {
      setFatsTarget(calculateDefaultFats(newCalorieTarget));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    SettingsApi.updateAllTargets(dailyCalorieTarget, proteinTarget, carbsTarget, fatsTarget);
    navigate('/');
  };
  
  const clearAllMeals = async () => {
    if (window.confirm('Are you sure you want to clear all your meal history? This cannot be undone.')) {
      setIsClearing(true);
      try {
        const result = await MealsApi.clearAll();
        
        if (result.success) {
          alert('All meal history has been cleared.');
        } else {
          alert(`Failed to clear meal history: ${result.message}`);
        }
      } catch (error) {
        console.error('Error clearing meals:', error);
        alert('Failed to clear meal history due to a network error.');
      } finally {
        setIsClearing(false);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      // Navigate is not needed as the auth state will change
      // and the protected route will redirect to login
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-md">
      <div className="flex items-center mb-6">
        <button 
          onClick={() => navigate('/')}
          className="mr-4"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>
      
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="mb-6">
          <label htmlFor="calorieTarget" className="block text-gray-700 mb-2 font-medium">
            Daily Calorie Target
          </label>
          <input
            type="number"
            id="calorieTarget"
            value={dailyCalorieTarget}
            onChange={(e) => handleCalorieTargetChange(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            min="500"
            max="10000"
            required
          />
        </div>
        
        <div className="mb-6">
          <h3 className="block text-gray-700 mb-3 font-medium">Macronutrient Targets (g)</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="proteinTarget" className="block text-gray-700 mb-1 text-sm">
                Protein
              </label>
              <input
                type="number"
                id="proteinTarget"
                value={proteinTarget}
                onChange={(e) => setProteinTarget(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
                max="500"
              />
            </div>
            
            <div>
              <label htmlFor="carbsTarget" className="block text-gray-700 mb-1 text-sm">
                Carbs
              </label>
              <input
                type="number"
                id="carbsTarget"
                value={carbsTarget}
                onChange={(e) => setCarbsTarget(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
                max="500"
              />
            </div>
            
            <div>
              <label htmlFor="fatsTarget" className="block text-gray-700 mb-1 text-sm">
                Fats
              </label>
              <input
                type="number"
                id="fatsTarget"
                value={fatsTarget}
                onChange={(e) => setFatsTarget(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
                max="500"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            These values represent your daily target for each macronutrient in grams.
          </p>
        </div>
        
        <button
          type="submit"
          className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Save Settings
        </button>
      </form>
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Data Management</h2>
        
        <button
          onClick={clearAllMeals}
          className="w-full bg-red-500 text-white py-2 px-4 rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500"
          disabled={isClearing}
        >
          {isClearing ? 'Clearing...' : 'Clear All Meal History'}
        </button>
        <p className="text-xs text-gray-500 mt-2">
          This will delete all your meal history and cannot be undone.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold mb-4">Account</h2>
        
        <button
          onClick={handleLogout}
          className="w-full flex justify-center items-center bg-gray-700 text-white py-2 px-4 rounded-md hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Logout
        </button>
        <p className="text-xs text-gray-500 mt-2">
          You will be redirected to the login page.
        </p>
      </div>
    </div>
  );
};

export default Settings; 