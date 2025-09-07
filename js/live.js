
import { attachAuthUI, initUX, db, ADMIN_NUMERIC_IDS } from "./common.js";
import { doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp, collection } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

attachAuthUI({ requireSignIn: true });
initUX();

const $ = (s)=>document.querySelector(s);
const roomView = $('#roomView'), title=$('#rvTitle'), meta=$('#rvMeta'), left=$('#left'), actions=$('#rvActions'), board=$('#scoreboard');

function isAdmin(){ return ADMIN_NUMERIC_IDS.includes(Number(window.__mcUser?.profile?.numericId)); }

async function createRoom(){
  if(!isAdmin()) return alert('Faqat admin.');
  const id=$('#newRoomId').value.trim(); const dur=Number($('#duration').value||30);
  if(!id) return alert('Xona ID kiriting');
  await setDoc(doc(db,'liveRooms',id), { roomId:id, createdAt:serverTimestamp(), status:'waiting', joinLocked:false, durationMin:dur, startAt:null, startedBy:null, endedAt:null });
  alert('Xona yaratildi');
}
async function startRoom(){
  if(!isAdmin()) return alert('Faqat admin.');
  const id = window.__curRoomId; if(!id) return;
  const startAt = new Date($('#startAt').value || Date.now());
  await updateDoc(doc(db,'liveRooms',id), { status:'starting', startAt, joinLocked:true, startedBy: window.__mcUser.profile.numericId });
}
async function endRoom(){
  if(!isAdmin()) return alert('Faqat admin.');
  const id = window.__curRoomId; if(!id) return;
  await updateDoc(doc(db,'liveRooms',id), { status:'ended', endedAt: new Date() });
}
async function joinRoom(){
  const id = $('#roomId').value.trim(); if(!id) return alert('Xona ID kiriting');
  const ref = doc(db,'liveRooms',id); const snap = await getDoc(ref);
  if(!snap.exists()) return alert('Xona topilmadi');
  const room=snap.data(); if(room.joinLocked) return alert('Kech: startdan keyin qo‘shib bo‘lmaydi');
  const pRef = doc(db,'liveRooms',id,'participants', window.__mcUser.user.uid);
  await setDoc(pRef, { uid: window.__mcUser.user.uid, displayName: window.__mcUser.profile.displayName||'Foydalanuvchi', numericId: window.__mcUser.profile.numericId||null, score:0, joinedAt:serverTimestamp(), lastUpdate:serverTimestamp() }, { merge:true });
  watchRoom(id);
}

let unsubRoom=null, unsubParts=null, tickInt=null;
function renderActions(room){
  actions.innerHTML='';
  if(isAdmin()){
    actions.innerHTML = `<button class="btn primary" id="actStart">Start</button> <button class="btn danger" id="actEnd">Tugatish</button>`;
    document.querySelector('#actStart')?.addEventListener('click', startRoom);
    document.querySelector('#actEnd')?.addEventListener('click', endRoom);
  }else{
    actions.innerHTML = `<div class="hint">${room.status==='waiting'?'Kuting… boshlanishi bilan “Boshlash” paydo bo‘ladi.':''}</div>`;
  }
}
function tick(room){
  if(!room.startAt || room.status!=='starting'){ left.textContent='—'; return; }
  const start=new Date(room.startAt); const end=new Date(start.getTime()+(room.durationMin||30)*60000); const now=new Date();
  if(now<start){ const sec=Math.max(0,Math.floor((start-now)/1000)); left.textContent = `Startgacha: ${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`; }
  else if(now<=end){ const sec=Math.max(0,Math.floor((end-now)/1000)); left.textContent = `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`; }
  else left.textContent='00:00';
}
function renderBoard(partsSnap){
  board.innerHTML=''; const arr=[]; partsSnap.forEach(d=>arr.push(d.data())); arr.sort((a,b)=>(b.score||0)-(a.score||0));
  arr.forEach((p,i)=>{ const div=document.createElement('div'); div.className='card'; div.innerHTML=`<b>${i+1}.</b> ${p.displayName} <span class="pill">ID: ${p.numericId??'—'}</span> <span class="pill">Score: ${p.score??0}</span>`; board.appendChild(div); });
}
async function watchRoom(id){
  window.__curRoomId = id;
  unsubRoom?.(); unsubParts?.(); clearInterval(tickInt);
  roomView.classList.remove('hidden');
  unsubRoom = onSnapshot(doc(db,'liveRooms',id), (snap)=>{
    if(!snap.exists()){ roomView.classList.add('hidden'); return; }
    const room=snap.data(); title.textContent=`Xona: ${room.roomId}`; meta.textContent=`Holat: ${room.status} — Davomiylik: ${room.durationMin} daq`; renderActions(room); window.__curRoom = room;
  });
  unsubParts = onSnapshot(collection(db,'liveRooms',id,'participants'), renderBoard);
  tickInt = setInterval(()=> window.__curRoom && tick(window.__curRoom), 1000);
}

document.addEventListener('click', (e)=>{
  if(e.target.id==='btnCreateRoom') createRoom();
  if(e.target.id==='btnStart') startRoom();
  if(e.target.id==='btnEnd') endRoom();
  if(e.target.id==='btnJoin') joinRoom();
});
