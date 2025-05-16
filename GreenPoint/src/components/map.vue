<template>
<div style="display: flex; flex-direction: column; height: 100vh; width: 100vw; overflow: hidden;">
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
    
    <div id="map-container" style="flex-grow: 1; position: relative; width: 100%;"> 
        <div id="map" style="width: 100%; height: 100%;"></div>
        
        <div v-if="clickedLngLat" class="coordinates-display" style="position: absolute; bottom: 70px; left: 10px; background-color: white; padding: 5px; border: 1px solid black; z-index: 1000;">
            <div>Selected Location:</div>
            <div>
                Lat: {{ clickedLngLat.lat.toFixed(4) }}, Lng: {{ clickedLngLat.lng.toFixed(4) }}
            </div>
        </div>
    </div>

    <button 
        class="getstarted" 
        @click="navigateToAnalyze" 
        :disabled="!clickedLngLat"
        title="Select a location on the map first"
    >
       Choose location
    </button>

</div>
</template>

<script>
import mapboxgl from 'mapbox-gl';
import axios from 'axios'; // Keep if you plan other API calls here, otherwise not strictly needed for this page's core logic

export default {
  name: 'MapPage', // Changed from MapView for clarity if you have multiple map-related views
  data() {
    return {
      map: null,
      isDarkMode: false,
      audio: null,
      clickedLngLat: null, // Stores {lng, lat} of the latest click
      selectedMarker: null, // Stores the current mapboxgl.Marker instance
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
        console.warn("Could not initialize audio for map page:", e);
        this.audio = null;
    }

    // IMPORTANT: Use environment variables for sensitive tokens in production
    mapboxgl.accessToken = 'pk.eyJ1IjoiY3VjdXJseXoiLCJhIjoiY21hMGx2ZjQ0MjZqNjJpcG1xNnhuZzN5eiJ9.9YAJFV1B_U8tY6bNL_aj9Q'; // Your Mapbox token

    const initialLat = parseFloat(this.$route.query.lat);
    const initialLon = parseFloat(this.$route.query.lon);
    const locationName = this.$route.query.location || 'Cebu City'; 

    if (!isNaN(initialLat) && !isNaN(initialLon)) {
      this.initializeMap([initialLon, initialLat], locationName);
    } else {
      // Geocode default location if no initial coordinates are provided
      try {
        const response = await axios.get(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(locationName)}.json`, {
          params: {
            access_token: mapboxgl.accessToken,
            limit: 1
          }
        });
        if (response.data.features && response.data.features.length > 0) {
          const [lon, lat] = response.data.features[0].center;
          this.initializeMap([lon, lat], locationName);
        } else {
          throw new Error('No features found for the default location.');
        }
      } catch (error) {
        console.error('Geocoding failed for initial location:', error);
        // Fallback to hardcoded default if geocoding fails
        this.initializeMap([123.8854, 10.3157], 'Cebu City (Default)', 10);
      }
    }
    window.addEventListener('resize', this.handleResize);
  },
  methods: {
    toggleTheme() {
      document.body.classList.toggle('dark');
      this.isDarkMode = !this.isDarkMode;
      localStorage.setItem('darkMode', this.isDarkMode);
      if (this.audio) {
        this.audio.currentTime = 0; 
        this.audio.play().catch(e => console.warn("Audio couldn't play on map page:", e));
      }
    },

    initializeMap(centerCoordinates, locationName, zoomLevel = 12) { // Adjusted default zoom
      this.map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/streets-v12',
        center: centerCoordinates,
        zoom: zoomLevel,
        attributionControl: false 
      });

      // Optional: Add an initial marker for the starting location if desired
      // this.addOrUpdateMarker(centerCoordinates, `Initial: ${locationName}`);
      // this.clickedLngLat = {lng: centerCoordinates[0], lat: centerCoordinates[1]}; // Also set if initial marker is desired

      this.map.on('click', (e) => {
        this.clickedLngLat = e.lngLat; // Store {lng, lat}
        this.addOrUpdateMarker(e.lngLat, "Selected Location");
      });
    },

    addOrUpdateMarker(lngLat, popupText = "Selected Location") {
      // Remove the previous marker if it exists
      if (this.selectedMarker) {
        this.selectedMarker.remove();
      }
      // Add a new marker
      this.selectedMarker = new mapboxgl.Marker({
          color: "#FF0000", // Example: Red marker
          // You can use a custom element for a PNG pin:
          // element: createCustomPinElement('/path/to/your/pin.png'),
      })
        .setLngLat(lngLat)
        .setPopup(new mapboxgl.Popup().setText(popupText)) // Optional: show popup on marker click
        .addTo(this.map);
      
      // Optionally open the popup immediately
      // this.selectedMarker.togglePopup();
    },

    // Optional: Helper for custom PNG marker
    // createCustomPinElement(imageUrl) {
    //   const el = document.createElement('div');
    //   el.className = 'custom-marker';
    //   el.style.backgroundImage = `url(${imageUrl})`;
    //   el.style.width = '30px'; // Set your pin's width
    //   el.style.height = '40px'; // Set your pin's height
    //   el.style.backgroundSize = 'cover';
    //   return el;
    // },

    handleResize() {
      if (this.map) {
        this.map.resize();
      }
    },

    navigateToAnalyze() {
      if (this.clickedLngLat) {
        this.$router.push({ 
          path: '/analyze', 
          query: { 
            lat: this.clickedLngLat.lat.toFixed(6), // Pass with good precision
            lon: this.clickedLngLat.lng.toFixed(6) 
          } 
        });
      } else {
        alert("Please select a location on the map first by clicking on it.");
      }
    }
  },
  beforeUnmount() {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
    window.removeEventListener('resize', this.handleResize);
  }
};
</script>