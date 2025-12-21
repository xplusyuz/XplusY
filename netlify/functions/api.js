const admin=require("firebase-admin");const crypto=require("crypto");

const headers={
  "Content-Type":"application/json",
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"Content-Type, Authorization",
  "Access-Control-Allow-Methods":"GET,POST,PATCH,OPTIONS"
};
const json=(s,d)=>({statusCode:s,headers,body:JSON.stringify(d)});
const b64u=b=>Buffer.from(b).toString("base64").replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
const sha=s=>crypto.createHash("sha256").update(s).digest("hex");

function sign(payload, secret, expSec=60*60*24*14){
  const now=Math.floor(Date.now()/1000);
  const h=b64u(JSON.stringify({alg:"HS256",typ:"JWT"}));
  const p=b64u(JSON.stringify({...payload,iat:now,exp:now+expSec}));
  const sig=b64u(crypto.createHmac("sha256",secret).update(h+"."+p).digest());
  return h+"."+p+"."+sig;
}
function verify(token, secret){
  const a=(token||"").split("."); if(a.length!==3) return null;
  const sig=b64u(crypto.createHmac("sha256",secret).update(a[0]+"."+a[1]).digest());
  if(sig!==a[2]) return null;
  const p=JSON.parse(Buffer.from(a[1].replace(/-/g,"+").replace(/_/g,"/"),"base64").toString("utf8"));
  if(p.exp && Math.floor(Date.now()/1000)>p.exp) return null;
  return p;
}

function init(){
  if(admin.apps.length) return;
  const svc=process.env.FIREBASE_SERVICE_ACCOUNT;
  if(!svc) throw new Error("FIREBASE_SERVICE_ACCOUNT env yo‘q");
  admin.initializeApp({credential:admin.credential.cert(JSON.parse(svc))});
}
function makeId(n=6){
  const A="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let o=""; for(let i=0;i<n;i++) o+=A[Math.floor(Math.random()*A.length)];
  return o;
}
function genPassword(len=8){
  const A="ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  let o=""; for(let i=0;i<len;i++) o+=A[Math.floor(Math.random()*A.length)];
  return o;
}
function pwWarnings(pw){
  const w=[];
  if(pw.length<4) w.push("Maxfiy so‘z juda qisqa (4+ tavsiya).");
  if(/^\d+$/.test(pw)) w.push("Faqat raqam — juda oson.");
  if(/^[a-zA-Z]+$/.test(pw)) w.push("Faqat harf — kuchsiz.");
  return w;
}
function tokenFromReq(event){
  const a=event.headers.authorization||event.headers.Authorization||"";
  return a.startsWith("Bearer ")?a.slice(7):"";
}
function uidFromReq(event){
  const token=tokenFromReq(event);
  const sec=process.env.APP_JWT_SECRET||"dev_secret_change_me";
  return verify(token,sec)?.uid||null;
}
async function getUser(db, uid){
  const snap=await db.collection("users").doc(uid).get();
  if(!snap.exists) return null;
  return snap.data();
}
function calcAge(birthDate){
  if(!birthDate) return null;
  const d=new Date(birthDate);
  if(isNaN(d.getTime())) return null;
  const now=new Date();
  let age=now.getFullYear()-d.getFullYear();
  const mm=now.getMonth()-d.getMonth();
  if(mm<0||(mm===0&&now.getDate()<d.getDate())) age--;
  return age;
}

exports.handler=async(event)=>{
  if(event.httpMethod==="OPTIONS") return json(200,{ok:true});
  try{
    init();
    const db=admin.firestore();
    const sec=process.env.APP_JWT_SECRET||"dev_secret_change_me";
    const path=(event.path||"").replace("/.netlify/functions/api","");
    const m=event.httpMethod;

    // ====== NEW API (recommended) ======
    if(path==="/auth/login-step1" && m==="POST"){
      const {id}=JSON.parse(event.body||"{}");
      if(!id) return json(400,{error:"ID kerak"});
      const uid=String(id).trim().toUpperCase();
      const snap=await db.collection("users").doc(uid).get();
      return json(200,{exists:snap.exists});
    }

    if(path==="/auth/new" && m==="POST"){
      const {password}=JSON.parse(event.body||"{}");
      const pw=String(password??"");
      if(pw.length<1 || pw.length>20) return json(400,{error:"Maxfiy so‘z 1..20 bo‘lsin"});
      let uid="";
      for(let i=0;i<12;i++){
        uid=makeId(6);
        const s=await db.collection("users").doc(uid).get();
        if(!s.exists) break;
        if(i===11) return json(500,{error:"ID yaratib bo‘lmadi"});
      }
      const salt=crypto.randomBytes(16).toString("hex");
      const passHash=sha(salt+pw);
      await db.collection("users").doc(uid).set({
        id:uid, salt, passHash,
        createdAt:admin.firestore.FieldValue.serverTimestamp(),
        points:0,
        avatarUrl:"",
        avatarData:"",
        profile:{},
        profileCompleted:false
      });
      const token=sign({uid},sec);
      return json(200,{id:uid, token, warnings:pwWarnings(pw)});
    }

    if(path==="/auth/login" && m==="POST"){
      const {id,password}=JSON.parse(event.body||"{}");
      const uid=String(id||"").trim().toUpperCase();
      const pw=String(password||"");
      if(!uid||!pw) return json(400,{error:"ID va maxfiy so‘z kerak"});
      const u=await getUser(db,uid);
      if(!u) return json(404,{error:"Bunday ID topilmadi"});
      if(sha((u.salt||"")+pw)!==u.passHash) return json(401,{error:"Maxfiy so‘z noto‘g‘ri"});
      const token=sign({uid},sec);
      // legacy-compatible response too:
      return json(200,{
        token,
        sessionId: token,
        user: { id: u.id, points: u.points||0, avatar: u.avatarData||u.avatarUrl||"", profile: u.profile||{} }
      });
    }

    if(path==="/me" && m==="GET"){
      const uid=uidFromReq(event);
      if(!uid) return json(401,{error:"Token yo‘q"});
      const u=await getUser(db,uid);
      if(!u) return json(404,{error:"User topilmadi"});
      const age=calcAge(u?.profile?.birthDate);
      return json(200,{
        id:u.id,
        points:u.points||0,
        avatarUrl:u.avatarUrl||"",
        avatarData:u.avatarData||"",
        profile:u.profile||{},
        profileCompleted:!!u.profileCompleted,
        age
      });
    }

    if(path==="/me/profile" && (m==="POST"||m==="PATCH")){
      const uid=uidFromReq(event);
      if(!uid) return json(401,{error:"Token yo‘q"});
      const b=JSON.parse(event.body||"{}");
      const p={
        firstName:String(b.firstName||b.ism||b.first||"").trim(),
        lastName:String(b.lastName||b.familiya||b.last||"").trim(),
        birthDate:String(b.birthDate||b.birth||b.tugulgan||"").trim(),
        region:String(b.region||b.viloyat||"").trim(),
        district:String(b.district||b.tuman||"").trim()
      };
      if(!p.firstName||!p.lastName||!p.birthDate||!p.region||!p.district) return json(400,{error:"Barcha maydonlar majburiy"});
      await db.collection("users").doc(uid).update({profile:p,profileCompleted:true});
      const u=await getUser(db,uid);
      return json(200,{ok:true, user:{ id:u.id, points:u.points||0, avatar:u.avatarData||u.avatarUrl||"", profile:u.profile||{} }});
    }

    if(path==="/me/avatar" && m==="POST"){
      const uid=uidFromReq(event);
      if(!uid) return json(401,{error:"Token yo‘q"});
      const b=JSON.parse(event.body||"{}");
      const avatarUrl=String(b.avatarUrl||"").trim();
      const avatarData=String(b.avatar||b.avatarData||"").trim();
      if(avatarData && avatarData.length>120000) return json(400,{error:"Avatar juda katta. URL ishlating."});
      await db.collection("users").doc(uid).update({
        avatarUrl: avatarUrl || "",
        avatarData: avatarData || ""
      });
      return json(200,{ok:true});
    }

    if(path==="/me/password" && m==="POST"){
      const uid=uidFromReq(event);
      if(!uid) return json(401,{error:"Token yo‘q"});
      const {currentPassword,newPassword}=JSON.parse(event.body||"{}");
      const cur=String(currentPassword||"");
      const nw=String(newPassword||"");
      if(nw.length<1||nw.length>20) return json(400,{error:"Yangi maxfiy so‘z 1..20 bo‘lsin"});
      const u=await getUser(db,uid);
      if(!u) return json(404,{error:"User topilmadi"});
      if(sha((u.salt||"")+cur)!==u.passHash) return json(401,{error:"Joriy maxfiy so‘z noto‘g‘ri"});
      const salt=crypto.randomBytes(16).toString("hex");
      const passHash=sha(salt+nw);
      await db.collection("users").doc(uid).update({salt,passHash});
      return json(200,{ok:true,warnings:pwWarnings(nw)});
    }

    if(path==="/app" && m==="GET"){
      const a=await db.collection("configs").doc("app").get();
      const app=a.exists?a.data():{version:1,nav:[]};
      const ids=[...new Set((app.nav||[]).map(n=>n.sectionId).filter(Boolean))];
      const sections={};
      for(const sid of ids){
        const s=await db.collection("sections").doc(sid).get();
        sections[sid]=s.exists?s.data():{title:sid,chips:[{id:"all",label:"Hammasi"}],items:[]};
      }
      return json(200,{version:app.version||1,nav:app.nav||[],sections});
    }

    if((path==="/rank" || path==="/ranking") && m==="GET"){
      const top=await db.collection("users").orderBy("points","desc").limit(50).get();
      const users=top.docs.map((d,i)=>{const u=d.data();return{
        place:i+1,
        id:u.id,
        name:`${u?.profile?.firstName||""} ${u?.profile?.lastName||""}`.trim()||u.id,
        points:u.points||0,
        avatar:u.avatarData||u.avatarUrl||""
      };});
      // /ranking expects {users: [...]}
      if(path==="/ranking") return json(200,{users});
      return json(200,{items:users});
    }

    // ====== LEGACY COMPAT (so your current design JS works) ======
    if(path==="/auth/register" && m==="POST"){
      const pw=genPassword(8);
      // create via same logic as /auth/new
      let uid="";
      for(let i=0;i<12;i++){
        uid=makeId(6);
        const s=await db.collection("users").doc(uid).get();
        if(!s.exists) break;
        if(i===11) return json(500,{error:"ID yaratib bo‘lmadi"});
      }
      const salt=crypto.randomBytes(16).toString("hex");
      const passHash=sha(salt+pw);
      await db.collection("users").doc(uid).set({
        id:uid, salt, passHash,
        createdAt:admin.firestore.FieldValue.serverTimestamp(),
        points:0,
        avatarUrl:"",
        avatarData:"",
        profile:{},
        profileCompleted:false
      });
      const token=sign({uid},sec);
      return json(200,{
        token,
        sessionId: token,
        user:{ id:uid, loginId:uid, password:pw },
        warnings: pwWarnings(pw)
      });
    }

    // GET /auth/session/:sessionId  (sessionId === token)
    if(path.startsWith("/auth/session/") && m==="GET"){
      const sessionId=decodeURIComponent(path.slice("/auth/session/".length));
      const payload=verify(sessionId,sec);
      if(!payload?.uid) return json(401,{error:"Session yaroqsiz"});
      const u=await getUser(db,payload.uid);
      if(!u) return json(404,{error:"User topilmadi"});
      return json(200,{user:{ id:u.id, points:u.points||0, avatar:u.avatarData||u.avatarUrl||"", profile:u.profile||{}, profileCompleted:!!u.profileCompleted }});
    }

    // /user/:sessionId (PATCH)
    if(path.startsWith("/user/") && m==="PATCH"){
      const rest=path.slice("/user/".length);
      const sessionId=decodeURIComponent(rest.split("/")[0]);
      const payload=verify(sessionId,sec);
      if(!payload?.uid) return json(401,{error:"Session yaroqsiz"});
      const b=JSON.parse(event.body||"{}");
      // Accept partial updates (design may send many fields)
      const update={};
      if(b.firstName||b.lastName||b.birthDate||b.region||b.district){
        update.profile={
          firstName:String(b.firstName||"").trim(),
          lastName:String(b.lastName||"").trim(),
          birthDate:String(b.birthDate||"").trim(),
          region:String(b.region||"").trim(),
          district:String(b.district||"").trim()
        };
        update.profileCompleted=!!(update.profile.firstName&&update.profile.lastName&&update.profile.birthDate&&update.profile.region&&update.profile.district);
      } else {
        // If updateData already matches your old schema, store as profile as-is:
        update.profile=b;
        update.profileCompleted=true;
      }
      await db.collection("users").doc(payload.uid).set(update,{merge:true});
      const u=await getUser(db,payload.uid);
      return json(200,{user:{ id:u.id, points:u.points||0, avatar:u.avatarData||u.avatarUrl||"", profile:u.profile||{}, profileCompleted:!!u.profileCompleted }});
    }

    // /user/:sessionId/avatar (POST)
    if(path.startsWith("/user/") && path.endsWith("/avatar") && m==="POST"){
      const parts=path.split("/");
      const sessionId=decodeURIComponent(parts[2]||"");
      const payload=verify(sessionId,sec);
      if(!payload?.uid) return json(401,{error:"Session yaroqsiz"});
      const b=JSON.parse(event.body||"{}");
      const avatar=String(b.avatar||"").trim();
      if(avatar && avatar.length>120000) return json(400,{error:"Avatar juda katta. URL ishlating."});
      await db.collection("users").doc(payload.uid).update({avatarData:avatar});
      return json(200,{ok:true});
    }

    // /user/:sessionId/password (POST)
    if(path.startsWith("/user/") && path.endsWith("/password") && m==="POST"){
      const parts=path.split("/");
      const sessionId=decodeURIComponent(parts[2]||"");
      const payload=verify(sessionId,sec);
      if(!payload?.uid) return json(401,{error:"Session yaroqsiz"});
      const {currentPassword,newPassword}=JSON.parse(event.body||"{}");
      const cur=String(currentPassword||"");
      const nw=String(newPassword||"");
      if(nw.length<1||nw.length>20) return json(400,{error:"Yangi maxfiy so‘z 1..20 bo‘lsin"});
      const u=await getUser(db,payload.uid);
      if(!u) return json(404,{error:"User topilmadi"});
      if(sha((u.salt||"")+cur)!==u.passHash) return json(401,{error:"Joriy maxfiy so‘z noto‘g‘ri"});
      const salt=crypto.randomBytes(16).toString("hex");
      const passHash=sha(salt+nw);
      await db.collection("users").doc(payload.uid).update({salt,passHash});
      return json(200,{ok:true,warnings:pwWarnings(nw)});
    }

    return json(404,{error:"Not found"});
  }catch(e){
    return json(500,{error:e.message||"Server error"});
  }
};
