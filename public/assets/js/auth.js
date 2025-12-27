// assets/js/auth.js — auth helpers
import { api } from "./api.js";

const KEY = "lm_token";
export const getToken = () => (localStorage.getItem(KEY) || "");
export const setToken = (t) => localStorage.setItem(KEY, t);
export const clearToken = () => localStorage.removeItem(KEY);

export async function registerAuto(){
  const r = await api("auth/register", { method:"POST" });
  if(r?.token) setToken(r.token);
  return r;
}

export async function login(loginId, password){
  const r = await api("auth/login", { method:"POST", body:{ loginId, password } });
  if(r?.token) setToken(r.token);
  return r;
}

export async function me(){
  const token = getToken();
  return await api("auth/me", { token });
}

export async function changePassword(newPassword){
  const token = getToken();
  return await api("auth/change-password", { method:"POST", token, body:{ newPassword } });
}

export async function updateProfile(firstName, lastName, birthdate){
  const token = getToken();
  return await api("auth/update-profile", { method:"POST", token, body:{ firstName, lastName, birthdate } });
}

export async function logout(){
  clearToken();
}
