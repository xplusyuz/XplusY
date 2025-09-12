(function(){
  if (window.__router) return; window.__router = true;
  const routes = {
    "#/home": "partials/home.html",
    "#/tests": "partials/tests.html",
    "#/test": "partials/test.html",
    "#/live": "partials/live.html",
    "#/leaderboard": "partials/leaderboard.html",
    "#/settings": "partials/settings.html",
    "#/simulator": "partials/simulator.html"
  };
  const outlet = document.getElementById("app");
  async function load(url){
    try{
      const res = await fetch(url, {cache:"no-store"});
      if(!res.ok) throw new Error(res.status);
      outlet.innerHTML = await res.text();
      document.dispatchEvent(new CustomEvent("page:loaded", {detail:{url}}));
    }catch(e){
      outlet.innerHTML = "<div class='card'>Sahifa yuklanmadi yoki topilmadi.</div>";
      console.error(e);
    }
  }
  function resolve(){
    const h = location.hash || "#/home";
    const url = routes[h] || routes["#/home"];
    $$("#topnav a").forEach(a=>a.classList.toggle("active", a.getAttribute("href")===h));
    load(url);
  }
  window.addEventListener("hashchange", resolve);
  document.addEventListener("DOMContentLoaded", resolve);
})();