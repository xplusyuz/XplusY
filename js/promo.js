// js/promo.js — standalone
import { attachAuthUI, initUX } from "./common.js";
export default {
  async init(){
    attachAuthUI({ requireSignIn:true }); initUX?.();
    const btn = document.getElementById('promoApply');
    const msg = document.getElementById('promoMsg');
    btn?.addEventListener('click', ()=>{ if(msg) msg.textContent='Promo tizimi keyingi bosqichda yoqiladi.'; });
  },
  destroy(){}
}