/**
 * Cloud Functions: import1688Product
 * - Admin check (custom claims)
 * - Fetch URL HTML
 * - Heuristic parse: title, price text, images (og:image + common script patterns)
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");
const cheerio = require("cheerio");

admin.initializeApp();

const db = admin.firestore();

// ✅ Admin emails (o'zingizniki bilan to'ldiring)
const ADMIN_EMAILS = ["sohibjonmath@gmail.com"];

// Set custom claims on sign-in (1 martalik)
exports.onUserCreateOrSignIn = functions.auth.user().onCreate(async (user) => {
  try {
    const isAdmin = ADMIN_EMAILS.includes((user.email || "").toLowerCase());
    if (isAdmin) {
      await admin.auth().setCustomUserClaims(user.uid, { admin: true });
    }
  } catch (e) {
    console.error("setCustomClaims error", e);
  }
});

// Helper: normalize images
function uniq(arr){
  const seen = new Set();
  const out = [];
  for(const x of arr || []){
    const v = (x || "").toString().trim();
    if(!v) continue;
    if(seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

// Helper: try to extract JSON blobs from scripts
function extractJsonCandidates(html){
  const candidates = [];
  const re = /\{[^\{\}]{0,8000}\}/g; // small-ish JSON-like objects
  let m;
  while((m = re.exec(html)) !== null){
    const s = m[0];
    // quick filter to reduce noise
    if(!/(image|img|price|title|sku|offers)/i.test(s)) continue;
    candidates.push(s);
    if(candidates.length > 40) break;
  }
  return candidates;
}

function safeParseJson(str){
  try{
    // remove trailing commas
    const cleaned = str.replace(/,\s*([\}\]])/g, "$1");
    return JSON.parse(cleaned);
  }catch{
    return null;
  }
}

function pickFromJson(obj, out){
  if(!obj || typeof obj !== "object") return;

  const stack = [obj];
  while(stack.length){
    const cur = stack.pop();
    if(!cur || typeof cur !== "object") continue;

    // images
    for(const k of ["images","image","imgs","img","picUrl","pic","pics","detailPics","gallery"]){
      const v = cur[k];
      if(Array.isArray(v)){
        for(const it of v){
          if(typeof it === "string") out.images.push(it);
          else if(it && typeof it === "object"){
            for(const kk of ["url","src","imgUrl","big","large","origin","original"]){
              if(typeof it[kk] === "string") out.images.push(it[kk]);
            }
          }
        }
      } else if(typeof v === "string"){
        out.images.push(v);
      }
    }

    // title/name
    for(const k of ["title","name","productTitle","subject","offerTitle"]){
      if(!out.title && typeof cur[k] === "string" && cur[k].length > 4) out.title = cur[k];
    }

    // price text
    for(const k of ["price","priceText","salePrice","amount","minPrice","maxPrice","displayPrice","unitPrice"]){
      if(!out.priceText && (typeof cur[k] === "string" || typeof cur[k] === "number")){
        out.priceText = String(cur[k]);
      }
    }

    // traverse
    const vals = Object.values(cur);
    for(const v of vals){
      if(v && typeof v === "object") stack.push(v);
    }
  }
}

exports.import1688Product = functions.https.onCall(async (data, context) => {
  try{
    if(!context.auth) return { ok:false, error:"AUTH_REQUIRED" };
    const token = context.auth.token || {};
    if(token.admin !== true) return { ok:false, error:"ADMIN_ONLY" };

    const url = (data && data.url || "").toString().trim();
    if(!/^https?:\/\//i.test(url)) return { ok:false, error:"BAD_URL" };

    const resp = await axios.get(url, {
      timeout: 20000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9,ru;q=0.8,uz;q=0.7"
      },
      maxRedirects: 5,
      validateStatus: (s) => s >= 200 && s < 400
    });

    const html = resp.data;
    const $ = cheerio.load(html);

    // Basic title
    let title = $("meta[property='og:title']").attr("content") || $("title").text().trim();
    title = (title || "").replace(/\s+/g, " ").trim();

    // Price (best-effort)
    let priceText = $("meta[property='product:price:amount']").attr("content")
      || $("meta[name='price']").attr("content")
      || $("meta[itemprop='price']").attr("content")
      || "";

    // Images
    const images = [];
    const ogImg = $("meta[property='og:image']").attr("content");
    if(ogImg) images.push(ogImg);

    $("img").each((_, el) => {
      const src = $(el).attr("data-src") || $(el).attr("src");
      if(!src) return;
      if(/^data:/i.test(src)) return;
      if(!/\.(png|jpg|jpeg|webp)(\?|$)/i.test(src) && !/alicdn|1688|taobao|img/i.test(src)) return;
      images.push(src);
    });

    // Try scripts JSON candidates
    const scriptText = $("script").map((_, el) => $(el).html() || "").get().join("\n");
    const out = { title: title || "", priceText: priceText || "", images: [...images] };

    const candidates = extractJsonCandidates(scriptText);
    for(const c of candidates){
      const obj = safeParseJson(c);
      if(obj) pickFromJson(obj, out);
    }

    // final cleanup
    out.title = (out.title || title || "Nomsiz").toString().replace(/\s+/g," ").trim();
    out.images = uniq(out.images)
      .map(u => u.replace(/^\/\//, "https://"))
      .filter(u => /^https?:\/\//i.test(u))
      .slice(0, 12);

    // ensure some price formatting
    if(out.priceText && typeof out.priceText === "string"){
      const p = out.priceText.trim();
      if(/^\d+(\.\d+)?$/.test(p)) out.priceText = "¥" + p;
    }

    const doc = await db.collection("products").add({
      source: "1688",
      sourceUrl: url,
      title: out.title,
      priceText: out.priceText || "",
      images: out.images,
      status: "active",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: context.auth.uid
    });

    return { ok:true, id: doc.id };
  }catch(e){
    console.error("import error", e);
    const msg = (e && e.message) ? e.message : String(e);
    // Common 1688 bot blocks
    if(/captcha|forbidden|denied|verify/i.test(msg)) return { ok:false, error:"BLOCKED_OR_CAPTCHA" };
    return { ok:false, error: msg.slice(0, 160) };
  }
});
