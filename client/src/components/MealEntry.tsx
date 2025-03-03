import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { MealsApi, MealAnalysisApi, SettingsApi } from '../utils/api';
import { getSettings } from '../utils/storage';

// Helper function to create a thumbnail from an image
const createThumbnail = async (dataUrl: string, maxWidth: number = 500): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      const img = new Image();
      img.onload = () => {
        // Calculate new dimensions while maintaining aspect ratio
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          const ratio = maxWidth / width;
          width = maxWidth;
          height = Math.floor(height * ratio);
        }
        
        // Create canvas and draw image with new dimensions
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // Get reduced size data URL
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      
      img.src = dataUrl;
    } catch (error) {
      reject(error);
    }
  });
};

const MealEntry: React.FC = (): JSX.Element => {
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [thumbnailImage, setThumbnailImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [mealName, setMealName] = useState<string>('');
  const [mealDescription, setMealDescription] = useState<string>('');
  const [analysisDescription, setAnalysisDescription] = useState<string>('');
  const [calories, setCalories] = useState<number>(0);
  const [protein, setProtein] = useState<number>(0);
  const [carbs, setCarbs] = useState<number>(0);
  const [fats, setFats] = useState<number>(0);
  const [healthScore, setHealthScore] = useState<number>(3); // Default to neutral
  const [selectedDate, setSelectedDate] = useState<'today' | 'yesterday'>('today');
  const [showCorrectionModal, setShowCorrectionModal] = useState<boolean>(false);
  const [correctionText, setCorrectionText] = useState<string>('');
  const [previousResult, setPreviousResult] = useState<string>('');
  const [isCorrectingMeal, setIsCorrectingMeal] = useState<boolean>(false);
  const navigate = useNavigate();

  // Helper function to estimate macronutrients based on calories
  const estimateMacrosFromCalories = (calories: number) => {
    // Default distribution: 30% protein, 50% carbs, 20% fat
    // Protein and carbs = 4 calories per gram, fat = 9 calories per gram
    const protein = Math.round((calories * 0.30) / 4);
    const carbs = Math.round((calories * 0.50) / 4);
    const fats = Math.round((calories * 0.20) / 9);
    
    return { protein, carbs, fats };
  };

  // Load default settings
  useEffect(() => {
    const settings = getSettings();
    console.log('Loaded settings:', settings);
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onloadend = async () => {
        const fullSizePreview = reader.result as string;
        setImagePreview(fullSizePreview);
        
        try {
          // Create and store a thumbnail version
          const thumbnail = await createThumbnail(fullSizePreview);
          setThumbnailImage(thumbnail);
        } catch (error) {
          console.error('Failed to create thumbnail:', error);
          // Fall back to a placeholder if thumbnail creation fails
          setThumbnailImage('/placeholder.svg');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzeImage = async () => {
    if (!image) return;
    
    setIsAnalyzing(true);
    
    try {
      // Use the MealAnalysisApi for image analysis
      const result = await MealAnalysisApi.analyzeImage(image);
      
      // Save the original result description for potential correction
      setPreviousResult(`${result.name} (${result.description})`);
      
      setMealName(result.name);
      setMealDescription(result.description);
      setCalories(result.calories);
      setProtein(result.protein || 0);
      setCarbs(result.carbs || 0);
      setFats(result.fats || 0);
      setHealthScore(result.healthScore);
    } catch (error) {
      console.error('Error analyzing image:', error);
      alert('Error analyzing image. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleOpenCorrectionModal = () => {
    setCorrectionText(`This is not ${mealName}. This is actually...`);
    setShowCorrectionModal(true);
  };
  
  const handleCloseModal = () => {
    setShowCorrectionModal(false);
  };
  
  const handleCorrectMeal = async () => {
    if (!correctionText) return;
    
    // Check if we need the image for correction (only if original recognition was from image)
    if (image && !imagePreview) {
      alert('Image is required for correcting image-based recognition');
      return;
    }
    
    setIsCorrectingMeal(true);
    
    try {
      let result;
      
      // If we have an image and it was an image-based recognition, use correctMealAnalysis
      if (image && imagePreview) {
        result = await MealAnalysisApi.correctMealAnalysis(image, previousResult, correctionText);
      } else {
        // For text-based corrections, include previous nutritional data as context
        const previousNutritionalInfo = JSON.stringify({
          name: mealName,
          description: mealDescription,
          calories: calories,
          protein: protein,
          carbs: carbs,
          fats: fats,
          healthScore: healthScore
        });
        
        // Include both the correction text and previous nutritional info
        result = await MealAnalysisApi.analyzeDescription(correctionText, previousNutritionalInfo);
      }
      
      // Update with the corrected values
      setMealName(result.name);
      setMealDescription(result.description);
      setCalories(result.calories);
      setProtein(result.protein || 0);
      setCarbs(result.carbs || 0);
      setFats(result.fats || 0);
      setHealthScore(result.healthScore);
      
      // Close the modal and reset correction text
      setShowCorrectionModal(false);
      setCorrectionText('');
      
      // Save the new result for potential future corrections
      setPreviousResult(`${result.name} (${result.description})`);
    } catch (error) {
      console.error('Error correcting meal:', error);
      alert('Error applying correction. Please try again.');
    } finally {
      setIsCorrectingMeal(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!thumbnailImage || !mealName || calories <= 0) {
      alert('Please fill in all required fields');
      return;
    }
    
    setIsSaving(true);
    
    try {
      // Calculate timestamp based on selectedDate
      let timestamp = Date.now();
      
      // If yesterday is selected, subtract 24 hours
      if (selectedDate === 'yesterday') {
        timestamp = Date.now() - (24 * 60 * 60 * 1000);
      }
      
      // Save meal to server with the smaller thumbnail image
      const result = await MealsApi.add({
        name: mealName,
        description: mealDescription,
        calories,
        protein,
        carbs,
        fats,
        imageUrl: thumbnailImage, // Use the thumbnail instead of full-size image
        timestamp: timestamp,
        healthScore, // Include health score in the saved data
      });
      
      if (result.success) {
        // Navigate back to dashboard
        navigate('/');
      } else {
        alert(`Failed to save meal: ${result.message}`);
      }
    } catch (error) {
      console.error('Error saving meal:', error);
      alert('Failed to save meal. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Correction modal component
  const CorrectionModal = () => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    
    useEffect(() => {
      if (showCorrectionModal && textareaRef.current) {
        const textarea = textareaRef.current;
        textarea.focus();
        // Set cursor at the end of the text
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      }
    }, [showCorrectionModal]);
    
    if (!showCorrectionModal) return null;
    
    return (
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
        onClick={handleCloseModal}
      >
        <div 
          className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-xl font-semibold mb-4">Correct Food Recognition</h3>
          
          <p className="text-gray-600 mb-4">
            Please describe what this food actually is, and we'll reanalyze it.
          </p>
          
          <textarea
            ref={textareaRef}
            value={correctionText}
            onChange={(e) => setCorrectionText(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
            rows={4}
            placeholder="For example: This is not bread, it's actually coffee."
          />
          
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={handleCloseModal}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
              disabled={isCorrectingMeal}
            >
              Cancel
            </button>
            
            <button
              type="button"
              onClick={handleCorrectMeal}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isCorrectingMeal || !correctionText.trim()}
            >
              {isCorrectingMeal ? 'Correcting...' : 'Submit Correction'}
            </button>
          </div>
        </div>
      </div>
    );
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
        <h1 className="text-2xl font-bold">Add Meal</h1>
      </div>
      
      <div className="bg-white rounded-lg shadow-md p-6">
        {/* Date selector */}
        <div className="mb-6">
          <label className="block text-gray-700 mb-2">
            Meal Date
          </label>
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={() => setSelectedDate('today')}
              className={`flex-1 py-2 px-4 rounded-md border ${
                selectedDate === 'today' 
                  ? 'bg-blue-50 border-blue-500 text-blue-700' 
                  : 'bg-white border-gray-300 text-gray-700'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate('yesterday')}
              className={`flex-1 py-2 px-4 rounded-md border ${
                selectedDate === 'yesterday' 
                  ? 'bg-blue-50 border-blue-500 text-blue-700' 
                  : 'bg-white border-gray-300 text-gray-700'
              }`}
            >
              Yesterday
            </button>
          </div>
        </div>
        
        <div className="space-y-6">
          {/* Image Upload Section */}
          <div>
            <label className="block text-gray-700 mb-2">
              Upload Meal Photo
            </label>
            
            {imagePreview ? (
              <div className="relative mb-4">
                <img 
                  src={imagePreview} 
                  alt="Meal preview" 
                  className="w-full h-48 object-cover rounded-md"
                />
                {!mealName && (
                  <button
                    onClick={() => {
                      setImage(null);
                      setImagePreview(null);
                      setThumbnailImage(null);
                      setMealName('');
                      setMealDescription('');
                      setCalories(0);
                      setProtein(0);
                      setCarbs(0);
                      setFats(0);
                      setHealthScore(3);
                      setPreviousResult('');
                    }}
                    className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-300 rounded-md p-6 text-center">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                  id="meal-image"
                />
                <label
                  htmlFor="meal-image"
                  className="cursor-pointer flex flex-col items-center justify-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-gray-500">Take a photo or upload an image</span>
                </label>
              </div>
            )}

            {image && !mealName && (
              <button
                onClick={analyzeImage}
                className="w-full mt-4 bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isAnalyzing}
              >
                {isAnalyzing ? 'Analyzing Photo...' : 'Analyze Photo'}
              </button>
            )}
          </div>

          {/* Text Description Section - Only show when no image is uploaded and no recognition results */}
          {!image && !mealName && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <label className="block text-gray-700 mb-2">
                Or Describe Your Meal
              </label>
              <textarea
                value={analysisDescription}
                onChange={(e) => setAnalysisDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Describe your meal in detail..."
                disabled={isAnalyzing}
              />
              {analysisDescription && (
                <button
                  onClick={async () => {
                    setIsAnalyzing(true);
                    try {
                      // Send user's description to AI for analysis
                      const result = await MealAnalysisApi.analyzeDescription(analysisDescription);
                      console.log('AI Analysis Result:', result); // Debug log
                      
                      // Validate that we have the required fields from AI
                      if (!result.name || !result.description || !result.calories) {
                        throw new Error('Missing required fields from AI analysis');
                      }
                      
                      // Use AI-generated name and description
                      setMealName(result.name);
                      setMealDescription(result.description);
                      
                      // Set nutritional values, ensuring we have numbers
                      setCalories(Number(result.calories) || 0);
                      setProtein(Number(result.protein) || 0);
                      setCarbs(Number(result.carbs) || 0);
                      setFats(Number(result.fats) || 0);
                      setHealthScore(Number(result.healthScore) || 3);
                      
                      // Update image if one was generated
                      if (result.imageUrl) {
                        setImagePreview(result.imageUrl);
                        setThumbnailImage(result.imageUrl);
                      }
                      
                      // Save the AI result for potential corrections
                      setPreviousResult(`${result.name} (${result.description})`);
                      
                      // Clear the analysis input field since we're done with it
                      setAnalysisDescription('');
                    } catch (error) {
                      console.error('Error analyzing description:', error);
                      alert('Error analyzing description. Please try again.');
                      // Reset all values on error
                      setMealName('');
                      setMealDescription('');
                      setCalories(0);
                      setProtein(0);
                      setCarbs(0);
                      setFats(0);
                      setHealthScore(3);
                      setAnalysisDescription(''); // Clear the input on error
                    } finally {
                      setIsAnalyzing(false);
                    }
                  }}
                  className="w-full mt-4 bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? 'Analyzing Description...' : 'Analyze Description'}
                </button>
              )}
            </div>
          )}
        </div>
        
        {/* Results form */}
        {mealName && !isAnalyzing && (
          <form onSubmit={handleSubmit} className="mt-6">
            <div className="mb-4">
              <div className="flex justify-between items-start mb-4">
                <label htmlFor="mealName" className="block text-gray-700">
                  Meal Name
                </label>
                
                {/* Correction button */}
                <button
                  type="button"
                  onClick={handleOpenCorrectionModal}
                  className="ml-4 px-4 py-2 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                >
                  Correct Recognition
                </button>
              </div>
              
              <input
                type="text"
                id="mealName"
                value={mealName}
                onChange={(e) => setMealName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            <div className="mb-4">
              <label htmlFor="mealDescription" className="block text-gray-700 mb-2">
                Description
              </label>
              <textarea
                id="mealDescription"
                value={mealDescription}
                onChange={(e) => setMealDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Describe your meal..."
              />
            </div>
            
            <div className="mb-4">
              <label htmlFor="calories" className="block text-gray-700 mb-2">
                Calories
              </label>
              <input
                type="number"
                id="calories"
                value={calories}
                onChange={(e) => {
                  const newCalories = Number(e.target.value);
                  setCalories(newCalories);
                  
                  // If macronutrients are all zero, estimate them based on calories
                  if (protein === 0 && carbs === 0 && fats === 0 && newCalories > 0) {
                    const estimatedMacros = estimateMacrosFromCalories(newCalories);
                    setProtein(estimatedMacros.protein);
                    setCarbs(estimatedMacros.carbs);
                    setFats(estimatedMacros.fats);
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-2 mb-6">
              <div>
                <label htmlFor="protein" className="block text-gray-700 mb-2">
                  Protein (g)
                </label>
                <input
                  type="number"
                  id="protein"
                  value={protein}
                  onChange={(e) => setProtein(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                />
              </div>
              
              <div>
                <label htmlFor="carbs" className="block text-gray-700 mb-2">
                  Carbs (g)
                </label>
                <input
                  type="number"
                  id="carbs"
                  value={carbs}
                  onChange={(e) => setCarbs(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                />
              </div>
              
              <div>
                <label htmlFor="fats" className="block text-gray-700 mb-2">
                  Fats (g)
                </label>
                <input
                  type="number"
                  id="fats"
                  value={fats}
                  onChange={(e) => setFats(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                />
              </div>
            </div>
            
            <button
              type="submit"
              className="w-full bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500"
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Meal'}
            </button>
          </form>
        )}
      </div>
      
      {/* Correction Modal */}
      <CorrectionModal />
    </div>
  );
};

export default MealEntry; 