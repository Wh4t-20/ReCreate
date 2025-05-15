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
  
        <div class="chat1">
          <p class="big-text">GreenPoint</p>
          <p class="reg-text">Plan</p>
          <textarea
            class="chat-description1"
            placeholder="Describe your plans as precise as possible"
            v-model="description"
            required
          ></textarea>
  
          <p class="reg-text">Plant</p>
          <textarea
            class="smaller-description1"
            placeholder="Enter a plant"
            v-model="plant"
            required
          ></textarea>
  
          <button class="analyze-button">no fucntion pa</button>
        </div>
    </div>
  </template>
  
  <script>
  export default {
    name: 'Analyzepage',
    data() {
      return {
        plant: '',
        description: '',
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
      // Ensure the audio file path is correct for your project structure
      try {
          this.audio = new Audio('/bang.mp3'); 
      } catch (e) {
          console.warn("Could not initialize audio:", e);
          this.audio = null; // Set audio to null if initialization fails
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
  
      
    }
  };
  </script>
  
  