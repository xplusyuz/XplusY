import { api } from "./api.js";

const LS_TOKEN = "lm_token";
const LS_USER = "lm_user";

export function getToken(){ return localStorage.getItem(LS_TOKEN) || ""; }
export function getUser(){ 
  try{ return JSON.parse(localStorage.getItem(LS_USER) || "null"); }catch{ return null; }
}
export function setSession({token, user}){
  localStorage.setItem(LS_TOKEN, token);
  localStorage.setItem(LS_USER, JSON.stringify(user));
}
export function clearSession(){
  localStorage.removeItem(LS_TOKEN);
  localStorage.removeItem(LS_USER);
}

export async function register(){
  const d = await api("/auth/register", {method:"POST"});
  setSession(d);
  return d;
}

export async function login({loginId, password}){
  const d = await api("/auth/login", {method:"POST", body:{loginId, password}});
  setSession(d);
  return d;
}

export async function updateProfile({firstName,lastName,birthdate}){
  const token = getToken();
  return await api("/auth/update-profile", {method:"POST", token, body:{firstName,lastName,birthdate}});
}

export async function changePassword({newPassword}){
  const token = getToken();
  return await api("/auth/change-password", {method:"POST", token, body:{newPassword}});
}

export async function me(){
  const token = getToken();
  if(!token) throw new Error("Token yo‘q");
  return await api("/auth/me", {token});
}
