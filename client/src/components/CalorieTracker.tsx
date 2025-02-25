import { useEffect, useState } from "react"
import { Plus, Settings } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { MealApi, SettingsApi } from "../utils/api"
import { Meal } from "../types"
import Image from "./ui/image"
import Link from "./ui/link"
import { Button } from "./ui/button"

export default function CalorieTracker() {
  const [meals, setMeals] = useState<Meal[]>([])
  const [totalCalories, setTotalCalories] = useState(0)
  const navigate = useNavigate()

  useEffect(() => {
    // Load today's meals on component mount
    const todayMeals = MealApi.getToday()
    
    // Transform the meals to include time and healthScore
    const formattedMeals = todayMeals.map(meal => ({
      ...meal,
      time: formatTimestamp(meal.timestamp),
      healthScore: meal.healthScore || calculateHealthScore(meal.calories),
    }))
    
    setMeals(formattedMeals)
    setTotalCalories(MealApi.getTodayCalories())
  }, [])

  // Format timestamp to time string (e.g., "08:30 AM")
  const formatTimestamp = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true
    })
  }

  // Calculate a health score based on calories
  // This is a simple example - you might want a more sophisticated algorithm
  const calculateHealthScore = (calories: number): number => {
    // Lower calories generally mean healthier meals in this simple model
    // Score from 0-100
    if (calories < 200) return 95
    if (calories < 300) return 85
    if (calories < 400) return 75
    if (calories < 500) return 65
    if (calories < 600) return 55
    return 45
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
              <p className="text-sm text-muted-foreground">{meal.description || meal.name}</p>
              <div className="flex justify-between items-center mt-2">
                <span className="text-sm">{meal.time}</span>
                <span className="text-sm font-medium">{meal.calories} cal</span>
              </div>
            </div>
            <div
              className="w-3 h-3 rounded-full ml-2"
              style={{
                backgroundColor: `hsl(${meal.healthScore}, 70%, 50%)`,
              }}
            />
          </div>
        ))}
      </div>

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

  return (
    <div className="flex justify-center items-center mb-8">
      <div className="relative w-64 h-64">
        <svg className="w-full h-full rotate-[-90deg]" viewBox="0 0 100 100">
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
          <circle className="text-muted/20 stroke-[10]" cx="50" cy="50" r="45" fill="transparent" />
          <circle
            className="stroke-[10] text-primary transition-all duration-1000 ease-in-out"
            style={{ stroke: "url(#gradient)" }}
            cx="50"
            cy="50"
            r="45"
            fill="transparent"
            strokeDasharray={`${2 * Math.PI * 45}`}
            strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col justify-center items-center">
          <span className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-600">
            {remainingCalories}
          </span>
          <span className="text-sm text-muted-foreground mt-2">calories left</span>
        </div>
      </div>
    </div>
  )
} 