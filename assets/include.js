
(function () {
  async function injectHTML(target, html) {
    const tpl = document.createElement("template");
    tpl.innerHTML = html.trim();
    const scripts = [];
    const frag = document.createDocumentFragment();
    for (const node of Array.from(tpl.content.childNodes)) {
      if (node.tagName === "SCRIPT") scripts.push(node);
      else frag.appendChild(node);
    }
    const parent = target.parentNode;
    parent.replaceChild(frag, target);
    for (const old of scripts) {
      const s = document.createElement("script");
      for (const { name, value } of Array.from(old.attributes || [])) s.setAttribute(name, value);
      if (old.textContent) s.textContent = old.textContent;
      const isModule = (s.getAttribute("type") || "").toLowerCase() === "module";
      (isModule ? document.head : document.body).appendChild(s);
    }
  }
  async function includeFragments() {
    const nodes = document.querySelectorAll("[data-include]");
    for (const node of nodes) {
      const url = node.getAttribute("data-include");
      try {
        const resp = await fetch(url, { cache: "no-store", credentials: "same-origin" });
        const html = await resp.text();
        await injectHTML(node, html);
      } catch (e) {
        console.error("Include failed for", url, e);
      }
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", includeFragments);
  else includeFragments();
})();
