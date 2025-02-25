import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { MealsApi, MealAnalysisApi } from '../utils/api';
import { getSettings } from '../utils/storage';

const MealEntry: React.FC = () => {
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [thumbnailImage, setThumbnailImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [mealName, setMealName] = useState<string>('');
  const [calories, setCalories] = useState<number>(0);
  const navigate = useNavigate();

  // Function to create a thumbnail from the full image
  const createThumbnail = (dataUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        // Create a canvas to resize the image
        const canvas = document.createElement('canvas');
        // Limit dimensions to a reasonable size for thumbnail (150px)
        const MAX_WIDTH = 150;
        const MAX_HEIGHT = 150;
        
        let width = img.width;
        let height = img.height;
        
        // Calculate new dimensions while maintaining aspect ratio
        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        
        // Set canvas dimensions and draw resized image
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        
        // Get the compressed image as data URL (JPEG at 80% quality)
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      
      img.src = dataUrl;
    });
  };

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
      
      setMealName(result.name);
      setCalories(result.calories);
    } catch (error) {
      console.error('Error analyzing image:', error);
      alert('Error analyzing image. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!thumbnailImage || !mealName || calories <= 0) {
      alert('Please fill in all fields');
      return;
    }
    
    setIsSaving(true);
    
    try {
      // Save meal to server with the smaller thumbnail image
      const result = await MealsApi.add({
        name: mealName,
        calories,
        imageUrl: thumbnailImage, // Use the thumbnail instead of full-size image
        timestamp: Date.now(),
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
        <div className="mb-6">
          <label className="block text-gray-700 mb-2">
            Meal Photo
          </label>
          
          {imagePreview ? (
            <div className="relative mb-4">
              <img 
                src={imagePreview} 
                alt="Meal preview" 
                className="w-full h-48 object-cover rounded-md"
              />
              <button
                onClick={() => {
                  setImage(null);
                  setImagePreview(null);
                  setThumbnailImage(null);
                  setMealName('');
                  setCalories(0);
                }}
                className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
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
        </div>
        
        {imagePreview && !mealName && (
          <button
            onClick={analyzeImage}
            className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-6"
            disabled={isAnalyzing}
          >
            {isAnalyzing ? 'Analyzing...' : 'Analyze Food'}
          </button>
        )}
        
        {mealName && (
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="mealName" className="block text-gray-700 mb-2">
                Meal Name
              </label>
              <input
                type="text"
                id="mealName"
                value={mealName}
                onChange={(e) => setMealName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            
            <div className="mb-6">
              <label htmlFor="calories" className="block text-gray-700 mb-2">
                Calories
              </label>
              <input
                type="number"
                id="calories"
                value={calories}
                onChange={(e) => setCalories(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="1"
                required
              />
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
    </div>
  );
};

export default MealEntry; 