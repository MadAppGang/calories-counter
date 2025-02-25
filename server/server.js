// Load environment variables from .env file
import { config } from 'dotenv';
config();

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { streamText } from 'hono/streaming';
import path from 'path';
import fs from 'fs';
import { Anthropic } from '@anthropic-ai/sdk';
import sharp from 'sharp';

// Get environment variables
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const port = parseInt(process.env.PORT || '3002', 10);

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads/')) {
  fs.mkdirSync('uploads/');
}

// Helper function to get MIME type from file extension
function getMimeTypeFromExtension(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.tiff': 'image/tiff',
    '.tif': 'image/tiff'
  };

  return mimeTypes[ext] || 'image/png'; // Default to PNG if unknown
}

// Helper function to save uploaded file
async function saveUploadedFile(file, filename) {
  const filePath = path.join('uploads', filename);

  try {
    // With Bun, we can directly use the arrayBuffer() method
    if (typeof file.arrayBuffer === 'function') {
      const buffer = Buffer.from(await file.arrayBuffer());
      await fs.promises.writeFile(filePath, buffer);
      return filePath;
    }

    // Fallback for other environments
    console.log('Using fallback file writing method');
    await fs.promises.writeFile(filePath, file.stream);
    return filePath;
  } catch (error) {
    console.error('Error saving file:', error);
    throw new Error(`Failed to save file: ${error.message}`);
  }
}

// Helper function to validate image and check size
async function validateImage(filePath) {
  try {
    const stats = await fs.promises.stat(filePath);
    const fileSizeInMB = stats.size / (1024 * 1024);

    // Claude has a limit around 5MB for images, we'll use 4.5MB to be safe
    if (fileSizeInMB > 4.5) {
      throw new Error(`Image too large (${fileSizeInMB.toFixed(2)}MB). Maximum size is 4.5MB.`);
    }

    // Ensure the file is not empty
    if (stats.size === 0) {
      throw new Error('Image file is empty.');
    }

    return {
      valid: true,
      size: stats.size,
      sizeInMB: fileSizeInMB
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message
    };
  }
}

// Helper function to process image with Sharp for Claude compatibility
async function processImageForClaude(inputPath, originalMimeType) {
  // Determine output format (JPEG or PNG are safest for Claude)
  let format = 'jpeg';
  let mimeType = 'image/jpeg';

  // Use PNG for images that need transparency or are originally PNG
  if (originalMimeType === 'image/png') {
    format = 'png';
    mimeType = 'image/png';
  }

  const outputPath = `${inputPath}.processed.${format}`;

  try {
    // Process with Sharp
    await sharp(inputPath)
      .toFormat(format, { quality: 90 }) // Use good quality but not maximum
      .toFile(outputPath);

    console.log(`Processed image saved to ${outputPath}`);

    return {
      success: true,
      path: outputPath,
      mimeType: mimeType
    };
  } catch (error) {
    console.error('Error processing image with Sharp:', error);
    return {
      success: false,
      error: error.message,
      // Return original path and mime type as fallback
      path: inputPath,
      mimeType: originalMimeType
    };
  }
}

// Create Hono app
const app = new Hono();

// Middleware
app.use('*', logger());
app.use('*', prettyJSON());
app.use('*', cors());

// Health check endpoint
app.get('/', (c) => c.text('Calorie Tracker API is running'));

// Analyze image endpoint with Claude AI integration
app.post('/api/analyze-image', async (c) => {
  try {
    const formData = await c.req.formData();
    const imageFile = formData.get('image');

    if (!imageFile) {
      return c.json({ success: false, message: 'No image uploaded' }, 400);
    }

    // Check if API key is available in environment
    if (!CLAUDE_API_KEY) {
      return c.json({
        success: false,
        message: 'Server configuration error: API key not available'
      }, 500);
    }

    let originalFilePath = null;
    let processedFilePath = null;

    try {
      // Generate a unique filename
      const fileExt = imageFile.name ? path.extname(imageFile.name) : '.png';
      const filename = `${Date.now()}${fileExt}`;

      console.log(`Processing uploaded file: ${imageFile.name || 'unnamed'} (${fileExt})`);

      // Save the uploaded file
      originalFilePath = await saveUploadedFile(imageFile, filename);

      // Validate the image
      const validation = await validateImage(originalFilePath);
      if (!validation.valid) {
        return c.json({
          success: false,
          message: `Invalid image: ${validation.error}`
        }, 400);
      }

      console.log(`Image validated: ${validation.sizeInMB.toFixed(2)}MB`);

      // Get MIME type from file or use extension-based detection
      let originalMimeType = imageFile.type;

      // If mimetype is missing or is octet-stream, try to determine from extension
      if (!originalMimeType || originalMimeType === 'application/octet-stream') {
        originalMimeType = getMimeTypeFromExtension(originalFilePath);
      }

      // Process the image to ensure it's in a Claude-compatible format
      const processedImage = await processImageForClaude(originalFilePath, originalMimeType);

      if (!processedImage.success) {
        console.warn(`Image processing warning: ${processedImage.error}. Using original image.`);
      } else {
        processedFilePath = processedImage.path;
      }

      // Use Claude AI to analyze the image
      const result = await analyzeImageWithClaude(
        processedImage.success ? processedImage.path : originalFilePath,
        processedImage.success ? processedImage.mimeType : originalMimeType
      );

      if (result.success) {
        return c.json({
          success: true,
          name: result.name,
          calories: result.calories,
          message: "Food analyzed with AI"
        });
      } else {
        // If analysis fails, return error
        console.error('Claude AI analysis failed:', result.error);
        return c.json({
          success: false,
          message: 'Failed to analyze image: ' + result.error
        }, 500);
      }
    } catch (apiError) {
      console.error('API recognition error:', apiError);
      return c.json({
        success: false,
        message: 'API error: ' + apiError.message
      }, 500);
    } finally {
      // Clean up - delete all temp files
      try {
        if (originalFilePath && fs.existsSync(originalFilePath)) {
          fs.unlinkSync(originalFilePath);
        }
        if (processedFilePath && fs.existsSync(processedFilePath)) {
          fs.unlinkSync(processedFilePath);
        }
      } catch (err) {
        console.warn('Failed to delete temporary files:', err);
      }
    }
  } catch (error) {
    console.error('Error analyzing image:', error);
    return c.json({ success: false, message: 'Server error' }, 500);
  }
});

// Stream the analysis for real-time updates (optional feature)
app.post('/api/analyze-stream', async (c) => {
  try {
    const formData = await c.req.formData();
    const imageFile = formData.get('image');

    if (!imageFile) {
      return c.json({ success: false, message: 'No image uploaded' }, 400);
    }

    // Check if API key is available in environment
    if (!CLAUDE_API_KEY) {
      return c.json({
        success: false,
        message: 'Server configuration error: API key not available'
      }, 500);
    }

    return streamText(c, async (stream) => {
      let originalFilePath = null;
      let processedFilePath = null;

      try {
        await stream.write('Starting analysis...\n');

        // Save the uploaded file
        const fileExt = imageFile.name ? path.extname(imageFile.name) : '.png';
        const filename = `${Date.now()}${fileExt}`;
        await stream.write('Saving uploaded file...\n');
        originalFilePath = await saveUploadedFile(imageFile, filename);

        // Validate image
        const validation = await validateImage(originalFilePath);
        if (!validation.valid) {
          await stream.write(`Error: Invalid image - ${validation.error}\n`);
          return;
        }

        await stream.write(`Image validated: ${validation.sizeInMB.toFixed(2)}MB\n`);

        // Get MIME type
        let originalMimeType = imageFile.type;
        if (!originalMimeType || originalMimeType === 'application/octet-stream') {
          originalMimeType = getMimeTypeFromExtension(originalFilePath);
        }

        // Process the image
        await stream.write('Processing image for compatibility...\n');
        const processedImage = await processImageForClaude(originalFilePath, originalMimeType);

        if (!processedImage.success) {
          await stream.write(`Warning: Image processing failed - ${processedImage.error}. Using original image.\n`);
        } else {
          processedFilePath = processedImage.path;
          await stream.write(`Image processed successfully. Format: ${processedImage.mimeType}\n`);
        }

        // Analyze image
        await stream.write('Sending to Claude AI for analysis...\n');
        const result = await analyzeImageWithClaude(
          processedImage.success ? processedImage.path : originalFilePath,
          processedImage.success ? processedImage.mimeType : originalMimeType
        );

        if (result.success) {
          await stream.write(`Analysis complete!\n`);
          await stream.write(`Food: ${result.name}\n`);
          await stream.write(`Calories: ${result.calories}\n`);
          await stream.write(JSON.stringify({
            success: true,
            name: result.name,
            calories: result.calories
          }, null, 2));
        } else {
          await stream.write(`Analysis failed: ${result.error}\n`);
        }
      } catch (error) {
        await stream.write(`Error: ${error.message}\n`);
      } finally {
        // Clean up
        try {
          if (originalFilePath && fs.existsSync(originalFilePath)) {
            fs.unlinkSync(originalFilePath);
          }
          if (processedFilePath && fs.existsSync(processedFilePath)) {
            fs.unlinkSync(processedFilePath);
          }
        } catch (err) {
          console.warn('Failed to delete temporary files:', err);
        }
      }
    });
  } catch (error) {
    console.error('Error in stream analysis:', error);
    return c.json({ success: false, message: 'Server error' }, 500);
  }
});

// Function to analyze image with Claude AI
async function analyzeImageWithClaude(imagePath, mimeType) {
  try {
    // Initialize Anthropic client with the API key from environment
    const anthropic = new Anthropic({
      apiKey: CLAUDE_API_KEY,
    });

    // Validate that the file exists
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image file not found: ${imagePath}`);
    }

    // Read the image file
    const imageBuffer = fs.readFileSync(imagePath);

    // Verify the buffer is not empty
    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error('Image buffer is empty');
    }

    // Get image info before encoding
    console.log(`Raw image size: ${(imageBuffer.length / 1024).toFixed(2)}KB`);

    // Make sure image is not too large (Claude has ~10MB limit for all content)
    const maxSizeBytes = 4 * 1024 * 1024; // 4MB
    if (imageBuffer.length > maxSizeBytes) {
      console.log(`Image too large (${(imageBuffer.length / 1024 / 1024).toFixed(2)}MB), compressing...`);

      // Use sharp to resize and compress the image
      const format = mimeType.includes('png') ? 'png' : 'jpeg';
      const compressedImageBuffer = await sharp(imageBuffer)
        .resize({ width: 1280, fit: 'inside', withoutEnlargement: true })
        .toFormat(format, { quality: 80 })
        .toBuffer();

      console.log(`Compressed from ${(imageBuffer.length / 1024).toFixed(2)}KB to ${(compressedImageBuffer.length / 1024).toFixed(2)}KB`);

      // Use the compressed buffer instead
      if (compressedImageBuffer.length < imageBuffer.length) {
        console.log(`Using compressed image`);
        // Convert to base64
        const base64Image = compressedImageBuffer.toString('base64');

        // Use the provided MIME type, but strictly limit to supported types
        // According to Anthropic docs, only these media types are supported
        const supportedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        let mediaType = supportedTypes.includes(mimeType) ? mimeType : 'image/jpeg';
        if (format === 'png') mediaType = 'image/png';
        if (format === 'jpeg') mediaType = 'image/jpeg';

        return await sendImageToAnthropicAPI(anthropic, base64Image, mediaType);
      }
    }

    // If we didn't compress or compression wasn't effective, use original image
    // Convert to base64
    const base64Image = imageBuffer.toString('base64');

    // Verify base64 data is valid
    if (!base64Image || base64Image.length === 0) {
      throw new Error('Generated base64 image data is empty');
    }

    // Use the provided MIME type, but strictly limit to supported types
    // According to Anthropic docs, only these media types are supported
    const supportedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    let mediaType = supportedTypes.includes(mimeType) ? mimeType : 'image/jpeg';

    // For debugging
    console.log(`Using media type: ${mediaType} for Claude API request`);
    console.log(`Base64 length: ${base64Image.length} characters`);

    return await sendImageToAnthropicAPI(anthropic, base64Image, mediaType);
  } catch (error) {
    console.error('Error in Claude AI analysis:', error);
    return {
      success: false,
      error: error.message || 'Unknown error in Claude analysis'
    };
  }
}

// Helper function to send image to Anthropic API and process response
async function sendImageToAnthropicAPI(anthropic, base64Image, mediaType) {
  try {
    // Create the message with image content, following exactly the Anthropic documentation format
    const response = await anthropic.messages.create({
      model: "claude-3-sonnet-20240229",
      max_tokens: 1000,
      temperature: 0.7,
      system: "You are a food analysis assistant that helps identify foods and estimate their caloric content.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Please analyze this food image. Identify what food item(s) are in the image and estimate the calorie count. Return your response in JSON format with two fields: 'name' (a brief description of the food) and 'calories' (your estimate of calories as a number)."
            },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64Image
              }
            }
          ]
        }
      ]
    });

    // Parse Claude's response to extract the JSON data
    const claudeResponse = response.content[0].text;
    console.log('Claude response received successfully');

    // Extract the JSON part from Claude's response
    // This regex looks for a JSON object anywhere in the text
    const jsonMatch = claudeResponse.match(/\{[\s\S]*"name"[\s\S]*"calories"[\s\S]*\}/);

    if (jsonMatch) {
      try {
        // Parse the extracted JSON
        const parsedResponse = JSON.parse(jsonMatch[0]);

        return {
          success: true,
          name: parsedResponse.name,
          calories: parseInt(parsedResponse.calories, 10) || 0
        };
      } catch (jsonError) {
        console.error('Error parsing Claude response as JSON:', jsonError);
      }
    }

    // If JSON extraction fails, attempt to parse the response differently
    // Look for patterns like "name: Pizza" and "calories: 350"
    const nameMatch = claudeResponse.match(/name[:\s]+([^,\n\.]+)/i);
    const caloriesMatch = claudeResponse.match(/calories[:\s]+(\d+)/i);

    if (nameMatch && caloriesMatch) {
      return {
        success: true,
        name: nameMatch[1].trim(),
        calories: parseInt(caloriesMatch[1], 10) || 0
      };
    }

    return {
      success: false,
      error: 'Could not parse Claude response'
    };
  } catch (claudeError) {
    console.error('Error calling Claude API:', claudeError);

    // Try to extract the detailed error message
    let errorMessage = 'Unknown Claude API error';
    if (claudeError.response && claudeError.response.body) {
      errorMessage = JSON.stringify(claudeError.response.body);
    } else if (claudeError.message) {
      errorMessage = claudeError.message;
    }

    return {
      success: false,
      error: errorMessage
    };
  }
}

// Start the server using Bun's native HTTP capabilities
console.log(`Starting server on port ${port}...`);

// Directly use Bun's serve functionality with Hono
export default {
  port,
  fetch: app.fetch
};

// Log successful startup and API key status
console.log(`Server running on port ${port}`);
if (!CLAUDE_API_KEY) {
  console.warn('Warning: CLAUDE_API_KEY environment variable is not set. The API will not function properly.');
} 