import React, { useEffect, useState } from 'react';

interface LoadingOverlayProps {
  isVisible: boolean;
  message?: string;
}

// Giphy API key
const GIPHY_API_KEY = 'zr2sIKljSeKLeZYjULAboXpppwezwDeQ';

// Food-related search terms for Giphy
const FOOD_SEARCH_TERMS = ['food', 'eating', 'cooking', 'delicious', 'yummy', 'chef', 'meal'];

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ isVisible, message = 'Analyzing your meal...' }) => {
  const [currentGif, setCurrentGif] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Fetch a random food-related GIF from Giphy
  const fetchRandomFoodGif = async () => {
    try {
      setIsLoading(true);
      
      // Get a random search term from our food-related terms
      const randomTerm = FOOD_SEARCH_TERMS[Math.floor(Math.random() * FOOD_SEARCH_TERMS.length)];
      
      // Fetch from Giphy API using the search endpoint and limit to 25 results
      const response = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${randomTerm}&limit=25&rating=g`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch GIF from Giphy');
      }
      
      const data = await response.json();
      
      // If we have results, pick a random GIF from the response
      if (data.data && data.data.length > 0) {
        const randomIndex = Math.floor(Math.random() * data.data.length);
        const gifData = data.data[randomIndex];
        
        // Use the downsized version for better loading performance
        if (gifData.images && gifData.images.downsized) {
          setCurrentGif(gifData.images.downsized.url);
        } else {
          setCurrentGif(gifData.images.original.url);
        }
      }
    } catch (error) {
      console.error('Error fetching GIF:', error);
      // Fallback to a static GIF in case of error
      setCurrentGif('https://i.imgur.com/4YBwGF0.gif');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isVisible) {
      // Fetch a new GIF when the overlay becomes visible
      fetchRandomFoodGif();
    }
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex flex-col items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg max-w-md w-full text-center shadow-xl">
        <div className="mb-4 h-64 flex items-center justify-center">
          {isLoading ? (
            <div className="animate-spin h-16 w-16 border-4 border-blue-500 rounded-full border-t-transparent"></div>
          ) : (
            <img 
              src={currentGif} 
              alt="Food animation" 
              className="mx-auto rounded-md max-h-64 object-contain"
            />
          )}
        </div>
        
        <h3 className="text-lg font-semibold mb-2">{message}</h3>
        
        <div className="flex items-center justify-center mt-4">
          <div className="animate-spin h-5 w-5 border-2 border-blue-500 rounded-full border-t-transparent mr-2"></div>
          <p className="text-gray-600">This might take a moment...</p>
        </div>
        
        <div className="mt-2 text-xs text-gray-400">
          <span>Powered by </span>
          <a 
            href="https://giphy.com/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="underline"
          >
            GIPHY
          </a>
        </div>
      </div>
    </div>
  );
};

export default LoadingOverlay; 