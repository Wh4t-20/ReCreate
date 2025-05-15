require('dotenv').config();  

const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const agriculturalAnalystSystemInstruction = `

You are an expert agricultural and horticultural analyst.
Your primary task is to assess the suitability of growing a specific plant at a given location.
You will be provided with a JSON object containing 'location_input' (latitude, longitude),
'location_conditions' (data from various environmental APIs like NASA POWER, OpenWeatherMap, Open-EPI Soil),
and 'plant_requirements' (data for the specific plant from a database).

Based on ALL the provided data in the JSON, you must provide a comprehensive analysis.
Your response should be structured as follows:
1.  **Overall Suitability Analysis:** A detailed textual analysis discussing how the environmental conditions align with the plant's requirements.
2.  **Feasibility Score (1-10):** Provide a score (1=not feasible, 10=highly feasible) and clearly explain your reasoning based on the data.
3.  **Sustainability Score (1-10):** Provide a score (1=not sustainable, 10=highly sustainable) for long-term cultivation. Explain your reasoning, considering potential environmental impacts or resource needs implied by the data.
4.  **Key Supporting Factors:** A bulleted list of factors from the data that support suitability.
5.  **Potential Challenges/Risks:** A bulleted list of potential challenges or risks indicated by the data.
6.  **Actionable Recommendations:** A bulleted list of specific, actionable recommendations for a farmer or grower.

Important Guidelines:
- Focus your analysis SOLELY on the data provided in the JSON. Do not invent data.
- If data for a specific environmental factor (e.g., from NASA POWER, OpenWeather, or Soil API) indicates an error or is missing (e.g., an error object is present in the JSON for that source, or a value is null/undefined), you MUST acknowledge this limitation in your analysis. Explain how the missing or erroneous data impacts the certainty or completeness of your assessment for that factor.
- Be concise but thorough in your explanations. Aim for clear, actionable insights.
- Do not repeat phrases like "Based on the JSON provided" excessively. Assume the JSON is your sole source of information.
- Structure your output clearly using the numbered and bulleted list format above.

Sample format of the JSON you will be receiving (use this as reference to see what each data mean when receing JSON):
{
  "location_input": { // Just shows the current location
    "latitude": 123.885,
    "longitude": 10.315
  },
  "location_conditions": {
    "nasa_power": {
      "T2M_MAX": {  // Gives out the 5 values for max temperature in that area
        "20240101": 29.51,
        "20240102": 29.67,
        "20240103": 29.67,
        "20240104": 29.03,
        "20240105": 29.95
      }
    },
    "open_weather": {
      "coord": { // Just shows location
        "lon": 123.885,
        "lat": 10.315
      },
      "weather": [
        {
          "id": 801,
          "main": "Clouds",
          "description": "few clouds", // Shows how much clouds
          "icon": "02n"
        }
      ],
      "base": "stations",
      "main": { // Shows all these data in that area
        "temp": 24.75,
        "feels_like": 25.45,
        "temp_min": 24.75,
        "temp_max": 24.75,
        "pressure": 1009,
        "humidity": 83,
        "sea_level": 1009,
        "grnd_level": 991
      },
      "visibility": 10000,
      "wind": {
        "speed": 0.78,
        "deg": 116,
        "gust": 1.04
      },
      "clouds": {
        "all": 16
      },
      "dt": 1747067838,
      "sys": {
        "country": "PH",
        "sunrise": 1747085008,
        "sunset": 1747130296
      },
      "timezone": 28800,
      "id": 1717512, 
      "name": "Cebu City",
      "cod": 200
    },
    "soil_type_probabilities": [ // Shows the top 3 most possible soil types for that location
      {
        "soil_type": "Acrisols",
        "probability": 17
      },
      {
        "soil_type": "Ferralsols",
        "probability": 13
      },
      {
        "soil_type": "Gleysols",
        "probability": 12
      }
    ]
  },
  "plant_requirements": {
    "ScientificName": // Scientific name of plant
    "COMMNAME": // Common names of the plant
    "LIFO": "", // Type of plant: (like herb, tree, shrub, etc.)
    "TMIN": 10, // Temperature min in degrees C
    "TMAX": 47, // Temperature max in degrees C
    "PHMIN": 4.5, // pH min of plant
    "PHMAX": 8.5  // pH max of plant
  }
}
  When generating the response, make sure to make use of actual words instead of abbreviations or shortcuts
  like (TMAX, TMIN), use words such as "Max Temperature" or "Minimum Temperature" to ensure that the user 
  understsands what you mean.
`;

const generationConfig = {
    maxOutputTokens: 10000, // Example: Maximum number of tokens to generate. Adjust as needed.
    temperature: 0.1,      // Controls randomness. Lower values (e.g., 0.2-0.5) make output more focused and deterministic. Higher values (e.g., 0.8-1.0) make it more creative.
    topK: 32,              // Example: Considers the top K most likely tokens at each step.
    topP: 0.8,            
};

const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash", 
    systemInstruction: agriculturalAnalystSystemInstruction,
    generationConfig: generationConfig,
});

function constructUserPrompt(aggregatedData) {
    const jsonDataString = JSON.stringify(aggregatedData, null, 2); // Pretty-print JSON
    return `
Please analyze the following data based on your configured instructions:
\`\`\`json
${jsonDataString}
\`\`\`
    `;
}

/**
 * Gets analysis from the configured Gemini model.
 * @param {object} aggregatedData - The combined data object from server.js.
 * @returns {Promise<object>} - An object containing the analysis text or an error.
 */
async function getAnalysisFromGemini(aggregatedData) {
    if (!model) { // Check if the model was initialized successfully
        console.warn("GEMINI_ANALYZER: Model not initialized (API key likely missing/invalid). Returning placeholder response.");
        return {
            analysis_text: "PLACEHOLDER from geminiAnalyzer.js: Gemini model not available (API Key likely not configured). This is a simulated response.",
            success: false,
            error: "Gemini model not initialized in geminiAnalyzer.js"
        };
    }

    // Construct the user-specific part of the prompt using the aggregated data
    const userPrompt = constructUserPrompt(aggregatedData);

    console.log("\n--- GEMINI_ANALYZER: Sending user prompt to Gemini model ---");
    // console.log(userPrompt); // Uncomment to log the full data payload being sent

    try {
        console.log("GEMINI_ANALYZER: Attempting to generate content with Gemini model...");
        const result   = await model.generateContent(userPrompt);
        const response = await result.response;
        const text     = await response.text();

        console.log("\n--- GEMINI_ANALYZER: Raw Text Response from Gemini ---");
        console.log(text);

        return { analysis_text: text, success: true };

    } catch (error) {
        console.error("GEMINI_ANALYZER_ERROR: Calling Gemini API failed:", error.message);
        // Provide more context if available from the error object (e.g., safety ratings)
        let errorDetails = error.message;
        if (error.response && error.response.candidates && error.response.candidates.length > 0) {
            const candidate = error.response.candidates[0];
            if (candidate.finishReason && candidate.finishReason !== 'STOP' && candidate.safetyRatings) {
                errorDetails += ` Finish Reason: ${candidate.finishReason}, Safety Ratings: ${JSON.stringify(candidate.safetyRatings)}`;
            }
        } else if (error.message && error.message.toLowerCase().includes("api key not valid")) {
            errorDetails = "Gemini API key not valid. Please check your API key configuration.";
        }
        return { error: "Failed to get analysis from Gemini AI.", details: errorDetails, success: false };
    }
}

// Export the main function so server.js can use it
module.exports = {
    getAnalysisFromGemini
};
