import { api } from "./api.js";

const KEY="lm_token";
export function getToken(){ return localStorage.getItem(KEY) || ""; }
export function setToken(t){ localStorage.setItem(KEY, t); }
export function clearToken(){ localStorage.removeItem(KEY); }

// ------------------------------
// Local fallback auth (no backend)
// ------------------------------
// This project can run without Netlify Functions / Firebase env.
// If API calls fail (500/404/network), we fall back to a local-only
// auth stored in localStorage.
const LKEY_USERS = "lm_users";   // { [loginId]: { password, ...profile } }
const LKEY_COUNTER = "lm_counter";

function loadUsers(){
  try{ return JSON.parse(localStorage.getItem(LKEY_USERS) || "{}") || {}; }
  catch{ return {}; }
}
function saveUsers(obj){
  localStorage.setItem(LKEY_USERS, JSON.stringify(obj||{}));
}

function nextLocalLoginId(){
  const cur = Number(localStorage.getItem(LKEY_COUNTER) || "0") || 0;
  const next = cur + 1;
  localStorage.setItem(LKEY_COUNTER, String(next));
  return "LM-" + String(next).padStart(6, "0");
}

function genPassword(){
  // short but not trivial
  const core = Math.random().toString(36).slice(2, 8);
  return (core + "A!").slice(0, 10);
}

function localToken(loginId){
  return "local:" + String(loginId);
}
function isLocalToken(t){
  return String(t||"").startsWith("local:");
}
function localLoginIdFromToken(t){
  return String(t||"").replace(/^local:/, "");
}

function localPublic(u){
  return {
    loginId: u.loginId,
    name: u.name || "",
    firstName: u.firstName || "",
    lastName: u.lastName || "",
    birthdate: u.birthdate || "",
    avatarId: u.avatarId ?? null,
    profileComplete: !!u.profileComplete,
    points: u.points ?? 0,
    balance: u.balance ?? 0,
    createdAt: u.createdAt || Date.now(),
    _mode: "local"
  };
}

function shouldFallback(err){
  // Network errors or backend not configured (ENV missing)
  const msg = String(err?.message || "").toLowerCase();
  const st = Number(err?.status || 0);
  if(st === 0) return true;
  if(st === 404) return true;
  if(st >= 500) return true;
  if(msg.includes("fetch")) return true;
  if(msg.includes("env:")) return true;
  if(msg.includes("firebase_service_account")) return true;
  return false;
}

export async function registerAuto(){
  try{
    const r = await api("auth/register", { method:"POST" });
    setToken(r.token);
    return r;
  }catch(err){
    if(!shouldFallback(err)) throw err;
    // local create
    const users = loadUsers();
    const loginId = nextLocalLoginId();
    const password = genPassword();
    users[loginId] = {
      loginId,
      password,
      createdAt: Date.now(),
      points: 0,
      balance: 0,
      avatarId: null,
      profileComplete: false,
      firstName: "",
      lastName: "",
      birthdate: ""
    };
    saveUsers(users);
    setToken(localToken(loginId));
    return { loginId, password, token: getToken(), _mode:"local" };
  }
}
export async function login(loginId, password){
  try{
    const r = await api("auth/login", { method:"POST", body:{loginId, password} });
    setToken(r.token);
    return r;
  }catch(err){
    if(!shouldFallback(err)) throw err;
    const users = loadUsers();
    const u = users[loginId];
    if(!u) throw new Error("Bunday ID topilmadi (local)");
    if(String(u.password) !== String(password)) throw new Error("Parol noto‘g‘ri (local)");
    setToken(localToken(loginId));
    return { ok:true, token: getToken(), _mode:"local" };
  }
}
export async function me(){
  const token = getToken();
  if(isLocalToken(token)){
    const loginId = localLoginIdFromToken(token);
    const users = loadUsers();
    const u = users[loginId];
    if(!u) throw new Error("Token bor, lekin user topilmadi (local)");
    return localPublic(u);
  }
  try{
    return await api("auth/me", { token });
  }catch(err){
    if(!shouldFallback(err)) throw err;
    // fallback to local if token points to local user by ID stored separately
    throw err;
  }
}
export async function changePassword(newPassword){
  const token = getToken();
  if(isLocalToken(token)){
    const loginId = localLoginIdFromToken(token);
    const users = loadUsers();
    const u = users[loginId];
    if(!u) throw new Error("User topilmadi (local)");
    u.password = String(newPassword||"");
    users[loginId] = u;
    saveUsers(users);
    return { ok:true, _mode:"local" };
  }
  return await api("auth/change-password", { method:"POST", token, body:{newPassword} });
}
export async function updateProfile(firstName,lastName,birthdate){
  const token = getToken();
  if(isLocalToken(token)){
    const loginId = localLoginIdFromToken(token);
    const users = loadUsers();
    const u = users[loginId];
    if(!u) throw new Error("User topilmadi (local)");
    u.firstName = String(firstName||"");
    u.lastName = String(lastName||"");
    u.birthdate = String(birthdate||"");
    u.profileComplete = !!(u.firstName || u.lastName);
    users[loginId] = u;
    saveUsers(users);
    return localPublic(u);
  }
  return await api("auth/update-profile", { method:"POST", token, body:{firstName,lastName,birthdate} });
}

export async function setAvatar(avatarId){
  const token = getToken();
  if(isLocalToken(token)){
    const loginId = localLoginIdFromToken(token);
    const users = loadUsers();
    const u = users[loginId];
    if(!u) throw new Error("User topilmadi (local)");
    u.avatarId = Number(avatarId);
    users[loginId] = u;
    saveUsers(users);
    return localPublic(u);
  }
  return await api("auth/set-avatar", { method:"POST", token, body:{avatarId} });
}
export async function logout(){
  clearToken();
}
