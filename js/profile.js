// js/profile.js — standalone
import { attachAuthUI, initUX, db } from "./common.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

function fillProfile(d){
  const $ = (s)=>document.querySelector(s);
  $('#pf_numericId') && ($('#pf_numericId').value = d.numericId ?? '—');
  $('#pf_firstName') && ($('#pf_firstName').value = d.firstName ?? '');
  $('#pf_lastName') && ($('#pf_lastName').value = d.lastName ?? '');
  $('#pf_middleName') && ($('#pf_middleName').value = d.middleName ?? '');
  $('#pf_dob') && ($('#pf_dob').value = d.dob ?? '');
  $('#pf_region') && ($('#pf_region').value = d.region ?? '');
  $('#pf_district') && ($('#pf_district').value = d.district ?? '');
  $('#pf_phone') && ($('#pf_phone').value = d.phone ?? '');
  $('#pf_balance') && ($('#pf_balance').value = d.balance ?? 0);
  $('#pf_gems') && ($('#pf_gems').value = d.gems ?? 0);
}
function setEditable(x){
  const sel = ['#pf_firstName','#pf_lastName','#pf_middleName','#pf_dob','#pf_region','#pf_district','#pf_phone'];
  sel.forEach(s=>{ const el=document.querySelector(s); if(!el) return; x?el.removeAttribute('readonly'):el.setAttribute('readonly',''); });
  const saveBtn=document.getElementById('profileSave'); if(saveBtn) saveBtn.disabled=!x;
}

export default {
  async init(){
    attachAuthUI({ requireSignIn:true }); initUX?.();
    const unsub = (e)=>{};
    const ready = ()=>{
      const profile = window.__mcUser?.profile || {};
      fillProfile(profile); setEditable(false);
      document.getElementById('profileEdit')?.addEventListener('click', ()=> setEditable(true));
      document.getElementById('profileSave')?.addEventListener('click', async ()=>{
        try{
          const uid = window.__mcUser?.user?.uid;
          if(!uid) throw new Error('User yo‘q');
          const ref = doc(db,'users', uid);
          const data={
            firstName: document.getElementById('pf_firstName')?.value.trim(),
            lastName: document.getElementById('pf_lastName')?.value.trim(),
            middleName: document.getElementById('pf_middleName')?.value.trim(),
            dob: document.getElementById('pf_dob')?.value,
            region: document.getElementById('pf_region')?.value.trim(),
            district: document.getElementById('pf_district')?.value.trim(),
            phone: document.getElementById('pf_phone')?.value.trim(),
          };
          await updateDoc(ref, data);
          alert('Profil saqlandi ✅'); setEditable(false);
        }catch(e){ alert('Xato: '+(e.message||e)); }
      });
    };
    if(window.__mcUser?.user) ready();
    else document.addEventListener('mc:user-ready', ready, { once:true });
  },
  destroy(){}
}