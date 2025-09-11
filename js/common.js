// Theme Manager: light/dark/system
(function(){
  const KEY = "mc_theme";
  const html = document.documentElement;
  const meta = document.querySelector('meta[name="theme-color"]');
  const label = document.getElementById("themeLabel");
  const apply = (mode)=>{
    html.setAttribute("data-theme", mode);
    if (label) label.textContent = mode;
    if (meta) meta.setAttribute("content", mode === "dark" ? "#041f12" : "#f6fbf8");
  };
  const get = ()=> localStorage.getItem(KEY) || "system";
  const set = (m)=> { localStorage.setItem(KEY, m); apply(m); };
  const order = ["light","dark","system"];
  function toggle(){
    const cur = get();
    const next = order[(order.indexOf(cur)+1)%order.length];
    set(next);
    const btn = document.getElementById("btnTheme");
    if (btn) btn.dataset.mode = next;
  }
  apply(get());
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  mql.addEventListener?.("change", ()=> { if (get()==="system") apply("system"); });
  document.addEventListener("DOMContentLoaded", ()=>{
    const btn = document.getElementById("btnTheme");
    if (btn){ btn.addEventListener("click", toggle); btn.dataset.mode = get(); }
  });
})();

// Active nav highlighting
(function(){
  function mark(){
    const h = location.hash || "#/home";
    document.querySelectorAll("#topnav a").forEach(a=>{
      a.classList.toggle("active", a.getAttribute("href")===h);
    });
  }
  window.addEventListener("hashchange", mark);
  document.addEventListener("DOMContentLoaded", mark);
})();