// auth-ui.js — handles modal, tabs and calls firebase helpers
import {
  emailRegister, emailLogin, idLogin, googleLogin, setPasswordForCurrentUser,
  phoneLoginStart, phoneLoginConfirm, linkEmailPasswordForCurrentUser, setupRecaptcha
} from "./firebase.js";

const modal = () => document.getElementById("authModal");
const errorEl = () => document.getElementById("authError");

function show(){ modal().classList.remove("hidden") }
function hide(){ modal().classList.add("hidden"); clearError() }
function setError(e){ errorEl().textContent = e?.message || e }
function clearError(){ errorEl().textContent = "" }

function switchTab(id){
  document.querySelectorAll(".auth-tabs .tab").forEach(b=>b.classList.toggle("active", b.dataset.tab===id));
  document.querySelectorAll(".tab-pane").forEach(p=>p.classList.toggle("hidden", p.dataset.pane!==id));
}

export function initAuthUI(){
  // open from header button
  document.getElementById("authBtn")?.addEventListener("click", ()=>{
    show(); switchTab("idlogin");
  });
  document.getElementById("authClose")?.addEventListener("click", hide);
  modal()?.addEventListener("click", (e)=>{ if (e.target.id==="authModal") hide() });

  document.querySelectorAll(".auth-tabs .tab").forEach(tab=>{
    tab.addEventListener("click", ()=> switchTab(tab.dataset.tab));
  });

  // ID login
  document.getElementById("idLogin_btn")?.addEventListener("click", async ()=>{
    try{
      clearError();
      const numericId = (document.getElementById("idLogin_id").value||"").trim();
      const password = document.getElementById("idLogin_pass").value;
      await idLogin({numericId, password});
      hide();
    }catch(e){ setError(e) }
  });

  // Email login
  document.getElementById("emailLogin_btn")?.addEventListener("click", async ()=>{
    try{
      clearError();
      const email = (document.getElementById("emailLogin_email").value||"").trim();
      const password = document.getElementById("emailLogin_pass").value;
      await emailLogin({email, password});
      hide();
    }catch(e){ setError(e) }
  });

  // Register
  document.getElementById("reg_btn")?.addEventListener("click", async ()=>{
    try{
      clearError();
      const displayName = document.getElementById("reg_name").value;
      const email = (document.getElementById("reg_email").value||"").trim();
      const password = document.getElementById("reg_pass").value;
      await emailRegister({email, password, displayName});
      hide();
    }catch(e){ setError(e) }
  });

  // Google
  const googleBtn = document.getElementById("google_btn");
  const setPassAfterGoogle = document.getElementById("setpass_google");
  const setPassAfterGoogleBtn = document.getElementById("setpass_google_btn");
  googleBtn?.addEventListener("click", async ()=>{
    try{
      clearError();
      await googleLogin();
      document.querySelector('[data-pane="google"] .after').classList.remove("hidden");
    }catch(e){ setError(e) }
  });
  setPassAfterGoogleBtn?.addEventListener("click", async ()=>{
    try{
      clearError();
      const pass = setPassAfterGoogle.value;
      await setPasswordForCurrentUser(pass);
      hide();
    }catch(e){ setError(e) }
  });

  // Phone
  // prepare invisible recaptcha
  setupRecaptcha("recaptcha-container");

  let _confirmation = null;
  document.getElementById("phone_send")?.addEventListener("click", async ()=>{
    try{
      clearError();
      const phone = (document.getElementById("phone_num").value||"").trim();
      _confirmation = await phoneLoginStart(phone, "recaptcha-container");
      document.getElementById("phone_verify_block").classList.remove("hidden");
    }catch(e){ setError(e) }
  });
  document.getElementById("phone_verify")?.addEventListener("click", async ()=>{
    try{
      clearError();
      const code = (document.getElementById("phone_code").value||"").trim();
      await phoneLoginConfirm(_confirmation, code);
      // stay open so user can link email+password
    }catch(e){ setError(e) }
  });
  document.getElementById("phone_linkpass")?.addEventListener("click", async ()=>{
    try{
      clearError();
      const email = (document.getElementById("phone_email").value||"").trim();
      const pass = document.getElementById("phone_pass").value;
      await linkEmailPasswordForCurrentUser(email, pass);
      hide();
    }catch(e){ setError(e) }
  });
}
