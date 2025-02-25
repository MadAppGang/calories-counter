import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import MealEntry from './components/MealEntry';
import { cleanupStorageIfNeeded, getLocalStorageUsage } from './utils/storage';
import './App.css';

const App: React.FC = () => {
  useEffect(() => {
    // Check and clean up localStorage when app loads
    try {
      // Log current storage usage
      const usage = getLocalStorageUsage();
      console.log(`Initial localStorage usage: ${usage.used.toFixed(2)}MB / ${usage.max}MB (${usage.percentage.toFixed(1)}%)`);
      
      // Run cleanup if needed
      cleanupStorageIfNeeded();
    } catch (error) {
      console.error('Error during storage initialization:', error);
    }
  }, []);

  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/add-meal" element={<MealEntry />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App; 