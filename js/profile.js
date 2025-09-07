
import { auth, getUserDoc, updateUser } from "./firebase.js";

async function load() {
  const u = auth.currentUser;
  if (!u) return;
  const d = await getUserDoc(u.uid);
  const p = d.profile || {};
  const set = (id,val)=>{ const el=document.getElementById(id); if(el) el.value = val||""; };
  set("firstName", p.firstName);
  set("lastName", p.lastName);
  set("middleName", p.middleName);
  set("dob", p.dob);
  set("region", p.region);
  set("district", p.district);
  set("phone", p.phone);
}
load();

document.getElementById("saveProfile")?.addEventListener("click", async ()=>{
  const v = (id)=>document.getElementById(id)?.value?.trim();
  const profile = {
    firstName: v("firstName"),
    lastName: v("lastName"),
    middleName: v("middleName"),
    dob: v("dob"),
    region: v("region"),
    district: v("district"),
    phone: v("phone"),
  };
  const u = auth.currentUser; if(!u) return;
  await updateUser(u.uid, { profile });
  alert("Saqlandi");
});
