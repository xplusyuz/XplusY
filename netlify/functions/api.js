import crypto from "node:crypto";
import { getStore } from "@netlify/blobs";

const ADMIN_KEY = process.env.ADMIN_KEY || "LEADERMATH_SUPER_2026";
const TOKEN_SECRET = process.env.TOKEN_SECRET || "dev-secret-change-me";

const store = getStore("leadermath");

function json(statusCode, obj, headers={}){
  return {
    statusCode,
    headers: { "Content-Type":"application/json; charset=utf-8", ...headers },
    body: JSON.stringify(obj)
  };
}

function b64url(buf){
  return Buffer.from(buf).toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
function b64urlDecode(str){
  str = str.replace(/-/g,"+").replace(/_/g,"/");
  while(str.length % 4) str += "=";
  return Buffer.from(str, "base64");
}

function signToken(payload){
  const header = {alg:"HS256", typ:"JWT"};
  const encHeader = b64url(JSON.stringify(header));
  const encPayload = b64url(JSON.stringify(payload));
  const data = `${encHeader}.${encPayload}`;
  const sig = crypto.createHmac("sha256", TOKEN_SECRET).update(data).digest();
  return `${data}.${b64url(sig)}`;
}
function verifyToken(token){
  const parts = String(token||"").split(".");
  if(parts.length!==3) throw new Error("Token noto‘g‘ri");
  const [h,p,s] = parts;
  const data = `${h}.${p}`;
  const sig = crypto.createHmac("sha256", TOKEN_SECRET).update(data).digest();
  const expected = b64url(sig);
  if(expected !== s) throw new Error("Token imzosi xato");
  const payload = JSON.parse(b64urlDecode(p).toString("utf8"));
  if(payload.exp && Date.now() > payload.exp) throw new Error("Token eskirgan");
  return payload;
}

function randDigits(n){
  let out = "";
  for(let i=0;i<n;i++) out += String(Math.floor(Math.random()*10));
  return out;
}
function genLoginId(){
  return `LM-${randDigits(6)}`;
}
function genPassword(){
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$";
  let p = "";
  for(let i=0;i<9;i++) p += alphabet[Math.floor(Math.random()*alphabet.length)];
  return p;
}

function scryptHash(password, salt){
  const hash = crypto.scryptSync(password, salt, 32);
  return hash.toString("hex");
}

async function loadUsers(){
  const raw = await store.get("users", { type: "json" });
  return raw || {};
}
async function saveUsers(users){
  await store.set("users", JSON.stringify(users), { contentType: "application/json" });
}

async function loadContent(){
  const raw = await store.get("content", { type: "json" });
  if(raw) return raw;
  const seed = {
    banners: [
      { id: crypto.randomUUID(), title:"LeaderMath.UZ", subtitle:"Boshlang — ID+Parol avtomatik", img:"", href:"", active:true }
    ],
    cards: [
      { id: crypto.randomUUID(), title:"DTM Mashqlar", desc:"DTM formatdagi savollar", href:"", tag:"DTM", active:true },
      { id: crypto.randomUUID(), title:"Olimpiada", desc:"Agentlik/olimpiada tayyorlov", href:"", tag:"Olimpiada", active:true }
    ]
  };
  await store.set("content", JSON.stringify(seed), { contentType:"application/json" });
  return seed;
}
async function saveContent(content){
  await store.set("content", JSON.stringify(content), { contentType:"application/json" });
}

function getBearer(event){
  const h = event.headers?.authorization || event.headers?.Authorization || "";
  const m = String(h).match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : "";
}

export async function handler(event){
  try{
    const method = event.httpMethod || "GET";
    const qpath = (event.queryStringParameters?.path || "").replace(/^\/+/,"");
    const path = "/" + qpath;

    // CORS (optional)
    if(method === "OPTIONS"){
      return {
        statusCode: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "content-type, authorization, x-admin-key",
          "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS"
        },
        body: ""
      };
    }

    // ===== AUTH REGISTER =====
    if(path === "/auth/register" && method === "POST"){
      const users = await loadUsers();

      // generate unique id
      let loginId = genLoginId();
      let tries = 0;
      while(users[loginId] && tries < 10){
        loginId = genLoginId(); tries++;
      }
      if(users[loginId]) return json(500, {error:"ID yaratib bo‘lmadi, qayta urinib ko‘ring"});

      const passwordPlain = genPassword();
      const salt = crypto.randomBytes(16).toString("hex");
      const passwordHash = scryptHash(passwordPlain, salt);

      const user = {
        loginId,
        salt,
        passwordHash,
        name: "",
        points: 0,
        balance: 0,
        createdAt: new Date().toISOString()
      };
      users[loginId] = user;
      await saveUsers(users);

      const token = signToken({ sub: loginId, exp: Date.now() + 1000*60*60*24*14 }); // 14 days
      return json(200, { token, user: { ...pickPublic(user), passwordPlain } });
    }

    // ===== AUTH LOGIN =====
    if(path === "/auth/login" && method === "POST"){
      const body = JSON.parse(event.body || "{}");
      const loginId = String(body.loginId||"").trim();
      const password = String(body.password||"");

      if(!loginId || !password) return json(400, {error:"ID va parol kerak"});
      const users = await loadUsers();
      const user = users[loginId];
      if(!user) return json(404, {error:"Bunday ID topilmadi"});

      const calc = scryptHash(password, user.salt);
      if(calc !== user.passwordHash) return json(401, {error:"Parol noto‘g‘ri"});

      const token = signToken({ sub: loginId, exp: Date.now() + 1000*60*60*24*14 });
      return json(200, { token, user: pickPublic(user) });
    }

    // ===== AUTH ME =====
    if(path === "/auth/me" && method === "GET"){
      const token = getBearer(event);
      if(!token) return json(401, {error:"Token yo‘q"});
      const payload = verifyToken(token);
      const users = await loadUsers();
      const user = users[payload.sub];
      if(!user) return json(401, {error:"Foydalanuvchi topilmadi"});
      return json(200, { user: pickPublic(user) });
    }

    // ===== USER CONTENT =====
    if(path === "/content" && method === "GET"){
      const token = getBearer(event);
      if(!token) return json(401, {error:"Token yo‘q"});
      verifyToken(token);
      const content = await loadContent();
      return json(200, content);
    }

    // ===== ADMIN GUARD =====
    function adminGuard(){
      const k = event.headers?.["x-admin-key"] || event.headers?.["X-Admin-Key"] || "";
      if(String(k).trim() !== ADMIN_KEY) throw new Error("Admin key noto‘g‘ri");
    }

    // ===== ADMIN CONTENT =====
    if(path === "/admin/content" && method === "GET"){
      adminGuard();
      const content = await loadContent();
      return json(200, content);
    }
    if(path === "/admin/content" && method === "POST"){
      adminGuard();
      const body = JSON.parse(event.body || "{}");
      // minimal validation
      const next = {
        banners: Array.isArray(body.banners) ? body.banners : [],
        cards: Array.isArray(body.cards) ? body.cards : []
      };
      await saveContent(next);
      return json(200, {ok:true});
    }

    // ===== ADMIN USERS =====
    if(path === "/admin/users" && method === "GET"){
      adminGuard();
      const users = await loadUsers();
      const list = Object.values(users).map(pickPublic).sort((a,b)=> (b.points||0)-(a.points||0));
      return json(200, { users: list });
    }
    if(path === "/admin/users" && method === "PATCH"){
      adminGuard();
      const body = JSON.parse(event.body || "{}");
      const loginId = String(body.loginId||"").trim();
      if(!loginId) return json(400, {error:"loginId kerak"});
      const users = await loadUsers();
      const user = users[loginId];
      if(!user) return json(404, {error:"User topilmadi"});

      const points = Number(body.points ?? user.points ?? 0);
      const balance = Number(body.balance ?? user.balance ?? 0);
      const name = String(body.name ?? user.name ?? "");

      user.points = Number.isFinite(points) ? Math.max(0, Math.floor(points)) : (user.points||0);
      user.balance = Number.isFinite(balance) ? Math.max(0, Math.floor(balance)) : (user.balance||0);
      user.name = name.slice(0, 80);

      users[loginId] = user;
      await saveUsers(users);
      return json(200, { ok:true, user: pickPublic(user) });
    }

    return json(404, {error:"Endpoint topilmadi", path});
  }catch(e){
    return json(500, {error: e.message || "Xatolik"});
  }
}

function pickPublic(u){
  return {
    loginId: u.loginId,
    name: u.name || "",
    points: u.points ?? 0,
    balance: u.balance ?? 0,
    createdAt: u.createdAt || ""
  };
}
