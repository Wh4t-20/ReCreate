import { createRouter, createWebHistory } from 'vue-router'
import MapPage from './components/map.vue' 
import Homepage from './components/Homepage.vue'; 

const routes = [
    {
      path: '/map',
      name: 'Map',
      component: MapPage,
    },
    {
      path: '/',
      name: 'Home',
      component: Homepage,
    }

];

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
