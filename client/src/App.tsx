import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import Settings from './components/Settings';
import MealEntry from './components/MealEntry';
import CalendarView from './components/CalendarView';
import GoogleAuth from './components/auth/GoogleAuth';
import { AuthProvider, useAuth } from './lib/firebase/AuthContext';
import './App.css';

// Protected route component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { currentUser, loading } = useAuth();
  
  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }
  
  if (!currentUser) {
    return <Navigate to="/auth" replace />;
  }
  
  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-100">
          <div className="mx-auto max-w-7xl">
            <Routes>
              {/* Auth route */}
              <Route path="/auth" element={<GoogleAuth />} />
              
              {/* Protected routes */}
              <Route 
                path="/" 
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/settings" 
                element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/add-meal" 
                element={
                  <ProtectedRoute>
                    <MealEntry />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/calendar" 
                element={
                  <ProtectedRoute>
                    <CalendarView />
                  </ProtectedRoute>
                } 
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
          
          {/* Simple environment indicator for development */}
          {import.meta.env.DEV && (
            <div className="fixed bottom-2 right-2 bg-green-600 text-white text-xs px-2 py-1 rounded-md opacity-70 z-50">
              DEV
            </div>
          )}
        </div>
      </Router>
    </AuthProvider>
  );
};

export default App; 