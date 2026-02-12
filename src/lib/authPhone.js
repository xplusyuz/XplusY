import { RecaptchaVerifier, signInWithPhoneNumber, onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "./firebase";

let recaptchaVerifier = null;

export function ensureRecaptcha(containerId="recaptcha-container"){
  if(recaptchaVerifier) return recaptchaVerifier;
  recaptchaVerifier = new RecaptchaVerifier(auth, containerId, { size: "invisible" });
  return recaptchaVerifier;
}

export async function sendSms(phoneE164){
  const verifier = ensureRecaptcha();
  const confirmation = await signInWithPhoneNumber(auth, phoneE164, verifier);
  return confirmation;
}

export function watchAuth(cb){ return onAuthStateChanged(auth, cb); }
export async function logout(){ await signOut(auth); }
