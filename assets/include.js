
// Patched includer: executes <script> tags (normal + type="module") from fragments
(function () {
  async function injectHTML(target, html) {
    const tpl = document.createElement("template");
    tpl.innerHTML = html.trim();

    const parent = target.parentNode;
    const frag = document.createDocumentFragment();
    const scripts = [];

    Array.from(tpl.content.childNodes).forEach(node => {
      if (node.tagName === "SCRIPT") {
        scripts.push(node);
      } else {
        frag.appendChild(node);
      }
    });

    parent.replaceChild(frag, target);

    for (const old of scripts) {
      const s = document.createElement("script");
      for (const { name, value } of Array.from(old.attributes || [])) {
        s.setAttribute(name, value);
      }
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
        if (!resp.ok) throw new Error(resp.status + " " + resp.statusText);
        const html = await resp.text();
        await injectHTML(node, html);
      } catch (e) {
        console.error("Include failed for", url, e);
        const fallback = document.createElement("div");
        fallback.innerHTML = "<!-- include error: " + (url||"") + " -->";
        node.replaceWith(fallback);
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", includeFragments);
  } else {
    includeFragments();
  }
})();
