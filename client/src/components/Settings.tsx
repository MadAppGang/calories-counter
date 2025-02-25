import React, { useState, useEffect } from 'react';
import { getSettings, saveSettings } from '../utils/storage';
import { useNavigate } from 'react-router-dom';
import { SettingsApi, MealsApi } from '../utils/api';
import { useAuth } from '../lib/firebase/AuthContext';
import { LogOut } from 'lucide-react';

const Settings: React.FC = () => {
  const [dailyCalorieTarget, setDailyCalorieTarget] = useState<number>(2000);
  const [isClearing, setIsClearing] = useState<boolean>(false);
  const navigate = useNavigate();
  const { logout } = useAuth();

  useEffect(() => {
    const settings = SettingsApi.get();
    setDailyCalorieTarget(settings.dailyCalorieTarget);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    SettingsApi.updateCalorieTarget(dailyCalorieTarget);
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