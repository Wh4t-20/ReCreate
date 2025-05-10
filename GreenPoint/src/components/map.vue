<template>
<div>
    <div class="header">
        GreenPoint
    </div>
    <div id="map" style="width: 100%; height: 100vh;">
    </div>
</div>
</template>

<script>
import mapboxgl from 'mapbox-gl';
import axios from 'axios';

export default {
  name: 'map',
  async mounted() {
    mapboxgl.accessToken = 'pk.eyJ1IjoiY3VjdXJseXoiLCJhIjoiY21hMGx2ZjQ0MjZqNjJpcG1xNnhuZzN5eiJ9.9YAJFV1B_U8tY6bNL_aj9Q';

    const locationName = this.$route.query.location || 'Cebu City';

    try {
      const response = await axios.get(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(locationName)}.json`, {
        params: {
          access_token: mapboxgl.accessToken,
          limit: 1
        }
      });

      const [lon, lat] = response.data.features[0].center;

      const map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [lon, lat],
        zoom: 15 
      });

      new mapboxgl.Marker()
        .setLngLat([lon, lat])
        .setPopup(new mapboxgl.Popup().setText(`Location: ${locationName}`))
        .addTo(map);
    } catch (error) {
      console.error('Geocoding failed:', error);
      alert('Failed to locate the area. Showing default map.');
//shows default zoom which is ubec imnida
      const fallbackMap = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [123.878, 10.302],
        zoom: 10
      });
    }
  }
};
</script>

<style>


</style>