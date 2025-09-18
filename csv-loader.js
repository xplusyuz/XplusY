// csv-loader.js — CSV’dan bannerlarni o‘qish va render qilish (ES module)

// --- Yordamchi funksiyalar ---
function csvParse(text) {
  // Oddiy CSV parser: qo'shtirnoqlarni qo'llab-quvvatlaydi (RFC to'liq emas, ammo bannerlar uchun yetarli)
  const lines = text.replace(/\r/g, "").split("\n").filter(l => l.trim().length);
  if (!lines.length) return [];
  const headers = lines.shift().split(",").map(h => h.trim());
  const rows = [];

  for (const line of lines) {
    let row = [], cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i], nx = line[i + 1];
      if (ch === '"') {
        if (inQ && nx === '"') { cur += '"'; i++; } else { inQ = !inQ; }
      } else if (ch === "," && !inQ) {
        row.push(cur); cur = "";
      } else {
        cur += ch;
      }
    }
    row.push(cur);
    const obj = {};
    headers.forEach((h, i) => obj[h] = (row[i] ?? "").trim());
    rows.push(obj);
  }
  return rows;
}
const asBool = v => String(v ?? "").trim() === "1";
const asNum  = (v, d=0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
function dateWindowOK(item) {
  const now = new Date();
  const sd = item.start_date ? new Date(item.start_date) : null;
  const ed = item.end_date ? new Date(item.end_date) : null;
  if (sd && now < sd) return false;
  if (ed && now > ed) return false;
  return true;
}

// --- UI generator ---
function bannerCard(item, placement) {
  const bg  = item.background ? ` style="background:${item.background}"` : "";
  const img = item.image ? `<img src="${item.image}" alt="${item.title || ""}" loading="lazy">` : "";
  const sub = item.subtitle ? `<p class="b-sub">${item.subtitle}</p>` : "";
  const cta = item.cta_text ? `<span class="btn mini">${item.cta_text}</span>` : "";
  const href = item.url ? ` href="${item.url}"` : "";

  if (placement === "hero") {
    return `<a class="banner hero-card"${href}${bg}>
      <div class="b-txt"><h3 class="b-title">${item.title || ""}</h3>${sub}${cta}</div>
      <div class="b-media">${img}</div>
    </a>`;
  }
  if (placement === "promo") {
    return `<a class="banner promo-card"${href}${bg}>
      <div class="b-media">${img}</div>
      <div class="b-txt"><h4 class="b-title">${item.title || ""}</h4>${sub}</div>
    </a>`;
  }
  // sponsor
  return `<a class="banner sponsor-card"${href} title="${item.title || ""}">
    ${img || `<span class="sponsor-fallback">${item.title || ""}</span>`}
  </a>`;
}

// Bitta bo'limni CSV dan to'ldirish
async function loadCsvSection(section) {
  const csvUrl = section.getAttribute("data-csv");
  const placement = (section.getAttribute("data-placement") || "hero").toLowerCase();
  const list = section.querySelector('[data-target="list"], .banner-list');
  if (!csvUrl || !list) return;

  // cache-busting: CSV yangilansa ham brauzer eski nusxani ushlab qolmasin
  const url = new URL(csvUrl, location.origin);
  url.searchParams.set("_", String(Date.now()));

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) throw new Error(`CSV topilmadi (${res.status})`);
    const text = await res.text();
    const items = csvParse(text)
      .filter(r => asBool(r.active))
      .filter(dateWindowOK)
      .filter(r => (r.placement || "").toLowerCase() === placement)
      .sort((a, b) => asNum(a.order, 9999) - asNum(b.order, 9999));

    list.innerHTML = items.length
      ? items.map(it => bannerCard(it, placement)).join("")
      : `<div class="muted small">Banner yo‘q.</div>`;
  } catch (e) {
    console.error("[csv-loader] xato:", e);
    list.innerHTML = `<div class="msg error">CSV o‘qishda xatolik. (${e.message})</div>`;
  }
}

// Jamoaviy render — barcha [data-csv] bo‘limlar uchun
export async function hydrateCsvBanners() {
  const sections = document.querySelectorAll("section[data-csv][data-placement]");
  for (const sec of sections) await loadCsvSection(sec);
}

// Router yoki boshqa joylardan qulay chaqirish uchun globalga ham qo'yamiz
window.hydrateCsvBanners = hydrateCsvBanners;

// Agar bu skript partial ichida emas, balki global ulangan bo'lsa — bir marta ishga tushirish ixtiyoriy:
// (SPA router partial qo'ygach baribir chaqiradi, lekin statik sahifada ham ishlasin desangiz, quyidagini oching)
// document.addEventListener("DOMContentLoaded", () => hydrateCsvBanners());
