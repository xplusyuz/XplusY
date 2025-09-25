import { listLatest } from '../assets/app.js';
async function loadBanner(){ try{ const snap=await listLatest('home_banners',1); if(!snap.empty){ const d=snap.docs[0].data(); const img=document.getElementById('bannerImg'); const a=document.getElementById('bannerLink'); if(img) img.src=d.image||''; if(a){ a.href=d.link||'#'; a.style.display=d.link?'inline-block':'none'; } } }catch(e){ console.error(e);} }
loadBanner();
