import { createRouter, createWebHistory } from 'vue-router'
import MapPage from './components/map.vue' 
import Homepage from './components/Homepage.vue'; 
import Analyzepage from './components/Analyzepage.vue';

const routes = [
    {
      path: '/map',
      name: 'Map',
      component: MapPage,
    },
    {
      path: '/analyze',
      name: 'Analyze',
      component: Analyzepage,
    },
    {
      path: '/',
      name: 'Home',
      component: Homepage,
    },
    

];

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
