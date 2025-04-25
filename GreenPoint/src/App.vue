  <template>
  <div id="app">
      <div class="header">
        GreenPoint
      </div>
      <div class="chat">
        <p class="h1">GreenPoint</p>
        <p class="text1">What ails you yung blud?</p>
        
        <textarea 
          class="chat-description" 
          placeholder="Describe your plans"
          v-model="plan"
          required
        ></textarea> 
        <button class="analyze-button" @click="test">Analyze</button>
      </div>
  </div>

  </template>

  <script>

  export default {
    name: 'HomePage',
    components: {
      plan: ''
    },
  methods: {
    test() {
      const test = this.plan;
      alert(`User: ${test}`)
    },
  },
};
  </script>

  <style>
  </style>