<template>
  <div>
    <header>
      <h3 class="name">GreenPoint</h3>
      <button class="theme-button" @click="toggleTheme">
        <img 
          :src="isDarkMode ? '/images/Sun.png' : '/images/Moon.png'" 
          id="moon" 
          :alt="isDarkMode ? 'Sun icon' : 'Moon icon'" 
        />
      </button>
    </header>

    <div class="placeholder">
      <p class="big-text">GreenPoint</p>
      <p class="reg-text">Plan Description</p>
      <textarea
        class="chat-description"
        placeholder="Describe your plans as precise as possible (e.g., 'Setup a small farm for personal consumption focusing on leafy greens.')"
        v-model="description"
        required
      ></textarea>

      <p class="reg-text">Selected Location</p>
      <div class="location-info-display">
        <span v-if="latitude && longitude">Lat: {{ latitude }}, Lng: {{ longitude }}</span>
        <span v-else>No location selected. Please go back to the map.</span>
      </div>

      <p class="reg-text">Plant</p>
      <div class="plant-search-widget-container"> 
        <textarea
          class="txtplant"
          placeholder="Enter a plant to analyze"
          v-model="plantSearchInput"
          @input="handlePlantInput"
          @focus="showPlantSuggestions = plantSuggestions.length > 0 && plantSearchInput.length > 0"
          @blur="handlePlantInputBlur" 
          required
        ></textarea>
        <div v-if="showPlantSuggestions && plantSuggestions.length > 0" class="plant-search-suggestions-list">
          <ul>
            <li 
              v-for="suggestion in plantSuggestions" 
              :key="suggestion.ScientificName" 
              @mousedown="selectPlantSuggestion(suggestion.ScientificName)"
            >
              {{ suggestion.ScientificName }} 
              <span v-if="suggestion.matchedCommonName" class="plant-search-suggestion-details"> (matches: {{ suggestion.matchedCommonName }})</span>
            </li>
          </ul>
        </div>
      </div>

      <button class="finalanalyze" @click="triggerAnalysis" :disabled="isLoadingAnalysis">
        {{ isLoadingAnalysis ? 'Analyzing...' : 'Analyze Suitability' }}
      </button>
    </div>

    <div v-if="showAnalysisModal" class="analysis-modal-overlay" @click.self="closeAnalysisModal">
      <div class="analysis-modal-content">
        <button class="analysis-modal-close-button" @click="closeAnalysisModal">&times;</button>
        <h3>Agricultural Suitability Analysis</h3>
        <div v-if="isLoadingAnalysis" class="loading-spinner">Loading analysis...</div>
        <div v-if="analysisResult && analysisResult.ai_analysis">
          <div v-if="analysisResult.ai_analysis.success">
            <div class="score-section">
            </div>
            <div class="analysis-text-content" v-html="formatAnalysisText(analysisResult.ai_analysis.analysis_text)"></div>
          </div>
          <div v-else class="analysis-error">
            <p><strong>Error fetching analysis:</strong></p>
            <p>{{ analysisResult.ai_analysis.error }}</p>
            <pre v-if="analysisResult.ai_analysis.details">{{ analysisResult.ai_analysis.details }}</pre>
          </div>
        </div>
         <div v-else-if="!isLoadingAnalysis && analysisResult">
            <p>No analysis data received or an unexpected error occurred.</p>
            <pre>{{ analysisResult }}</pre>
        </div>
      </div>
    </div>

  </div>
</template>

<script>
import axios from 'axios'; 
import { marked } from 'marked'; 

export default {
  name: 'Analyzepage',
  data() {
    return {
      plantSearchInput: '', 
      plant: '', 
      description: '',
      isDarkMode: false,
      audio: null,
      allPlants: [], 
      plantSuggestions: [], 
      showPlantSuggestions: false,
      blurTimeout: null,
      
      latitude: null,
      longitude: null,
      analysisResult: null, 
      showAnalysisModal: false,
      isLoadingAnalysis: false,

      feasibilityScore: null,
      sustainabilityScore: null,
    };
  },
  async mounted() {
    const darkMode = localStorage.getItem('darkMode');
    if (darkMode === 'true') {
      document.body.classList.add('dark');
      this.isDarkMode = true;
    }
    try {
        this.audio = new Audio('/bang.mp3'); 
    } catch (e) {
        console.warn("Could not initialize audio:", e);
        this.audio = null;
    }
    await this.fetchAllPlants();

    if (this.$route.query.lat && this.$route.query.lon) {
      this.latitude = parseFloat(this.$route.query.lat);
      this.longitude = parseFloat(this.$route.query.lon);
      console.log(`Received Lat: ${this.latitude}, Lon: ${this.longitude}`);
    } else {
      console.warn("Latitude or Longitude not provided in route query.");
    }
  },
  methods: {
    toggleTheme() {
      document.body.classList.toggle('dark');
      this.isDarkMode = !this.isDarkMode;
      localStorage.setItem('darkMode', this.isDarkMode);
      if (this.audio) {
        this.audio.currentTime = 0; 
        this.audio.play().catch(e => console.warn("Audio couldn't play:", e));
      }
    },
    
    async triggerAnalysis() {
      if (!this.description || !this.plant) {
        alert("Please provide a plan description and select a plant.");
        return;
      }
      if (!this.latitude || !this.longitude) {
        alert("Location coordinates are missing. Please select a location on the map first.");
        return;
      }

      this.isLoadingAnalysis = true;
      this.showAnalysisModal = true; 
      this.analysisResult = null; 
      this.feasibilityScore = null; 
      this.sustainabilityScore = null;

      try {
        const payload = {
          latitude: this.latitude,
          longitude: this.longitude,
          plantScientificName: this.plant, 
          planDescription: this.description 
        };
        const response = await axios.post('http://localhost:3002/api/get-combined-data', payload);
        this.analysisResult = response.data;

        if (this.analysisResult && this.analysisResult.ai_analysis && this.analysisResult.ai_analysis.success) {
          this.parseAndSetScores(this.analysisResult.ai_analysis.analysis_text);
        }

      } catch (error) {
        console.error("Error calling analysis API:", error.response ? error.response.data : error.message);
        this.analysisResult = { 
          ai_analysis: { 
            success: false, 
            error: "Failed to connect to the analysis service or an error occurred.",
            details: error.response ? JSON.stringify(error.response.data, null, 2) : error.message
          }
        };
      } finally {
        this.isLoadingAnalysis = false;
      }
    },

    parseAndSetScores(analysisText) {
      if (!analysisText) return;


      // It captures the digit(s) X.
      const feasibilityRegex = /Feasibility Score.*?Score\s*:\s*(\d+)\/10/is;
      const sustainabilityRegex = /Sustainability Score.*?Score\s*:\s*(\d+)\/10/is;

      const feasibilityMatch = analysisText.match(feasibilityRegex);
      if (feasibilityMatch && feasibilityMatch[1]) {
        this.feasibilityScore = parseInt(feasibilityMatch[1], 10);
      } else {
        console.warn("Could not parse Feasibility Score from AI text. Text was:", analysisText);
        this.feasibilityScore = null; 
      }

      const sustainabilityMatch = analysisText.match(sustainabilityRegex);
      if (sustainabilityMatch && sustainabilityMatch[1]) {
        this.sustainabilityScore = parseInt(sustainabilityMatch[1], 10);
      } else {
        console.warn("Could not parse Sustainability Score from AI text. Text was:", analysisText);
        this.sustainabilityScore = null; 
      }
      console.log("Parsed Scores:", {feasibility: this.feasibilityScore, sustainability: this.sustainabilityScore });
    },

    getScoreBoxClass(score, boxIndex, scoreType /* for theming, e.g., 'feasibility' or 'sustainability' */) {
      if (score === null || score === undefined) {
        return 'score-box empty'; 
      }
      let colorClass = 'red'; 
      if (score >= 8) {
        colorClass = 'green';
      } else if (score >= 4) { 
        colorClass = 'yellow';
      }
      
      if (boxIndex <= score) {
        return `score-box filled ${colorClass}`;
      }
      return 'score-box empty';
    },

    closeAnalysisModal() {
      this.showAnalysisModal = false;
      this.analysisResult = null; 
      this.feasibilityScore = null;
      this.sustainabilityScore = null;
    },

    formatAnalysisText(markdownText) {
      if (!markdownText) return '';
      marked.setOptions({
        gfm: true,          
        breaks: true,       
        sanitize: false,    
      });
      return marked.parse(markdownText); 
    },

    async fetchAllPlants() {
      try {
        const response = await axios.get('http://localhost:3002/api/plants');
        this.allPlants = response.data.map(p => {
          const commonNamesArray = p.COMNAME 
            ? p.COMNAME.split(',').map(name => name.trim().toLowerCase()) 
            : [];
          return { 
            ...p, 
            commonNamesArray,
            ScientificNameLower: p.ScientificName ? p.ScientificName.toLowerCase() : ''
          };
        });
      } catch (error) {
        console.error("Failed to fetch plants:", error);
      }
    },
    handlePlantInput() {
      if (this.blurTimeout) clearTimeout(this.blurTimeout);
      const query = this.plantSearchInput.trim().toLowerCase();
      if (!query) {
        this.plantSuggestions = [];
        this.showPlantSuggestions = false;
        this.plant = '';
        return;
      }
      const filtered = [];
      const addedScientificNames = new Set();
      for (const plant of this.allPlants) {
        let matchedCommonName = null;
        if (plant.ScientificNameLower && plant.ScientificNameLower.includes(query)) {
          if (!addedScientificNames.has(plant.ScientificName)) {
             filtered.push({ ScientificName: plant.ScientificName, matchedCommonName: null });
             addedScientificNames.add(plant.ScientificName);
          }
        } else if (plant.commonNamesArray && plant.commonNamesArray.length > 0) {
          const foundCommonNameInArray = plant.commonNamesArray.find(cn => cn.includes(query));
          if (foundCommonNameInArray) {
            if (!addedScientificNames.has(plant.ScientificName)) {
              const originalCommonNames = plant.COMNAME ? plant.COMNAME.split(',').map(name => name.trim()) : [];
              const originalMatched = originalCommonNames.find(ocn => ocn.toLowerCase().includes(query));
              matchedCommonName = originalMatched || foundCommonNameInArray;
              filtered.push({ ScientificName: plant.ScientificName, matchedCommonName: matchedCommonName });
              addedScientificNames.add(plant.ScientificName);
            }
          }
        }
        if (filtered.length >= 7) break;
      }
      this.plantSuggestions = filtered;
      this.showPlantSuggestions = filtered.length > 0;
    },
    selectPlantSuggestion(scientificName) {
      this.plant = scientificName;
      this.plantSearchInput = scientificName;
      this.showPlantSuggestions = false;
      this.plantSuggestions = [];
    },
    handlePlantInputBlur() {
      this.blurTimeout = setTimeout(() => {
        this.showPlantSuggestions = false;
      }, 200);
    }
  },
  beforeUnmount() {
    if (this.blurTimeout) {
      clearTimeout(this.blurTimeout);
    }
  }
};
</script>