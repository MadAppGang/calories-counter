import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Calendar as CalendarIcon, Home, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { MealsApi, SettingsApi } from '../utils/api';
import { Meal } from '../types';
import { Button } from './ui/button';

// Helper function to get month details
const getDaysInMonth = (year: number, month: number) => {
  return new Date(year, month + 1, 0).getDate();
};

const getMonthStartDay = (year: number, month: number) => {
  return new Date(year, month, 1).getDay();
};

interface DayData {
  date: Date;
  totalCalories: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  macros: {
    protein: number;
    carbs: number;
    fats: number;
  };
}

// Component to display compact macronutrient information
const MacroDisplay = ({ 
  protein, 
  carbs, 
  fats,
  proteinTarget,
  carbsTarget,
  fatsTarget
}: { 
  protein: number; 
  carbs: number; 
  fats: number;
  proteinTarget: number;
  carbsTarget: number;
  fatsTarget: number;
}) => {
  if (protein === 0 && carbs === 0 && fats === 0) return null;
  
  // Make sure targets are not zero to avoid division by zero
  const safeProteinTarget = proteinTarget || 50; // Default if target is 0
  const safeCarbsTarget = carbsTarget || 250;
  const safeFatsTarget = fatsTarget || 65;
  
  // Calculate percentages of targets (capped at 100%)
  const proteinPercent = Math.min(100, Math.max(0, (protein / safeProteinTarget) * 100));
  const carbsPercent = Math.min(100, Math.max(0, (carbs / safeCarbsTarget) * 100));
  const fatsPercent = Math.min(100, Math.max(0, (fats / safeFatsTarget) * 100));
  
  // Ensure even very small values show up
  const minVisibleWidth = 2; // Minimum width in percentage to make small values visible
  
  const visibleProteinWidth = protein > 0 ? Math.max(minVisibleWidth, proteinPercent) : 0;
  const visibleCarbsWidth = carbs > 0 ? Math.max(minVisibleWidth, carbsPercent) : 0;
  const visibleFatsWidth = fats > 0 ? Math.max(minVisibleWidth, fatsPercent) : 0;
  
  // Format tooltips with percentage information
  const proteinTooltip = `Protein: ${Math.round(protein)}g of ${safeProteinTarget}g target (${Math.round(proteinPercent)}%)`;
  const carbsTooltip = `Carbs: ${Math.round(carbs)}g of ${safeCarbsTarget}g target (${Math.round(carbsPercent)}%)`;
  const fatsTooltip = `Fats: ${Math.round(fats)}g of ${safeFatsTarget}g target (${Math.round(fatsPercent)}%)`;
  
  // Format for overall tooltip
  const macroLabel = `Protein: ${Math.round(protein)}g (${Math.round(proteinPercent)}%), Carbs: ${Math.round(carbs)}g (${Math.round(carbsPercent)}%), Fats: ${Math.round(fats)}g (${Math.round(fatsPercent)}%)`;
  
  return (
    <div className="mt-0.5 flex flex-col space-y-0.5 mb-1" title={macroLabel}>
      {/* Protein bar */}
      <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
        <div 
          className="h-full bg-blue-500 rounded-full"
          style={{ width: `${visibleProteinWidth}%` }}
          title={proteinTooltip}
        ></div>
      </div>
      
      {/* Carbs bar */}
      <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
        <div 
          className="h-full bg-yellow-500 rounded-full"
          style={{ width: `${visibleCarbsWidth}%` }}
          title={carbsTooltip}
        ></div>
      </div>
      
      {/* Fats bar */}
      <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
        <div 
          className="h-full bg-pink-500 rounded-full"
          style={{ width: `${visibleFatsWidth}%` }}
          title={fatsTooltip}
        ></div>
      </div>
    </div>
  );
};

export default function CalendarView() {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [monthData, setMonthData] = useState<DayData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dailyCalorieTarget, setDailyCalorieTarget] = useState(2000);
  const [dailyProteinTarget, setDailyProteinTarget] = useState(50);
  const [dailyCarbsTarget, setDailyCarbsTarget] = useState(250);
  const [dailyFatsTarget, setDailyFatsTarget] = useState(65);
  const [monthMeals, setMonthMeals] = useState<Meal[]>([]);

  // Handle day click to navigate to dashboard with the selected date
  const handleDayClick = (date: Date) => {
    console.log('Calendar day clicked:', date);
    
    // We need to preserve the exact date components to avoid timezone issues
    const selectedDate = {
      year: date.getFullYear(),
      month: date.getMonth(),
      day: date.getDate()
    };
    
    console.log('Storing date components:', selectedDate);
    
    // Store the date components as JSON instead of Date object
    localStorage.setItem('selectedDashboardDate', JSON.stringify(selectedDate));
    
    // Force the storage to take effect immediately
    console.log('Stored in localStorage:', localStorage.getItem('selectedDashboardDate'));
    
    // Use URL search parameters as well for more reliable transfer
    const dateParam = `${selectedDate.year}-${selectedDate.month}-${selectedDate.day}`;
    
    // Navigate back to dashboard with the date parameter
    navigate(`/?date=${dateParam}`);
  };

  // Get current year and month
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  
  // Month names array
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June', 
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Day names array
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  // Medium day names
  const mediumDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  // Shorter day names for mobile
  const shortDayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  // Load settings and month data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setLoadError(null);
      
      try {
        // Load user settings
        const settings = SettingsApi.get();
        console.log('Loaded settings:', settings);
        
        // Set targets with fallbacks to default values
        setDailyCalorieTarget(settings.dailyCalorieTarget || 2000);
        setDailyProteinTarget(settings.proteinTarget || 150);
        setDailyCarbsTarget(settings.carbsTarget || 250);
        setDailyFatsTarget(settings.fatsTarget || 45);
        
        console.log('Set macro targets:', {
          calories: settings.dailyCalorieTarget || 2000,
          protein: settings.proteinTarget || 150,
          carbs: settings.carbsTarget || 250,
          fats: settings.fatsTarget || 45
        });

        // Calculate start and end dates for the month view
        // We'll also include the last few days of previous month and first few days of next month
        // to fill the calendar grid
        const startOfMonth = new Date(currentYear, currentMonth, 1);
        const endOfMonth = new Date(currentYear, currentMonth + 1, 0);
        
        // Adjust start date to include days from previous month to fill the grid
        const firstDayOfWeek = startOfMonth.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const adjustedStartDate = new Date(startOfMonth);
        adjustedStartDate.setDate(adjustedStartDate.getDate() - firstDayOfWeek);
        
        // Adjust end date to include days from next month to fill the grid
        const lastDayOfMonth = endOfMonth.getDate();
        const lastDayOfWeek = endOfMonth.getDay();
        const daysToAdd = 6 - lastDayOfWeek;
        const adjustedEndDate = new Date(endOfMonth);
        adjustedEndDate.setDate(adjustedEndDate.getDate() + daysToAdd + 1); // +1 to make it exclusive
        
        // Fetch meals for the adjusted date range
        console.log('Fetching meals from', adjustedStartDate.toLocaleDateString(), 'to', adjustedEndDate.toLocaleDateString());
        const meals = await MealsApi.getMealsByDateRange(adjustedStartDate, adjustedEndDate);
        setMonthMeals(meals);
        
        // Group meals by day
        const mealsByDay: Record<string, Meal[]> = {};
        meals.forEach(meal => {
          const mealDate = new Date(meal.timestamp);
          const dateKey = `${mealDate.getFullYear()}-${mealDate.getMonth()}-${mealDate.getDate()}`;
          
          if (!mealsByDay[dateKey]) {
            mealsByDay[dateKey] = [];
          }
          
          mealsByDay[dateKey].push(meal);
        });
        
        // Create calendar grid data
        const calendarData: DayData[] = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Fill the grid with days
        let currentDatePointer = new Date(adjustedStartDate);
        while (currentDatePointer < adjustedEndDate) {
          const year = currentDatePointer.getFullYear();
          const month = currentDatePointer.getMonth();
          const date = currentDatePointer.getDate();
          const dateKey = `${year}-${month}-${date}`;
          
          // Calculate total calories for this day
          const dayMeals = mealsByDay[dateKey] || [];
          const totalCalories = dayMeals.reduce((sum, meal) => sum + meal.calories, 0);
          
          // Calculate macronutrient totals for this day
          const macros = dayMeals.reduce((totals, meal) => {
            return {
              protein: totals.protein + (meal.protein || 0),
              carbs: totals.carbs + (meal.carbs || 0),
              fats: totals.fats + (meal.fats || 0)
            };
          }, { protein: 0, carbs: 0, fats: 0 });
          
          // Check if this day is today
          const isToday = 
            today.getFullYear() === year && 
            today.getMonth() === month && 
            today.getDate() === date;
          
          // Check if this day belongs to the current month
          const isCurrentMonth = month === currentMonth;
          
          calendarData.push({
            date: new Date(currentDatePointer),
            totalCalories,
            isCurrentMonth,
            isToday,
            macros
          });
          
          // Move to next day
          currentDatePointer.setDate(currentDatePointer.getDate() + 1);
        }
        
        setMonthData(calendarData);
      } catch (error) {
        console.error('Error loading calendar data:', error);
        setLoadError('Failed to load calendar data. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [currentYear, currentMonth]);

  // Navigate to previous month
  const goToPreviousMonth = () => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() - 1);
      return newDate;
    });
  };

  // Navigate to next month
  const goToNextMonth = () => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + 1);
      return newDate;
    });
  };

  // Navigate to current month
  const goToCurrentMonth = () => {
    setCurrentDate(new Date());
  };

  // Calculate color based on calorie intake vs target
  const getCalorieColor = (calories: number) => {
    if (calories === 0) return 'bg-gray-100';
    
    const percentage = (calories / dailyCalorieTarget) * 100;
    
    if (percentage < 80) return 'bg-blue-100 text-blue-800';
    if (percentage <= 100) return 'bg-green-100 text-green-800';
    if (percentage <= 120) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold">Calorie Calendar</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/')}
          className="flex items-center"
        >
          <Home className="h-4 w-4 mr-1" />
          Dashboard
        </Button>
      </div>
      
      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-9">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-6 bg-white rounded-lg p-4 shadow-sm border">
            <Button 
              variant="outline" 
              onClick={goToPreviousMonth}
              className="flex items-center"
              disabled={isLoading}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Previous</span>
            </Button>
            
            <div className="text-xl font-medium text-center">
              {monthNames[currentMonth]} {currentYear}
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={goToCurrentMonth}
                className="flex items-center"
                disabled={isLoading}
              >
                <CalendarIcon className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Today</span>
              </Button>
              
              <Button 
                variant="outline" 
                onClick={goToNextMonth}
                className="flex items-center"
                disabled={isLoading}
              >
                <span className="hidden sm:inline">Next</span>
                <ArrowRight className="h-4 w-4 ml-1 sm:ml-1" />
              </Button>
            </div>
          </div>
          
          {/* Calendar grid */}
          {isLoading ? (
            <div className="flex flex-col justify-center items-center h-64 bg-white rounded-lg shadow-sm border p-6">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500 mb-4"></div>
              <p className="text-gray-600">Loading calendar data...</p>
              <p className="text-gray-500 text-sm mt-2">This might take a moment if it's your first time viewing the calendar.</p>
            </div>
          ) : loadError ? (
            <div className="flex flex-col justify-center items-center h-64 bg-white rounded-lg shadow-sm border p-6">
              <div className="flex items-center text-amber-600 mb-4">
                <AlertTriangle className="h-6 w-6 mr-2" />
                <h3 className="font-semibold">Error Loading Data</h3>
              </div>
              <p className="text-gray-600">{loadError}</p>
              <Button 
                className="mt-4" 
                onClick={() => window.location.reload()}
              >
                Try Again
              </Button>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              {/* Day header */}
              <div className="grid grid-cols-7 bg-gray-50 border-b">
                {dayNames.map((day, index) => (
                  <div key={index} className="p-2 text-center text-sm font-medium text-gray-500">
                    <span className="hidden lg:inline">{day}</span>
                    <span className="hidden sm:inline lg:hidden">{mediumDayNames[index]}</span>
                    <span className="sm:hidden">{shortDayNames[index]}</span>
                  </div>
                ))}
              </div>
              
              {/* Calendar grid */}
              <div className="grid grid-cols-7">
                {monthData.map((day, index) => (
                  <div 
                    key={index} 
                    className={`
                      border border-gray-100 p-1 sm:p-2 h-18 sm:h-26 lg:h-32 overflow-hidden
                      ${!day.isCurrentMonth ? 'bg-gray-50 text-gray-400' : ''}
                      ${day.isToday ? 'ring-2 ring-blue-500 ring-inset' : ''}
                      cursor-pointer hover:bg-gray-50 transition-colors
                    `}
                    onClick={() => handleDayClick(day.date)}
                    role="button"
                    aria-label={`View meals for ${day.date.toLocaleDateString()}`}
                  >
                    <div className="text-right mb-1">
                      <span className="text-xs sm:text-sm lg:text-base font-medium">
                        {day.date.getDate()}
                      </span>
                    </div>
                    
                    {day.totalCalories > 0 ? (
                      <>
                        <div 
                          className={`
                            text-center py-0.5 rounded-md mt-0.5 text-xs sm:text-sm font-medium
                            ${getCalorieColor(day.totalCalories)}
                          `}
                        >
                          {day.totalCalories} cal
                        </div>
                        {/* Log macros and targets for days with data */}
                        {day.date.getDate() === 15 && (() => {
                          console.log(`Macro data for day ${day.date.toLocaleDateString()}:`, {
                            macros: day.macros,
                            targets: {
                              protein: dailyProteinTarget,
                              carbs: dailyCarbsTarget,
                              fats: dailyFatsTarget
                            }
                          });
                          return null;
                        })()}
                        <MacroDisplay 
                          protein={day.macros.protein} 
                          carbs={day.macros.carbs} 
                          fats={day.macros.fats} 
                          proteinTarget={dailyProteinTarget}
                          carbsTarget={dailyCarbsTarget}
                          fatsTarget={dailyFatsTarget}
                        />
                      </>
                    ) : (
                      <div className="text-xs text-gray-400 italic text-center mt-2">
                        -
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <div className="lg:col-span-3">
          {/* Calendar target info */}
          <div className="bg-white rounded-lg shadow-sm border p-6 lg:sticky lg:top-4">
            <h3 className="text-lg font-semibold mb-4">Calorie Targets</h3>
            
            <div className="mb-4">
              <div className="text-sm text-gray-600 mb-2">Daily Target: <span className="font-semibold">{dailyCalorieTarget} calories</span></div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full w-full"></div>
              </div>
            </div>
            
            <h4 className="font-medium text-sm mb-3">Color Legend</h4>
            <div className="space-y-2">
              <div className="flex items-center">
                <div className="w-4 h-4 rounded-full bg-blue-100 mr-2"></div>
                <span className="text-sm">&lt;80% of target</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 rounded-full bg-green-100 mr-2"></div>
                <span className="text-sm">80-100% of target</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 rounded-full bg-yellow-100 mr-2"></div>
                <span className="text-sm">100-120% of target</span>
              </div>
              <div className="flex items-center">
                <div className="w-4 h-4 rounded-full bg-red-100 mr-2"></div>
                <span className="text-sm">&gt;120% of target</span>
              </div>
            </div>
            
            <div className="mt-4">
              <h4 className="font-medium text-sm mb-3">Macronutrient Legend</h4>
              <div className="space-y-3">
                <div className="flex items-center">
                  <div className="w-10 mr-3">
                    <div className="h-2 bg-blue-500 rounded-full"></div>
                  </div>
                  <span className="text-sm">Protein ({dailyProteinTarget}g target)</span>
                </div>
                <div className="flex items-center">
                  <div className="w-10 mr-3">
                    <div className="h-2 bg-yellow-500 rounded-full"></div>
                  </div>
                  <span className="text-sm">Carbs ({dailyCarbsTarget}g target)</span>
                </div>
                <div className="flex items-center">
                  <div className="w-10 mr-3">
                    <div className="h-2 bg-pink-500 rounded-full"></div>
                  </div>
                  <span className="text-sm">Fats ({dailyFatsTarget}g target)</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Bar lengths show progress toward daily targets. Hover for exact values.
                </p>
              </div>
            </div>
            
            <div className="mt-6 pt-6 border-t border-gray-100">
              <h4 className="font-medium text-sm mb-3">Tips</h4>
              <ul className="text-sm text-gray-600 space-y-2">
                <li>• Click on any day to view detailed meals on dashboard</li>
                <li>• Days with recorded meals show calorie counts</li>
                <li>• Colors indicate how your calorie intake compares to your target</li>
                <li>• Progress bars show how close you are to your daily macro targets</li>
                <li>• Hover over bars to see exact values and targets</li>
                <li>• Use the calendar for tracking patterns over time</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 