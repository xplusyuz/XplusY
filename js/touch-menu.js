// touch-menu.js — Floating bottom sheet menu
import { attachAuthUI, requireAuthOrModal, isSignedIn } from "./common.js";

const $ = (sel, root=document) => root.querySelector(sel);
const $all = (sel, root=document) => [...root.querySelectorAll(sel)];

const fab = $("#tdFab");
const sheet = $("#tdSheet");
const backdrop = $("#tdBackdrop");
const grid = $("#tdGrid");

function openSheet(){
  if (!sheet) return;
  sheet.hidden = false;
  backdrop.hidden = false;
  fab?.setAttribute("aria-expanded", "true");
}

function closeSheet(){
  if (!sheet) return;
  sheet.hidden = true;
  backdrop.hidden = true;
  fab?.setAttribute("aria-expanded", "false");
}

function bindDragToClose(){
  if (!sheet) return;
  let startY = 0, currentY = 0, dragging = false;

  const onStart = (e) => {
    dragging = true;
    startY = (e.touches ? e.touches[0].clientY : e.clientY);
    sheet.style.transition = "none";
  };

  const onMove = (e) => {
    if (!dragging) return;
    currentY = (e.touches ? e.touches[0].clientY : e.clientY);
    const dy = Math.max(0, currentY - startY);
    sheet.style.transform = `translateY(${dy}px)`;
  };

  const onEnd = () => {
    if (!dragging) return;
    dragging = false;
    sheet.style.transition = "";
    const dy = Math.max(0, currentY - startY);
    if (dy > 80) { closeSheet(); sheet.style.transform = ""; }
    else { sheet.style.transform = ""; }
  };

  $("#tdGrabber")?.addEventListener("mousedown", onStart);
  $("#tdGrabber")?.addEventListener("touchstart", onStart, {passive:true});
  window.addEventListener("mousemove", onMove);
  window.addEventListener("touchmove", onMove, {passive:true});
  window.addEventListener("mouseup", onEnd);
  window.addEventListener("touchend", onEnd);
}

function bind(){
  fab?.addEventListener("click", () => {
    if (fab.getAttribute("aria-expanded") === "true") closeSheet(); else openSheet();
  });
  backdrop?.addEventListener("click", closeSheet);

  // Route clicks + auth protection
  grid && grid.addEventListener("click", (e) => {
    const a = e.target.closest("[data-route]");
    if (!a) return;
    const authRequired = a.hasAttribute("data-auth-required");
    if (authRequired && !isSignedIn()){
      e.preventDefault();
      requireAuthOrModal();
      return;
    }
    closeSheet();
  });

  attachAuthUI(document);
  bindDragToClose();
}

document.addEventListener("DOMContentLoaded", bind);
