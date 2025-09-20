// Very small hash-router that loads partials into #app
export class Router {
  constructor(rootId="#app"){
    this.root = document.querySelector(rootId);
    this.routes = {
      "": "/partials/home.html",
      "/": "/partials/home.html",
      "/home": "/partials/home.html",
      "/tests": "/partials/tests.html",
      "/live": "/partials/live.html",
      "/about": "/partials/about.html",
      "/profile": "/partials/profile.html",
    };
    window.addEventListener("hashchange", ()=>this.render());
  }
  async render(){
    const hash = location.hash.replace(/^#/, "");
    const path = this.routes[hash] || this.routes["/home"];
    try{
      const res = await fetch(path + "?v=" + Date.now());
      const html = await res.text();
      this.root.innerHTML = html;
      // mark active
      document.querySelectorAll(".nav-link").forEach(a=>{
        const href = a.getAttribute("href") || "";
        a.classList.toggle("active", href === "#"+hash);
      });
      // Optional page init hooks
      if(hash==="/profile"){
        window.App?.renderProfileView?.();
      }
    }catch(e){
      this.root.innerHTML = `<p style="color:#b91c1c">Yuklashda xatolik: ${e}</p>`;
    }
  }
}
