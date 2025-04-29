<template>
  <div id="app">
    <header>
      <img id="logo" src="https://static.wikia.nocookie.net/plantsvszombies/images/8/86/Melonpult2009HD.png/revision/latest?cb=20170909070525">
      <h3>GreenPoint</h3>
      <div class="theme-button">
        <img id="moon" src="/Moon.png">
      </div>        
    </header>

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
          v-model="plan"
          required
        ></textarea>
          
        <p class="reg-text">Plant</p>
        <textarea 
          class="smaller-description" 
          placeholder="Enter a plant"
          v-model="plan"
          required
        ></textarea>
          
        <p class="reg-text">Location</p>
        <textarea 
          class="smaller-description" 
          placeholder="Enter a plant"
          v-model="plan"
          required
        ></textarea> 
        <button class="analyze-button">Analyze</button>
      </div>
    </section>
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