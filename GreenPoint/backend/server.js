// server.js

// --- Essential Module Imports ---
const express = require('express');
const fs = require('fs');
const csv = require('csv-parser');
const fetch = require('node-fetch');
// Import Gemini analysis function
const { getAnalysisFromGemini } = require('./gemini');

// --- Express App Initialization ---
const app = express();
const PORT = process.env.PORT || 3002;

// --- Global Data Store for CSV ---
const plantData = [];

// --- Configuration ---
const CSV_FILE_NAME = 'EcoCrop_DB.csv'; 

// --- Middleware ---
// Enable CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Middleware to parse JSON request bodies
app.use(express.json());

// --- Read and Parse CSV File on Server Start ---
fs.createReadStream(CSV_FILE_NAME)
  .pipe(csv())
  .on('data', (row) => {
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
app.get('/api/plants', (req, res) => {
  if (plantData.length > 0) {
    res.json(plantData);
  } else {
    res.status(500).json({ error: 'Plant data is not available. Check server logs for CSV loading errors.' });
  }
});

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

// --- API Endpoint for Combined Environmental and Plant Data ---
app.post('/api/get-combined-data', async (req, res) => {
    const { latitude, longitude, plantScientificName } = req.body;

    if (latitude === undefined || longitude === undefined || !plantScientificName) {
        return res.status(400).json({ error: 'Latitude, longitude, and plantScientificName are required in the request body.' });
    }

    try {
        // Step 1: Find plant information from CSV data
        const plantInfo = plantData.find(p => p.ScientificName && p.ScientificName.toLowerCase() === plantScientificName.toLowerCase());

        if (!plantInfo) {
            return res.status(404).json({ error: `Plant data not found for ${plantScientificName}. No external API calls were made.` });
        }

        // Step 2: Fetch environmental data from external APIs concurrently
        const [
            nasaPowerData,
            openWeatherData,
            soilData
        ] = await Promise.all([
            fetchNasaPowerAPI(parseFloat(latitude), parseFloat(longitude)),
            fetchOpenWeatherAPI(parseFloat(latitude), parseFloat(longitude)),
            fetchSoilAPIWithRetry(parseFloat(latitude), parseFloat(longitude)) // Using the new retry function
        ]).catch(apiError => {
            console.error("Error fetching data from one or more external APIs:", apiError.message);
            throw new Error(`API fetch error: ${apiError.message}`);
        });

        // Step 3: Aggregate all data
        const aggregatedData = {
            location_input: { latitude, longitude },
            location_conditions: {
                nasa_power: nasaPowerData,
                open_weather: openWeatherData,
                soil_type_probabilities: soilData,
            },
            plant_requirements: { ...plantInfo }
        };
        console.log("--- Aggregated Data for Response ---");
        console.log(JSON.stringify(aggregatedData, null, 2));
        console.log("------------------------------------");

        // Step 4: Get analysis from Gemini
        const geminiResult = await getAnalysisFromGemini(aggregatedData);

        // Step 5: Send the combined JSON response with analysis included
        res.json({
            aggregatedData,
            analysis: geminiResult
        });

    } catch (error) {
        console.error("Error in /api/get-combined-data endpoint:", error.message);
        res.status(500).json({ error: 'Failed to fetch or process combined data.', details: error.message });
    }
});

// --- Helper Functions for External API Calls ---

/**
 * Utility function for creating a delay.
 * @param {number} ms - The delay in milliseconds.
 * @returns {Promise<void>}
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetches daily maximum temperature from NASA POWER API.
 * @param {number} latitude - The latitude for the query.
 * @param {number} longitude - The longitude for the query.
 * @returns {Promise<object>} - The parameter data from NASA POWER or an error object.
 */
async function fetchNasaPowerAPI(latitude, longitude) {
    const startDate  = '20240101'; // Example date range
    const endDate    = '20240105';
    const parameters = 'T2M_MAX';
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
    const APIkey = 'b667055b0a68f385a7b36f92e39f7015'; // Store securely in production (e.g., env variable)
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
 * Fetches soil type probabilities from Open-EPI Soil API with retry logic.
 * @param {number} latitude - The latitude for the query.
 * @param {number} longitude - The longitude for the query.
 * @param {number} retries - Number of retry attempts.
 * @returns {Promise<object>} - The soil probabilities data or an error object.
 */
async function fetchSoilAPIWithRetry(latitude, longitude, retries = 5) {
    const params = new URLSearchParams({
        lon: longitude.toString(),
        lat: latitude.toString(),
        top_k: "3"
    });
    const url = `https://api.openepi.io/soil/type?${params}`;

    for (let attempt = 1; attempt <= retries; attempt++) {
        console.log(`Fetching Soil API data (Attempt ${attempt}/${retries}) for lat: ${latitude}, lon: ${longitude}`);
        try {
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                return data.properties.probabilities || { error: "Soil probability data not found in Soil API response (even after parsing)" };
            }
            const errBody = await response.json().catch(() => ({ message: `Soil API responded with ${response.status} ${response.statusText} on attempt ${attempt}` }));
            console.error(`Soil API Error (Attempt ${attempt}/${retries}):`, response.status, errBody);

            if (attempt === retries) {
                return { error: `Soil API request failed after ${retries} attempts: ${response.status}`, details: errBody };
            }
            const delayTime = attempt * 1000;
            console.log(`Waiting ${delayTime / 1000}s before retrying Soil API...`);
            await delay(delayTime);

        } catch (error) {
            console.error(`Error in fetchSoilAPIWithRetry (Attempt ${attempt}/${retries}):`, error.message);
            if (attempt === retries) {
                return { error: `Failed to fetch Soil API data after ${retries} attempts: ${error.message}` };
            }
            const delayTime = attempt * 1000;
            console.log(`Waiting ${delayTime / 1000}s before retrying Soil API due to fetch error...`);
            await delay(delayTime);
        }
    }
    return { error: `Soil API request failed exhaustively after ${retries} attempts.` };
}


// --- Start Server ---
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log('To test, send a POST request to /api/get-combined-data with JSON body: { "latitude": YOUR_LAT, "longitude": YOUR_LON, "plantScientificName": "YOUR_PLANT_NAME" }');
  console.log(`curl -X POST -H "Content-Type: application/json" -d '{"latitude": 10.315, "longitude": 123.885, "plantScientificName": "Zea mays"}' http://localhost:${PORT}/api/get-combined-data`);
  console.log('\nExample test using Invoke-WebRequest (for Windows PowerShell):');
  console.log(`Invoke-WebRequest -Uri http://localhost:${PORT}/api/get-combined-data -Method POST -Headers @{"Content-Type"="application/json"} -Body '{"latitude": 10.315, "longitude": 123.885, "plantScientificName": "Zea mays"}'`);
});
