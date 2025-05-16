
const express = require('express');
const fs = require('fs');
const csv = require('csv-parser');
const fetch = require('node-fetch');

const { getAnalysisFromGemini } = require('./gemini'); 

// Express App Initialization 
const app = express();
const PORT = process.env.PORT || 3002;

// Global Data Store for CSV 
const plantData = [];

// --- Configuration ---
const CSV_FILE_NAME = 'EcoCrop_DB.csv'; 

// --- Middleware ---
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});
app.use(express.json());

// Read and Parse CSV File on Server Start 
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
  });

// Basic API Endpoints for Plant Data (from CSV) 
app.get('/api/plants', (req, res) => {
  if (plantData.length > 0) {
    res.json(plantData);
  } else {
    res.status(500).json({ error: 'Plant data is not available. Check server logs.' });
  }
});

app.get('/api/plants/search', (req, res) => {
  const queryScientificName = req.query.scientificname;
  const queryCommonName = req.query.commonname;

  if (!queryScientificName && !queryCommonName) {
    return res.status(400).json({ error: 'Query parameter "scientificname" or "commonname" is required.' });
  }
  if (plantData.length === 0) {
    return res.status(500).json({ error: 'Plant data is not available.' });
  }
  let results = [];
  if (queryScientificName) {
        results = plantData.filter(plant =>
            plant.ScientificName && plant.ScientificName.toLowerCase().includes(queryScientificName.toLowerCase())
        );
  } else if (queryCommonName) {
        results = plantData.filter(plant => {
            if (plant.COMNAME) {
                const commonNamesArray = plant.COMNAME.split(',').map(name => name.trim().toLowerCase());
                return commonNamesArray.some(name => name.includes(queryCommonName.toLowerCase()));
            }
            return false;
        });
  }
  if (results.length > 0) {
    res.json(results);
  } else {
    res.status(404).json({ message: 'No plants found matching your query.' });
  }
});

// API Endpoint for Combined Environmental Data and AI Analysis 
app.post('/api/get-combined-data', async (req, res) => {
    // Destructure all expected inputs from the request body
    const { latitude, longitude, plantScientificName, planDescription } = req.body;

    // Validate essential inputs
    if (latitude === undefined || longitude === undefined || !plantScientificName || !planDescription) {
        return res.status(400).json({ error: 'Latitude, longitude, plantScientificName, and planDescription are required.' });
    }

    try {
        // Find plant information from loaded CSV data
        const plantInfo = plantData.find(p => p.ScientificName && p.ScientificName.toLowerCase() === plantScientificName.toLowerCase());

        if (!plantInfo) {
            return res.status(404).json({ error: `Plant data not found for ${plantScientificName}.` });
        }

        // Fetch environmental data from external APIs concurrently
        const [
            nasaPowerData,
            openWeatherData,
            soilData
        ] = await Promise.all([
            fetchNasaPowerAPI(parseFloat(latitude), parseFloat(longitude)),
            fetchOpenWeatherAPI(parseFloat(latitude), parseFloat(longitude)),
            fetchSoilAPIWithRetry(parseFloat(latitude), parseFloat(longitude))
        ]).catch(apiError => {
            console.error("Error fetching data from one or more external APIs:", apiError.message);
            throw new Error(`External API fetch error: ${apiError.message}`);
        });

        // Step 3: Aggregate all data, including the planDescription
        const aggregatedData = {
            userInput: { // Grouping user's direct inputs
                latitude: parseFloat(latitude),
                longitude: parseFloat(longitude),
                planDescription: planDescription
            },
            location_conditions: {
                nasa_power: nasaPowerData,
                open_weather: openWeatherData,
                soil_type_probabilities: soilData,
            },
            plant_requirements: { ...plantInfo } // Plant data from CSV
        };
        
        console.log("--- Aggregated Data Prepared for Gemini ---");
        console.log(JSON.stringify(aggregatedData, null, 2)); // 
        console.log("------------------------------------");

        // Get analysis from Gemini using the aggregated data
        const geminiAnalysisResult = await getAnalysisFromGemini(aggregatedData); 

        // Send the combined response including original data and AI analysis
        res.json({
            data_summary: aggregatedData, 
            ai_analysis: geminiAnalysisResult 
        });

    } catch (error) {
        console.error("Error in /api/get-combined-data endpoint:", error.message);
        res.status(500).json({ error: 'Failed to perform suitability analysis.', details: error.message });
    }
});

// --- Helper Functions for External API Calls ---
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchNasaPowerAPI(latitude, longitude) {
    const startDate  = '20240101'; // Example: last ~year, adjust as needed
    const endDate    = new Date().toISOString().slice(0,10).replace(/-/g,""); // Today's date
    const parameters = 'T2M_MAX,T2M_MIN,T2M,PRECTOTCORR,RH2M'; // Example parameters: Max/Min/Avg Temp, Precipitation, Relative Humidity
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

async function fetchOpenWeatherAPI(latitude, longitude) {
    const APIkey = process.env.OPENWEATHER_API_KEY || 'b667055b0a68f385a7b36f92e39f7015'; // Use environment variable
    if (!APIkey || APIkey === 'b667055b0a68f385a7b36f92e39f7015') { // Check if placeholder is still used
        console.warn("OPENWEATHER_API_KEY is using a placeholder or is not set. API call might fail.");
    }
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

async function fetchSoilAPIWithRetry(latitude, longitude, retries = 3) { // Reduced default retries
    const params = new URLSearchParams({
        lon: longitude.toString(),
        lat: latitude.toString(),
        top_k: "3"
    });
    const url = `https://api.openepi.io/soil/type?${params}`;
    for (let attempt = 1; attempt <= retries; attempt++) {
        console.log(`Fetching Soil API data (Attempt ${attempt}/${retries}) for lat: ${latitude}, lon: ${longitude}`);
        try {
            const response = await fetch(url, { timeout: 7000 }); // Added timeout
            if (response.ok) {
                const data = await response.json();
                return data.properties.probabilities || { error: "Soil probability data not found (parsed)" };
            }
            const errBody = await response.json().catch(() => ({ message: `Soil API responded with ${response.status} on attempt ${attempt}` }));
            console.error(`Soil API Error (Attempt ${attempt}/${retries}):`, response.status, errBody);
            if (attempt === retries) return { error: `Soil API failed after ${retries} attempts: ${response.status}`, details: errBody };
            await delay(attempt * 1500); // Slightly increased delay
        } catch (error) {
            console.error(`Fetch Error in fetchSoilAPIWithRetry (Attempt ${attempt}/${retries}):`, error.message);
            if (attempt === retries) return { error: `Soil API fetch failed after ${retries} attempts: ${error.message}` };
            await delay(attempt * 1500);
        }
    }
    return { error: `Soil API request failed exhaustively after ${retries} attempts.` };
}

// Start Server 
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`To test, send a POST request to /api/get-combined-data with JSON body including: latitude, longitude, plantScientificName, and planDescription.`);
});