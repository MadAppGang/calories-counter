import React, { useEffect, useState } from "react"
import { Plus, Settings, Trash } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { MealsApi, SettingsApi } from "../utils/api"
import { Meal } from "../types"
import Image from "./ui/image"
import Link from "./ui/link"
import { Button } from "./ui/button"

export default function CalorieTracker() {
  const [meals, setMeals] = useState<Meal[]>([])
  const [totalCalories, setTotalCalories] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const navigate = useNavigate()

  // Load meals from server
  const loadMeals = async () => {
    setIsLoading(true);
    try {
      // Get today's meals from server
      const todayMeals = await MealsApi.getToday();
      
      // Transform the meals to include time and healthScore
      const formattedMeals = todayMeals.map(meal => ({
        ...meal,
        time: formatTimestamp(meal.timestamp),
        healthScore: meal.healthScore || calculateHealthScore(meal.calories),
      }));
      
      setMeals(formattedMeals);
      
      // Calculate total calories
      const total = todayMeals.reduce((sum, meal) => sum + meal.calories, 0);
      setTotalCalories(total);
    } catch (error) {
      console.error('Error loading meals:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to delete a meal
  const deleteMeal = async (id: string) => {
    // Confirm with user before deleting
    if (window.confirm('Are you sure you want to delete this meal?')) {
      setIsDeleting(id);
      try {
        // Call the API to delete the meal
        const result = await MealsApi.delete(id);
        
        if (result.success) {
          // Update the UI by reloading meals
          loadMeals();
        } else {
          alert(`Failed to delete meal: ${result.message}`);
        }
      } catch (error) {
        console.error('Error deleting meal:', error);
        alert('Failed to delete meal. Please try again.');
      } finally {
        setIsDeleting(null);
      }
    }
  };

  useEffect(() => {
    // Load today's meals on component mount
    loadMeals();
  }, []);

  // Format timestamp to time string (e.g., "08:30 AM")
  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true
    })
  }

  // Calculate a health score based on calories
  // This is a fallback if the API hasn't provided a health score
  const calculateHealthScore = (calories: number): number => {
    // Lower calories generally mean healthier meals in this simple model
    // Score from 1-5
    if (calories < 200) return 5
    if (calories < 300) return 4
    if (calories < 400) return 3
    if (calories < 500) return 2
    return 1
  }

  // Get health emoji based on health score (1-5)
  const getHealthEmoji = (healthScore: number): string => {
    switch (healthScore) {
      case 5: return "🎉" // Very healthy - celebration
      case 4: return "😋" // Healthy - yummy face
      case 3: return "🤔" // Neutral - hmm, not sure about this
      case 2: return "🥴" // Unhealthy - woozy face
      case 1: return "🤮" // Very unhealthy - vomiting face
      default: return "❓" // Unknown
    }
  }

  const handleAddMeal = () => {
    navigate('/add-meal')
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-background">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Calorie Tracker</h1>
        <Link href="/settings">
          <Button variant="ghost" size="icon">
            <Settings className="h-5 w-5" />
            <span className="sr-only">Settings</span>
          </Button>
        </Link>
      </div>

      <CalorieProgress totalCalories={totalCalories} />

      {isLoading ? (
        <div className="flex justify-center items-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : meals.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <p>No meals tracked today.</p>
          <p>Add your first meal to start tracking!</p>
        </div>
      ) : (
        <div className="space-y-4 mb-6">
          {meals.map((meal) => (
            <div key={meal.id} className="flex items-center bg-card rounded-lg p-3 shadow-sm">
              <Image
                src={meal.imageUrl || "/placeholder.svg"}
                alt={meal.name}
                width={80}
                height={80}
                className="rounded-md mr-4"
              />
              <div className="flex-grow">
                <h3 className="font-semibold">{meal.name}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2 overflow-hidden text-ellipsis">{meal.description || meal.name}</p>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-sm">{meal.time}</span>
                  <span className="text-sm font-medium">{meal.calories} cal</span>
                </div>
              </div>
              <div
                className="text-xl ml-2 mr-2"
                title={`Healthiness: ${meal.healthScore}/5`}
              >
                {getHealthEmoji(meal.healthScore || 3)}
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => deleteMeal(meal.id)}
                aria-label="Delete meal"
                disabled={isDeleting === meal.id}
              >
                {isDeleting === meal.id ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-red-500"></div>
                ) : (
                  <Trash className="h-4 w-4 text-red-500" />
                )}
              </Button>
            </div>
          ))}
        </div>
      )}

      <Button className="w-full py-6 text-lg" size="lg" onClick={handleAddMeal}>
        <Plus className="mr-2 h-5 w-5" /> Add New Meal
      </Button>
    </div>
  )
}

function CalorieProgress({ totalCalories }: { totalCalories: number }) {
  const [calorieGoal, setCalorieGoal] = useState(2000)
  
  useEffect(() => {
    // Get calorie goal from settings
    const settings = SettingsApi.get()
    setCalorieGoal(settings.dailyCalorieTarget)
  }, [])

  const remainingCalories = calorieGoal - totalCalories
  const progress = (totalCalories / calorieGoal) * 100
  const isOverLimit = remainingCalories < 0

  return (
    <div className="flex justify-center items-center mb-8">
      <div className="relative w-64 h-64">
        <svg className="w-full h-full rotate-[-90deg]" viewBox="0 0 100 100">
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
            <linearGradient id="red-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#b91c1c" />
            </linearGradient>
          </defs>
          <circle className="text-muted/20 stroke-[10]" cx="50" cy="50" r="45" fill="transparent" />
          <circle
            className="stroke-[10] text-primary transition-all duration-1000 ease-in-out"
            style={{ stroke: isOverLimit ? "url(#red-gradient)" : "url(#gradient)" }}
            cx="50"
            cy="50"
            r="45"
            fill="transparent"
            strokeDasharray={`${2 * Math.PI * 45}`}
            strokeDashoffset={`${2 * Math.PI * 45 * (1 - Math.min(progress, 100) / 100)}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col justify-center items-center">
          {isOverLimit ? (
            <>
              <span className="text-4xl font-bold text-red-500">
                {Math.abs(remainingCalories)}
              </span>
              <span className="text-sm text-red-500 mt-2">calories over limit</span>
              <span className="text-xs mt-1 text-red-400">{getOverLimitEmoji()}</span>
            </>
          ) : (
            <>
              <span className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-600">
                {remainingCalories}
              </span>
              <span className="text-sm text-muted-foreground mt-2">calories left</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// Helper function to get a fun emoji when over the limit
function getOverLimitEmoji(): string {
  const emojis = ["🔥", "💥", "⚠️", "🍔", "🍕", "🍩", "😱", "🤯"];
  return emojis[Math.floor(Math.random() * emojis.length)];
} 