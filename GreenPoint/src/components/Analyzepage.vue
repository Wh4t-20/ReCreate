<template>
  <div>
    <header>
      <img id="logo" src="/images/leaf.png" alt="Logo" />
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
      <p class="reg-text">Plan</p>
      <textarea
        class="chat-description"
        placeholder="Describe your plans as precise as possible"
        v-model="description"
        required
      ></textarea>

      <p class="reg-text">Plant</p>
      <div class="plant-search-widget-container"> 
        <textarea
          class="smaller-description"
          placeholder="Enter a plant"
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

      <button class="analyze-button" @click="getValue">Analyze</button>
    </div>
  </div>
</template>

<script>
import axios from 'axios'; // Assuming you'll use axios for API calls

export default {
  name: 'Analyzepage',
  data() {
    return {
      plantSearchInput: '', // User's input for plant search
      plant: '', // Final selected plant (Scientific Name)
      description: '',
      isDarkMode: false,
      audio: null,
      allPlants: [], // To store all plants from the CSV { ScientificName, COMNAME, commonNamesArray }
      plantSuggestions: [], // To store filtered suggestions { ScientificName, matchedCommonName (optional) }
      showPlantSuggestions: false,
      blurTimeout: null, // For handling blur and click on suggestions
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
    await this.fetchAllPlants(); // Fetch plants when component mounts
  },
  methods: {
    toggleTheme() {
      document.body.classList.toggle('dark');
      this.isDarkMode = !this.isDarkMode;
      localStorage.setItem('darkMode', this.isDarkMode);

      if (this.audio) {
        this.audio.currentTime = 0; 
        this.audio.play().catch((e) => {
          console.warn("Audio couldn't play:", e);
        });
      }
    },
    getValue() {
      if(!this.description || !this.plant) { // Check 'plant' which holds the selected scientific name
        alert("Please describe your plan and select a plant from the suggestions.");
        return;
      }
      alert(`Plan: ${this.description} \nSelected Plant (Scientific Name): ${this.plant}`);
      // Here you would proceed with sending this.plant (ScientificName), 
      // this.description, and lat/lon to your backend /api/get-combined-data
    },

    async fetchAllPlants() {
      try {
        // Make sure your backend server (server.js) is running and accessible at this URL
        const response = await axios.get('http://localhost:3002/api/plants');
        this.allPlants = response.data.map(p => {
          const commonNamesArray = p.COMNAME 
            ? p.COMNAME.split(',').map(name => name.trim().toLowerCase()) 
            : [];
          return { 
            ...p, 
            commonNamesArray,
            ScientificNameLower: p.ScientificName ? p.ScientificName.toLowerCase() : '' // Pre-lowercase for searching
          };
        });
        console.log("Fetched and processed plants:", this.allPlants.length);
      } catch (error) {
        console.error("Failed to fetch plants:", error);
        // Optionally, inform the user that plant suggestions might not be available
      }
    },

    handlePlantInput() {
      if (!this.plantSearchInput.trim()) {
        this.plantSuggestions = [];
        this.showPlantSuggestions = false;
        return;
      }

      const searchLower = this.plantSearchInput.trim().toLowerCase();
      const filtered = [];
      
      for (const plant of this.allPlants) {
        let matchedCommonName = null;

        // Check against scientific name
        if (plant.ScientificNameLower && plant.ScientificNameLower.includes(searchLower)) {
          if (!filtered.some(s => s.ScientificName === plant.ScientificName)) {
             filtered.push({ ScientificName: plant.ScientificName, matchedCommonName: null }); 
          }
        } else {
          // Check against common names
          if (plant.commonNamesArray) {
            const foundCommonName = plant.commonNamesArray.find(cn => cn.includes(searchLower));
            if (foundCommonName) {
              if (!filtered.some(s => s.ScientificName === plant.ScientificName)) {
                const originalCommonNames = plant.COMNAME ? plant.COMNAME.split(',').map(name => name.trim()) : [];
                const originalMatched = originalCommonNames.find(ocn => ocn.toLowerCase().includes(searchLower));
                matchedCommonName = originalMatched || foundCommonName; 
                filtered.push({ ScientificName: plant.ScientificName, matchedCommonName: matchedCommonName });
              }
            }
          }
        }
        if (filtered.length >= 7) {
          break; 
        }
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