// --- Essential Module Imports ---
const express = require('express');
const fs = require('fs'); // File System module to read files
const csv = require('csv-parser'); // Module to parse CSV data
const fetch = require('node-fetch'); // For making HTTP requests (npm install node-fetch@2)

// --- Express App Initialization ---
const app = express();
const PORT = process.env.PORT || 3002; // Port for the server

// --- Global Data Store for CSV ---
const plantData = []; // Array to hold plant data from CSV

// --- Configuration ---
const CSV_FILE_NAME = 'EcoCrop_DB.csv'; // Your filtered CSV file name

// --- Middleware ---
// Enable CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); // Allow GET and POST
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200); // Respond to pre-flight requests
    }
    next();
});

// Middleware to parse JSON request bodies
app.use(express.json());

// --- Read and Parse CSV File on Server Start ---
fs.createReadStream(CSV_FILE_NAME)
  .pipe(csv())
  .on('data', (row) => {
    // Process each row from the CSV
    const processedRow = {
      ScientificName: row.ScientificName,
      COMNAME: row.COMNAME,
      LIFO: row.LIFO,
      TMIN: row.TMIN !== 'NA' && row.TMIN !== '' ? parseFloat(row.TMIN) : null,
      TMAX: row.TMAX !== 'NA' && row.TMAX !== '' ? parseFloat(row.TMAX) : null,
      PHMIN: row.PHMIN !== 'NA' && row.PHMIN !== '' ? parseFloat(row.PHMIN) : null,
      PHMAX: row.PHMAX !== 'NA' && row.PHMAX !== '' ? parseFloat(row.PHMAX) : null,
    };
    plantData.push(processedRow);
  })
  .on('end', () => {
    console.log(`CSV file "${CSV_FILE_NAME}" successfully processed. Loaded ${plantData.length} records.`);
  })
  .on('error', (error) => {
    console.error(`Error reading CSV file "${CSV_FILE_NAME}":`, error.message);
    console.error('Ensure the CSV file is in the same directory as server.js or the path is correct.');
  });

// --- Basic API Endpoints for Plant Data (from CSV) ---
// Get all plant data
app.get('/api/plants', (req, res) => {
  if (plantData.length > 0) {
    res.json(plantData);
  } else {
    res.status(500).json({ error: 'Plant data is not available. Check server logs for CSV loading errors.' });
  }
});

// Search for a plant by scientific name
app.get('/api/plants/search', (req, res) => {
  const queryName = req.query.scientificname;
  if (!queryName) {
    return res.status(400).json({ error: 'Query parameter "scientificname" is required.' });
  }
  if (plantData.length === 0) {
    return res.status(500).json({ error: 'Plant data is not available.' });
  }
  const results = plantData.filter(plant =>
    plant.ScientificName && plant.ScientificName.toLowerCase().includes(queryName.toLowerCase())
  );
  if (results.length > 0) {
    res.json(results);
  } else {
    res.status(404).json({ message: 'No plants found matching your query.' });
  }
});

// --- New API Endpoint for Combined Environmental and Plant Data ---
app.post('/api/get-combined-data', async (req, res) => {
    const { latitude, longitude, plantScientificName } = req.body;

    // Validate input
    if (latitude === undefined || longitude === undefined || !plantScientificName) {
        return res.status(400).json({ error: 'Latitude, longitude, and plantScientificName are required in the request body.' });
    }

    try {
        // Step 1: Fetch/validate plant-specific data from the loaded CSV first
        const plantInfo = plantData.find(p => p.ScientificName && p.ScientificName.toLowerCase() === plantScientificName.toLowerCase());

        if (!plantInfo) {
            // If plant is not found in CSV, return an error immediately
            return res.status(404).json({ error: `Plant data not found for ${plantScientificName}. No external API calls were made.` });
        }

        // Step 2: If plant is found, then fetch data from all external environmental APIs concurrently
        const [
            nasaPowerData,
            openWeatherData,
            soilData
        ] = await Promise.all([
            fetchNasaPowerAPI(parseFloat(latitude), parseFloat(longitude)),
            fetchOpenWeatherAPI(parseFloat(latitude), parseFloat(longitude)),
            fetchSoilAPI(parseFloat(latitude), parseFloat(longitude))
        ]).catch(apiError => {
            // Catch errors from Promise.all if any of the API calls fail
            console.error("Error fetching data from one or more external APIs:", apiError.message);
            throw new Error(`API fetch error: ${apiError.message}`); // Will be caught by the outer try-catch
        });

        // Step 3: Aggregate all data into a single JSON object
        const aggregatedData = {
            location_input: { latitude, longitude },
            location_conditions: {
                nasa_power: nasaPowerData,
                open_weather: openWeatherData,
                soil_type_probabilities: soilData,
            },
            plant_requirements: { ...plantInfo } // Use spread operator for a clean copy
        };

        // Step 4: Send the combined JSON object as the response
        res.json(aggregatedData);

    } catch (error) {
        // Catch any errors that occurred during the process
        console.error("Error in /api/get-combined-data endpoint:", error.message);
        res.status(500).json({ error: 'Failed to fetch or process combined data.', details: error.message });
    }
});

// --- Helper Functions for External API Calls ---

/**
 * Fetches daily maximum temperature from NASA POWER API.
 * @param {number} latitude - The latitude for the query.
 * @param {number} longitude - The longitude for the query.
 * @returns {Promise<object>} - The T2M_MAX series data or an error object.
 */
async function fetchNasaPowerAPI(latitude, longitude) {
    // Define query parameters (adjust as needed)
    const startDate  = '20240101'; // Using a short recent range for example
    const endDate    = '20240105';
    const parameters = 'T2M_MAX';    // Daily maximum temperature at 2 meters
    const community  = 'RE';
    const format     = 'JSON';
    const baseURL = 'https://power.larc.nasa.gov/api/temporal/daily/point';
    const url = `${baseURL}?community=${community}&start=${startDate}&end=${endDate}&latitude=${latitude}&longitude=${longitude}&parameters=${parameters}&format=${format}`;

    console.log(`Fetching NASA POWER data for lat: ${latitude}, lon: ${longitude}`);
    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errBody = await response.json().catch(() => ({ message: `NASA POWER API responded with ${response.status} ${response.statusText}` }));
            console.error('NASA POWER API Error:', response.status, errBody);
            return { error: `NASA POWER API request failed: ${response.status}`, details: errBody };
        }
        const data = await response.json();
        // Return the relevant part of the data, or a more general structure if T2M_MAX isn't guaranteed
        return data.properties && data.properties.parameter ? data.properties.parameter : { error: "Parameter data not found in NASA POWER response", raw: data };
    } catch (error) {
        console.error('Error in fetchNasaPowerAPI:', error.message);
        return { error: `Failed to fetch NASA POWER data: ${error.message}` };
    }
}

/**
 * Fetches current weather data from OpenWeatherMap API.
 * @param {number} latitude - The latitude for the query.
 * @param {number} longitude - The longitude for the query.
 * @returns {Promise<object>} - The weather data or an error object.
 */
async function fetchOpenWeatherAPI(latitude, longitude) {
    // IMPORTANT: Replace with your actual API key. Store securely (e.g., environment variables).
    const APIkey = 'b667055b0a68f385a7b36f92e39f7015'; // From user's file
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${APIkey}&units=metric`;

    console.log(`Fetching OpenWeatherMap data for lat: ${latitude}, lon: ${longitude}`);
    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errBody = await response.json().catch(() => ({ message: `OpenWeatherMap API responded with ${response.status} ${response.statusText}` }));
            console.error('OpenWeatherMap API Error:', response.status, errBody);
            return { error: `OpenWeatherMap API request failed: ${response.status}`, details: errBody };
        }
        return await response.json();
    } catch (error) {
        console.error('Error in fetchOpenWeatherAPI:', error.message);
        return { error: `Failed to fetch OpenWeatherMap data: ${error.message}` };
    }
}

/**
 * Fetches soil type probabilities from Open-EPI Soil API.
 * @param {number} latitude - The latitude for the query.
 * @param {number} longitude - The longitude for the query.
 * @returns {Promise<object>} - The soil probabilities data or an error object.
 */
async function fetchSoilAPI(latitude, longitude) {
    const params = new URLSearchParams({
        lon: longitude.toString(),
        lat: latitude.toString(),
        top_k: "3" // Number of top soil type probabilities
    });
    const url = `https://api.openepi.io/soil/type?${params}`;

    console.log(`Fetching Soil API data for lat: ${latitude}, lon: ${longitude}`);
    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errBody = await response.json().catch(() => ({ message: `Soil API responded with ${response.status} ${response.statusText}` }));
            console.error('Soil API Error:', response.status, errBody);
            return { error: `Soil API request failed: ${response.status}`, details: errBody };
        }
        const data = await response.json();
        return data.properties.probabilities || { error: "Soil probability data not found in Soil API response" };
    } catch (error) {
        console.error('Error in fetchSoilAPI:', error.message);
        return { error: `Failed to fetch Soil API data: ${error.message}` };
    }
}

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Make sure "${CSV_FILE_NAME}" is in the same directory as this server file, or update the path.`);
  console.log('To test, send a POST request to /api/get-combined-data with JSON body: { "latitude": YOUR_LAT, "longitude": YOUR_LON, "plantScientificName": "YOUR_PLANT_NAME" }');
  console.log('\nExample test using curl (for Linux/macOS/Git Bash):');
  console.log(`curl -X POST -H "Content-Type: application/json" -d '{"latitude": 10.315, "longitude": 123.885, "plantScientificName": "Zea mays"}' http://localhost:${PORT}/api/get-combined-data`);
  console.log('\nExample test using Invoke-WebRequest (for Windows PowerShell):');
  console.log(`Invoke-WebRequest -Uri http://localhost:${PORT}/api/get-combined-data -Method POST -Headers @{"Content-Type"="application/json"} -Body '{"latitude": 10.315, "longitude": 123.885, "plantScientificName": "Zea mays"}'`);
});
