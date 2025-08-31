import { auth, onAuthStateChanged } from './firebase.js';
onAuthStateChanged(auth, (user)=>{
  if(!user){
    if(!location.pathname.endsWith("registor.html")){
      location.replace("registor.html");
    }
  }
});
