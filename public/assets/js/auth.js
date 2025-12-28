// assets/js/auth.js — auth helpers (Variant A)
import { callApi } from "./api.js";

const KEY = "lm_token";
export const getToken = () => (localStorage.getItem(KEY) || "");
export const setToken = (t) => localStorage.setItem(KEY, t);
export const clearToken = () => localStorage.removeItem(KEY);

export async function registerAuto(){
  const r = await callApi("register", { method:"POST" });
  if(r?.token) setToken(r.token);
  return r;
}

export async function login(id, password){
  const r = await callApi("login", { method:"POST", body:{ id, password } });
  if(r?.token) setToken(r.token);
  return r;
}

export async function me(){
  const token = getToken();
  return await callApi("me", { token });
}

export async function updateProfileAndPassword({ firstName="", lastName="", birthdate="", newPassword="" } = {}){
  const token = getToken();
  const body = { profile:{ firstName, lastName, birthdate } };
  if(newPassword) body.newPassword = newPassword;
  return await callApi("update_profile", { method:"POST", token, body });
}

export async function logout(){
  clearToken();
}
