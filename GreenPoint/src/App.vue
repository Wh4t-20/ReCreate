<template>
  
  <div class="header">
    GreenPoint
  </div>
  <div class="chatbox">
    <div class="chatbox-description">
      <!-- Chatbot description goes here -->
    </div>
  </div>
</template>

<script>

export default {
  name: 'HomePage',
  components: {
    
  }
}
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=Iceberg&family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap');
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}
.header {
  width: 100%;
  padding: 15px 30px;
  background-color: #0A5E36;
  color: white;
  display: flex;
  justify-content: space-between;
  margin: 0px;
}

body{
  background-color: #FBF6E9;
  font-family: "Iceberg", sans-serif;
  font-weight: 400;
  font-size: 25px;
  font-style: normal;
}
.chatbox{
  padding: 10px;
  height: 100px;
  border-radius: 6px;
  margin: 40px auto; 
  width: 90%;
  max-width: 500px; 
  background: #E3F0AF; 
  box-shadow: 10px 7px 40px -15px black ;
}
.chatbox-description{
  padding: 10px;
}


</style>