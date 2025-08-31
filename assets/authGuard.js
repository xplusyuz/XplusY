import { auth, onAuthStateChanged } from './firebase.js';
onAuthStateChanged(auth, (user)=>{
  if(!user){
    // Not logged in: block access
    if(!location.pathname.endsWith("registor.html")){
      location.replace("registor.html");
    }
  }
});
