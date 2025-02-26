// Simple script to test API endpoints with mock data
import http from 'http';

// Helper function to make requests
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          resolve({ 
            statusCode: res.statusCode,
            headers: res.headers,
            data: parsedData 
          });
        } catch (e) {
          resolve({ 
            statusCode: res.statusCode,
            headers: res.headers,
            data: responseData 
          });
        }
      });
    });
    
    req.on('error', (e) => {
      reject(e);
    });
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Test the GET /api/meals endpoint
async function testGetAllMeals() {
  console.log('\n1. Testing GET /api/meals (all meals) endpoint:');
  const options = {
    hostname: 'localhost',
    port: 3002,
    path: '/api/meals',
    method: 'GET',
    headers: {
      'Authorization': 'Bearer mock-token'
    }
  };
  
  try {
    const response = await makeRequest(options);
    console.log(`Status code: ${response.statusCode}`);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Test the GET /api/meals/today endpoint
async function testGetTodaysMeals() {
  console.log('\n2. Testing GET /api/meals/today endpoint:');
  const options = {
    hostname: 'localhost',
    port: 3002,
    path: '/api/meals/today',
    method: 'GET',
    headers: {
      'Authorization': 'Bearer mock-token'
    }
  };
  
  try {
    const response = await makeRequest(options);
    console.log(`Status code: ${response.statusCode}`);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Test the POST /api/meals endpoint
async function testCreateMeal() {
  console.log('\n3. Testing POST /api/meals endpoint:');
  const options = {
    hostname: 'localhost',
    port: 3002,
    path: '/api/meals',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer mock-token'
    }
  };
  
  const mealData = {
    name: 'Test Pizza',
    calories: 800,
    description: 'Delicious test pizza with mock data'
  };
  
  try {
    const response = await makeRequest(options, mealData);
    console.log(`Status code: ${response.statusCode}`);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run all tests
async function runTests() {
  console.log('Starting API tests with mock data...');
  
  // Test health check endpoint first
  console.log('\nTesting health check endpoint:');
  try {
    const healthCheckResponse = await makeRequest({
      hostname: 'localhost',
      port: 3002,
      path: '/',
      method: 'GET'
    });
    console.log(`Status code: ${healthCheckResponse.statusCode}`);
    console.log('Response:', healthCheckResponse.data);
  } catch (error) {
    console.error('Health check failed:', error.message);
    console.log('Make sure the server is running on port 3002');
    return;
  }
  
  // Run the actual API tests
  await testGetAllMeals();
  await testGetTodaysMeals();
  await testCreateMeal();
  
  console.log('\nAll tests completed!');
}

// Run the tests
runTests();