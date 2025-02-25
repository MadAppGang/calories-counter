import React, { useState, useEffect } from 'react';
import { getSettings, saveSettings, getLocalStorageUsage } from '../utils/storage';
import { useNavigate } from 'react-router-dom';
import { SettingsApi } from '../utils/api';

const Settings: React.FC = () => {
  const [dailyCalorieTarget, setDailyCalorieTarget] = useState<number>(2000);
  const [storageUsage, setStorageUsage] = useState<{ used: number, max: number, percentage: number }>({ 
    used: 0, max: 5, percentage: 0 
  });
  const navigate = useNavigate();

  useEffect(() => {
    const settings = SettingsApi.get();
    setDailyCalorieTarget(settings.dailyCalorieTarget);
    
    // Get current storage usage
    const usage = getLocalStorageUsage();
    setStorageUsage(usage);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    SettingsApi.updateCalorieTarget(dailyCalorieTarget);
    navigate('/');
  };
  
  const clearAllMeals = () => {
    if (window.confirm('Are you sure you want to clear all your meal history? This cannot be undone.')) {
      try {
        localStorage.removeItem('calorieTracker_meals');
        // Update storage usage display
        setStorageUsage(getLocalStorageUsage());
        alert('All meal history has been cleared.');
      } catch (error) {
        console.error('Error clearing meals:', error);
        alert('Failed to clear meal history.');
      }
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
          <label htmlFor="calorieTarget" className="block text-gray-700 mb-2">
            Daily Calorie Target
          </label>
          <input
            type="number"
            id="calorieTarget"
            value={dailyCalorieTarget}
            onChange={(e) => setDailyCalorieTarget(Number(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            min="500"
            max="10000"
            required
          />
        </div>
        
        <button
          type="submit"
          className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Save Settings
        </button>
      </form>
      
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold mb-4">Storage Management</h2>
        
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-2">Storage Usage:</p>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className={`h-2.5 rounded-full ${storageUsage.percentage > 80 ? 'bg-red-500' : 'bg-blue-500'}`} 
              style={{ width: `${Math.min(storageUsage.percentage, 100)}%` }}
            ></div>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {storageUsage.used.toFixed(2)}MB / {storageUsage.max}MB ({storageUsage.percentage.toFixed(1)}%)
          </p>
        </div>
        
        <button
          onClick={clearAllMeals}
          className="w-full bg-red-500 text-white py-2 px-4 rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          Clear All Meal History
        </button>
        <p className="text-xs text-gray-500 mt-2">
          This will delete all your meal history and cannot be undone.
        </p>
      </div>
    </div>
  );
};

export default Settings; 