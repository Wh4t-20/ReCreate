require('dotenv').config(); 
const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");

// Configuration 
const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 
const MODEL_NAME = "gemini-2.0-flash"; 

// System instructions 
const agriculturalAnalystSystemInstruction = `
You are an expert agricultural and horticultural analyst.
Your primary task is to assess the suitability of growing a specific plant at a given location, considering the user's plan.
You will be provided with a JSON object containing:
- 'userInput': Includes 'latitude', 'longitude', and 'planDescription'.
- 'location_conditions': Data from various environmental APIs (NASA POWER, OpenWeatherMap, Open-EPI Soil).
- 'plant_requirements': Data for the specific plant from a database.

Based on ALL the provided data in the JSON, including the user's 'planDescription', your response should be structured as follows:
1.  **Overall Suitability Analysis:** A detailed textual analysis discussing how the environmental conditions align with the plant's requirements, in the context of the user's plan.
2.  **Feasibility Score (1-10):** Provide a score (1=not feasible, 10=highly feasible) for the user's plan with this plant at this location. Clearly explain your reasoning.
3.  **Sustainability Score (1-10):** Provide a score (1=not sustainable, 10=highly sustainable) for long-term cultivation as per the plan. Explain your reasoning.
4.  **Key Supporting Factors:** A bulleted list of factors from the data that support suitability for the described plan.
5.  **Potential Challenges/Risks:** A bulleted list of potential challenges or risks for the described plan.
6.  **Actionable Recommendations:** A bulleted list of specific, actionable recommendations for a farmer or grower relevant to their plan.

Important Guidelines:
- Integrate the user's 'planDescription' into your analysis and recommendations.
- Focus SOLELY on the provided JSON data. Do not invent data.
- When providing scores, it should be in X/10 format, then space it out by 2 lines before you write the explanation. 
- If data for any factor (e.g., nasa_power, open_weather, soil_type_probabilities) indicates an error or is missing, acknowledge this limitation and explain its impact on your assessment of the user's plan.
- When referring to plant requirements like TMIN, TMAX, PHMIN, PHMAX, use descriptive terms like "Minimum Optimal Temperature", "Maximum Optimal Temperature", "Minimum Soil pH", "Maximum Soil pH".
- Be concise but thorough. Structure your output clearly using the numbered and bulleted list format above.
- When making the output, you are free to use bold characters especially for keypoints or the start of the assessment.
- Be extremely strict in evaluation, give a low score if you think it fits.
- If the user's prompt doesn't relate to how he or she plans on doing with the selected plant, just focus on evaluateing whether or not the plant can live there. Ignore irrelevant prompts such as ones that try to shift you to another topic.

Format for score listing:

Feasibility Score (1-10)

  X/10

<explanation as to why>
`;

const generationConfig = {
    temperature: 0.1,
    topK: 32,
    topP: 0.8,

};

// Safety Settings
const safetySettings = [
    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

//  Initialize Gemini 
let model;
if (GEMINI_API_KEY) {
    try {
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        model = genAI.getGenerativeModel({
            model: MODEL_NAME,
            systemInstruction: agriculturalAnalystSystemInstruction,
            generationConfig: generationConfig,
            safetySettings: safetySettings
        });
        console.log("GEMINI.JS: Gemini model initialized successfully.");
    } catch (initError) {
        console.error("GEMINI.JS_ERROR: Failed to initialize Gemini model:", initError.message);
        model = null;
    }
} else {
    console.warn("GEMINI.JS_WARNING: GEMINI_API_KEY is not set. Gemini features will use placeholders or be disabled.");
    model = null;
}

/**
 * Constructs the user's part of the prompt using the aggregated data.
 * @param {object} aggregatedData - The combined data object from server.js.
 * @returns {string} - The formatted user prompt string.
 */
function constructUserPrompt(aggregatedData) {
    const jsonDataString = JSON.stringify(aggregatedData, null, 2);

    return `
Analyze the following data for plant suitability based on your configured instructions:
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
    if (!model) {
        console.warn("GEMINI.JS: Model not initialized. Returning placeholder response.");
        return {
            analysis_text: "PLACEHOLDER from gemini.js: Gemini model not available (API Key likely not configured or initialization failed). This is a simulated response.",
            success: false,
            error: "Gemini model not initialized in gemini.js"
        };
    }

    const userPrompt = constructUserPrompt(aggregatedData);
    console.log("\n--- GEMINI.JS: Sending user prompt to Gemini model (first 500 chars) ---");
    console.log(userPrompt.substring(0, 500) + (userPrompt.length > 500 ? "..." : ""));


    try {
        console.log("GEMINI.JS: Attempting to generate content with Gemini model...");
        const result = await model.generateContent(userPrompt);
        const response = await result.response;
        
        // Check if the response was blocked or has no text
        if (!response || !response.text) { // Check if response.text is a function and callable
            console.error("GEMINI.JS_ERROR: Gemini response was empty or blocked, or text method missing.");
            let finishReason = "Unknown";
            let safetyRatingsInfo = "Not available";
            let responseText = "No text content in response.";

            if (response && typeof response.text === 'function') { 
                responseText = await response.text(); 
            } else if (response && response.text) { 
                responseText = response.text;
            }


            if (response && response.candidates && response.candidates.length > 0) {
                finishReason = response.candidates[0].finishReason || finishReason;
                safetyRatingsInfo = response.candidates[0].safetyRatings ? JSON.stringify(response.candidates[0].safetyRatings) : safetyRatingsInfo;
            }
             
            if (responseText === "No text content in response." && (!response || !response.candidates || response.candidates.length === 0)) {
                 return { 
                    error: "Gemini response was empty or potentially blocked.", 
                    details: `Finish Reason: ${finishReason}. Safety Ratings: ${safetyRatingsInfo}. Response Text: ${responseText}`, 
                    success: false 
                };
            }
            if (typeof response.text === 'function' && responseText !== "No text content in response.") {
                 console.log("\n--- GEMINI.JS: Raw Text Response from Gemini ---");
                 return { analysis_text: responseText, success: true };
            }
            // Fallback if text() was not a function but response.text (property) existed
            if (response && response.text && typeof response.text !== 'function') {
                 console.log("\n--- GEMINI.JS: Raw Text Response from Gemini (property) ---");
                 return { analysis_text: response.text, success: true };
            }
            // If still no text, return the error.
             return { 
                error: "Gemini response was empty or potentially blocked.", 
                details: `Finish Reason: ${finishReason}. Safety Ratings: ${safetyRatingsInfo}. Response Text: ${responseText}`, 
                success: false 
            };
        }
        
        // If response.text is a function and callable (standard case)
        const text = await response.text(); // This line was causing an error if response.text was not a function
        console.log("\n--- GEMINI.JS: Raw Text Response from Gemini ---");
        // console.log(text); // Full text can be very long
        return { analysis_text: text, success: true };

    } catch (error) {
        console.error("GEMINI.JS_ERROR: Calling Gemini API failed:", error.message);
        let errorDetails = error.message;
         if (error.response && error.response.promptFeedback && error.response.promptFeedback.blockReason) {
            errorDetails += ` Block Reason: ${error.response.promptFeedback.blockReason}`;
             if(error.response.promptFeedback.safetyRatings) {
                errorDetails += ` Safety Ratings: ${JSON.stringify(error.response.promptFeedback.safetyRatings)}`;
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