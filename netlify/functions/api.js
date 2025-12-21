const admin=require("firebase-admin");const crypto=require("crypto");
const json=(s,d)=>({statusCode:s,headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type, Authorization","Access-Control-Allow-Methods":"GET,POST,OPTIONS"},body:JSON.stringify(d)});
const b64u=b=>Buffer.from(b).toString("base64").replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
const sha=s=>crypto.createHash("sha256").update(s).digest("hex");
const sign=(p,sec,exp=60*60*24*14)=>{const h=b64u(JSON.stringify({alg:"HS256",typ:"JWT"}));const now=Math.floor(Date.now()/1000);const pl=b64u(JSON.stringify({...p,iat:now,exp:now+exp}));
const sig=b64u(crypto.createHmac("sha256",sec).update(h+"."+pl).digest());return h+"."+pl+"."+sig;};
const verify=(t,sec)=>{const a=(t||"").split(".");if(a.length!==3)return null;const sig=b64u(crypto.createHmac("sha256",sec).update(a[0]+"."+a[1]).digest());if(sig!==a[2])return null;
const p=JSON.parse(Buffer.from(a[1].replace(/-/g,"+").replace(/_/g,"/"),"base64").toString("utf8"));if(p.exp && Math.floor(Date.now()/1000)>p.exp)return null;return p;};
const init=()=>{if(admin.apps.length)return;const svc=process.env.FIREBASE_SERVICE_ACCOUNT;if(!svc)throw new Error("FIREBASE_SERVICE_ACCOUNT env yo‘q");admin.initializeApp({credential:admin.credential.cert(JSON.parse(svc))});};
const makeId=(n=6)=>{const A="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";let o="";for(let i=0;i<n;i++)o+=A[Math.floor(Math.random()*A.length)];return o;};
const pwWarn=(pw)=>{const w=[];if(pw.length<4)w.push("Maxfiy so‘z juda qisqa (4+ tavsiya).");if(/^\d+$/.test(pw))w.push("Faqat raqam — juda oson.");
if(/^[a-zA-Z]+$/.test(pw))w.push("Faqat harf — kuchsiz.");return w;};
const uidFrom=(e)=>{const a=e.headers.authorization||e.headers.Authorization||"";const t=a.startsWith("Bearer ")?a.slice(7):"";const sec=process.env.APP_JWT_SECRET||"dev_secret_change_me";return verify(t,sec)?.uid||null;};
exports.handler=async(event)=>{if(event.httpMethod==="OPTIONS")return json(200,{ok:true});
try{init();const db=admin.firestore();const path=(event.path||"").replace("/.netlify/functions/api","");const m=event.httpMethod;
if(path==="/auth/login-step1"&&m==="POST"){const {id}=JSON.parse(event.body||"{}");if(!id)return json(400,{error:"ID kerak"});const snap=await db.collection("users").doc(String(id).trim().toUpperCase()).get();return json(200,{exists:snap.exists});}
if(path==="/auth/new"&&m==="POST"){const {password}=JSON.parse(event.body||"{}");const pw=String(password??"");if(pw.length<1||pw.length>20)return json(400,{error:"Maxfiy so‘z 1..20 bo‘lsin"});
let id="";for(let i=0;i<10;i++){id=makeId(6);const s=await db.collection("users").doc(id).get();if(!s.exists)break;if(i===9)return json(500,{error:"ID yaratib bo‘lmadi"});}
const salt=crypto.randomBytes(16).toString("hex");const passHash=sha(salt+pw);await db.collection("users").doc(id).set({id,salt,passHash,createdAt:admin.firestore.FieldValue.serverTimestamp(),points:0,avatarUrl:"",profile:{},profileCompleted:false});
const token=sign({uid:id},process.env.APP_JWT_SECRET||"dev_secret_change_me");return json(200,{id,token,warnings:pwWarn(pw)});}
if(path==="/auth/login"&&m==="POST"){const {id,password}=JSON.parse(event.body||"{}");const uid=String(id||"").trim().toUpperCase();const pw=String(password||"");
if(!uid||!pw)return json(400,{error:"ID va maxfiy so‘z kerak"});const snap=await db.collection("users").doc(uid).get();if(!snap.exists)return json(404,{error:"Bunday ID topilmadi"});
const u=snap.data();if(sha((u.salt||"")+pw)!==u.passHash)return json(401,{error:"Maxfiy so‘z noto‘g‘ri"});return json(200,{token:sign({uid},process.env.APP_JWT_SECRET||"dev_secret_change_me")});}
if(path==="/me"&&m==="GET"){const uid=uidFrom(event);if(!uid)return json(401,{error:"Token yo‘q"});const snap=await db.collection("users").doc(uid).get();if(!snap.exists)return json(404,{error:"User topilmadi"});
const u=snap.data();let age=null;const bd=u?.profile?.birthDate;if(bd){const d=new Date(bd);if(!isNaN(d.getTime())){const now=new Date();age=now.getFullYear()-d.getFullYear();const mm=now.getMonth()-d.getMonth();if(mm<0||(mm===0&&now.getDate()<d.getDate()))age--;}}
return json(200,{id:u.id,points:u.points||0,avatarUrl:u.avatarUrl||"",profile:u.profile||{},profileCompleted:!!u.profileCompleted,age});}
if(path==="/me/profile"&&m==="POST"){const uid=uidFrom(event);if(!uid)return json(401,{error:"Token yo‘q"});const b=JSON.parse(event.body||"{}");
const p={firstName:String(b.firstName||"").trim(),lastName:String(b.lastName||"").trim(),birthDate:String(b.birthDate||"").trim(),region:String(b.region||"").trim(),district:String(b.district||"").trim()};
if(!p.firstName||!p.lastName||!p.birthDate||!p.region||!p.district)return json(400,{error:"Barcha maydonlar majburiy"});
await db.collection("users").doc(uid).update({profile:p,profileCompleted:true});return json(200,{ok:true});}
if(path==="/me/avatar"&&m==="POST"){const uid=uidFrom(event);if(!uid)return json(401,{error:"Token yo‘q"});const {avatarUrl}=JSON.parse(event.body||"{}");await db.collection("users").doc(uid).update({avatarUrl:String(avatarUrl||"").trim()});return json(200,{ok:true});}
if(path==="/app"&&m==="GET"){const a=await db.collection("configs").doc("app").get();const app=a.exists?a.data():{version:1,nav:[]};const ids=[...new Set((app.nav||[]).map(n=>n.sectionId).filter(Boolean))];const sections={};
for(const sid of ids){const s=await db.collection("sections").doc(sid).get();sections[sid]=s.exists?s.data():{title:sid,chips:[{id:"all",label:"Hammasi"}],items:[]};}
return json(200,{version:app.version||1,nav:app.nav||[],sections});}
if(path==="/rank"&&m==="GET"){const top=await db.collection("users").orderBy("points","desc").limit(50).get();
return json(200,{items:top.docs.map((d,i)=>{const u=d.data();return{place:i+1,id:u.id,name:`${u?.profile?.firstName||"?"} ${u?.profile?.lastName||""}`.trim(),points:u.points||0,avatarUrl:u.avatarUrl||""};})});}
return json(404,{error:"Not found"});}catch(e){return json(500,{error:e.message||"Server error"});}};