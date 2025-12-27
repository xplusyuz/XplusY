import { register, login } from "./auth.js";
import { toast, setText } from "./ui.js";
import { startClock, startSeasonParticles } from "./season.js";

startClock();
startSeasonParticles();

const regBtn = document.getElementById("regBtn");
const loginBtn = document.getElementById("loginBtn");

regBtn.onclick = async ()=>{
  regBtn.disabled = true;
  try{
    const d = await register();
    // show credentials
    document.getElementById("credBox").style.display="block";
    setText("newId", d.user.loginId);
    setText("newPass", d.user.passwordPlain);
    toast("ID va parol yaratildi ✅");
  }catch(e){
    toast(e.message || "Xatolik");
  } finally {
    regBtn.disabled = false;
  }
};

loginBtn.onclick = async ()=>{
  loginBtn.disabled = true;
  try{
    const loginId = document.getElementById("loginId").value.trim();
    const password = document.getElementById("password").value.trim();
    if(!loginId || !password) throw new Error("ID va Parolni kiriting");
    await login({loginId, password});
    location.href="/app.html";
  }catch(e){
    toast(e.message || "Xatolik");
  } finally {
    loginBtn.disabled = false;
  }
};

document.getElementById("goApp").onclick = ()=> location.href="/app.html";
