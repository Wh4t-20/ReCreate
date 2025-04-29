<template>
  <div>
    <div class="header">
      GreenPoint
      <div class="theme-button">
            <img id="moon" src="./assets/Moon.png">
        </div>  
    </div>
    <section>
        <div class="column">
            <h1 id="header-1">Are your crops good?</h1>
            <p id="bottom-text">
                Check if your land is suitable for growing a certain crop. 
                You get an in-depth analysis of the land with optimization 
                options.
            </p>
        </div>

        <div class="chat">
            <p class="big-text">GreenPoint</p>
            
            <p class="reg-text">What ails you yung blud?</p>
            <textarea 
              class="chat-description" 
              placeholder="Describe your plans"
              v-model="description"
              required
            ></textarea>
            
            <p class="reg-text">Plant</p>
            <textarea 
              class="smaller-description" 
              placeholder="Enter a plant"
              v-model="plant"
              required
            ></textarea>
            
            <p class="reg-text">Location</p>
            <textarea 
              class="smaller-description" 
              placeholder="Enter a plant"
              v-model="location"
              required
            ></textarea> 
            <button  @click="goToMap" class="analyze-button">Analyze</button>
        </div>
    </section>
  </div>
</template>

<script>
export default {
  name: 'HomePage',
  data() {
    return {
      plant: '',
      location: '',
      description: ''
    };
  },
  methods: {
    async goToMap() {
      if (!this.location.trim()) {
        alert('Please enter a valid location.');
        return;
      }

      const accessToken = 'pk.eyJ1IjoiY3VjdXJseXoiLCJhIjoiY21hMGx2ZjQ0MjZqNjJpcG1xNnhuZzN5eiJ9.9YAJFV1B_U8tY6bNL_aj9Q'; 
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
          alert('Location not found. Try something more specific.');
        }
      } catch (error) {
        console.error('Geocoding error:', error);
        alert('Failed to geocode location.');
      }
    }
  }
};
</script>


<style scoped>
.router {
  text-decoration: none;
  color: beige;
}
</style>
