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

    <section>
    <div class="column">
      <h1 id="header-1">Smarter Decisions, Greener Futures</h1>
      <p id="bottom-text">
        Analyze your land’s potential and discover the best crop choices with optimization options.
      </p>
    </div>
    </section>
    <div class="chat" >
      <div class="location-input-container">
        <textarea
        class="smaller-description"
        placeholder="Enter a location"
        v-model="location"
        @input="fetchLocationSuggestions"
        required
      ></textarea>

      <ul v-if="suggestions.length > 0" class="suggestions-list">
        <li 
          v-for="suggestion in suggestions" 
          :key="suggestion.id" 
          @click="selectSuggestion(suggestion)"
          class="suggestion-item"
        >
          {{ suggestion.place_name }}
        </li>
      </ul>
      </div>
      <button @click="goToMap" class="analyze-button">Get Started</button>

    </div>

   

  </div>
</template>

<script>
export default {
  name: 'HomePage',
  data() {
    return {
      location: '',
      isDarkMode: false,
      audio: null,
      // Added for suggestions
      suggestions: [], 
      debounceTimer: null 
    };
  },
  mounted() {
    const darkMode = localStorage.getItem('darkMode');
    if (darkMode === 'true') {
      document.body.classList.add('dark');
      this.isDarkMode = true;
    }
    // Audio
    try {
        this.audio = new Audio('/bang.mp3'); 
    } catch (e) {
        console.warn("Could not initialize audio:", e);
        this.audio = null; 
    }
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

    // Method to fetch location suggestions
    async fetchLocationSuggestions() {
      clearTimeout(this.debounceTimer);

      if (!this.location || this.location.trim().length < 3) {
        this.suggestions = [];
        return;
      }

      this.debounceTimer = setTimeout(async () => {
        const accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN; 
        const encodedLocation = encodeURIComponent(this.location);
        
        const proximityCoords = '123.8854,10.3157'; // Cebu City
        
        let url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedLocation}.json?access_token=${accessToken}&autocomplete=true`;
        if (proximityCoords) { 
          url += `&proximity=${proximityCoords}`;
        }

        try {
          const res = await fetch(url);
          const data = await res.json();

          if (data.features && data.features.length > 0) {
            this.suggestions = data.features;
          } else {
            this.suggestions = [];
          }
        } catch (error) {
          console.error('Autocomplete error:', error);
          this.suggestions = [];
        }
      }, 300); // Debounce delay 300ms
    },

    selectSuggestion(suggestion) {
      this.location = suggestion.place_name; 
      this.suggestions = []; // Clear suggestions after selection
    },

    async goToMap() {
      if (this.audio) {
        this.audio.currentTime = 0;
        this.audio.play().catch((e) => {
          console.warn("Audio couldn't play:", e);
        });
      }
      
      if (!this.location.trim()) {
        alert('Please enter a valid location.');
        return;
      }

      const accessToken = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
      const encodedLocation = encodeURIComponent(this.location);
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedLocation}.json?access_token=${accessToken}`;

      try {
        const res = await fetch(url);
        const data = await res.json();

        if (data.features && data.features.length > 0) {
          const [lon, lat] = data.features[0].center;

          this.$router.push({
            path: '/map',
            query: {
              lat,
              lon,
              plant: this.plant,
              location: this.location,
              description: this.description
            }
          });
        } else {
          alert('Location not found. Try something more specific or select from suggestions.');
        }
      } catch (error) {
        console.error('Geocoding error:', error);
        alert('Failed to geocode location.');
      }
    }
  }
};
</script>

