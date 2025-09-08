// Modal open/close
document.querySelectorAll("[data-open]").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    const id = btn.getAttribute("data-open");
    document.getElementById(id)?.classList.remove("hidden");
  });
});
document.querySelectorAll(".modal [data-close]").forEach(btn=>{
  btn.addEventListener("click", ()=> btn.closest(".modal")?.classList.add("hidden"));
});
document.querySelectorAll(".modal").forEach(m=> m.addEventListener("click", e=>{
  if(e.target===m) m.classList.add("hidden");
}));
