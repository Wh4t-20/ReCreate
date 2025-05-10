<template>
<div style="display: flex; flex-direction: column; height: 100vh; width: 100vw; overflow: hidden;">
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
    
    <div id="map-container" style="flex-grow: 1; position: relative; width: 100%;"> 
        <div id="map" style="width: 100%; height: 100%;"></div>
    </div>
</div>
</template>

<script>
import mapboxgl from 'mapbox-gl';
import axios from 'axios';

export default {
  name: 'MapView',
  data() {
    return {
      map: null,
      isDarkMode: false,
      audio: null,
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

    mapboxgl.accessToken = 'pk.eyJ1IjoiY3VjdXJseXoiLCJhIjoiY21hMGx2ZjQ0MjZqNjJpcG1xNnhuZzN5eiJ9.9YAJFV1B_U8tY6bNL_aj9Q';

    const initialLat = parseFloat(this.$route.query.lat);
    const initialLon = parseFloat(this.$route.query.lon);
    const locationName = this.$route.query.location || 'Cebu City'; 

    if (!isNaN(initialLat) && !isNaN(initialLon)) {
      this.initializeMap([initialLon, initialLat], locationName);
    } else {
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
          throw new Error('No features found for the location.');
        }
      } catch (error) {
        console.error('Geocoding failed for initial location:', error);
        alert('Failed to locate the area. Showing default map of Cebu City.');
        this.initializeMap([123.8854, 10.3157], 'Cebu City (Default)', 10);
      }
    }
    // Removed call to adjustMapContainerHeight as CSS flexbox handles it
  },
  methods: {
    toggleTheme() {
      document.body.classList.toggle('dark');
      this.isDarkMode = !this.isDarkMode;
      localStorage.setItem('darkMode', this.isDarkMode);

      if (this.audio) {
        this.audio.currentTime = 0; 
        this.audio.play().catch((e) => {
          console.warn("Audio couldn't play on map page:", e);
        });
      }
    },

    initializeMap(centerCoordinates, locationName, zoomLevel = 15) {
      this.map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/streets-v12',
        center: centerCoordinates,
        zoom: zoomLevel,
        attributionControl: false 
      });

      new mapboxgl.Marker()
        .setLngLat(centerCoordinates)
        .setPopup(new mapboxgl.Popup().setText(`Location: ${locationName}`))
        .addTo(this.map);
    },

    // adjustMapContainerHeight method is removed
  },
  beforeUnmount() {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }
};
</script>

