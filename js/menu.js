// menu.js — responsive drawer + dynamic link list
const PAGES = [
  { id:"home", label:"Bosh sahifa", icon:"🏠" },
  { id:"tests", label:"Testlar", icon:"🧮" },
  { id:"live", label:"Live", icon:"⏱️" },
  { id:"simulator", label:"Simulyator", icon:"🎛️" },
  { id:"leaderboard", label:"Reyting", icon:"🏆" },
  { id:"courses", label:"Kurslar", icon:"📚" },
  { id:"news", label:"Yangiliklar", icon:"📰" },
  { id:"about", label:"Biz haqimizda", icon:"ℹ️" },
  { id:"contact", label:"Aloqa", icon:"✉️" },
  { id:"profile", label:"Profil", icon:"👤" },
];

let drawer, overlay, menuToggle;

export function initMenu(){
  drawer = document.getElementById("drawer");
  overlay = document.getElementById("overlay");
  menuToggle = document.getElementById("menuToggle");
  const links = document.getElementById("menuLinks");

  // Populate links
  links.innerHTML = PAGES.map(p => (
    `<a class="menu-link" data-id="${p.id}" href="#/${p.id}"><span>${p.icon}</span><span>${p.label}</span></a>`
  )).join("");

  // Event bindings
  menuToggle?.addEventListener("click", open);
  overlay?.addEventListener("click", close);

  // Close drawer on navigation (mobile)
  links.addEventListener("click", (e)=>{
    if (e.target.closest("a")) close();
  });

  // Desktop: keep open by default via CSS (sticky). If JS toggled, it obeys.
  setActive(location.hash.replace(/^#\/?/, "") || "home");
}

export function open(){ drawer?.classList.add("open"); overlay?.classList.add("show") }
export function close(){ drawer?.classList.remove("open"); overlay?.classList.remove("show") }

export function setActive(id){
  const all = document.querySelectorAll(".menu-link");
  all.forEach(a => {
    const match = a.getAttribute("data-id") === id;
    a.classList.toggle("active", match);
  });
}
