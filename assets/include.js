
(function(){
  async function includeFragments() {
    const nodes = document.querySelectorAll("[data-include]");
    for (const node of nodes) {
      const url = node.getAttribute("data-include");
      try {
        const resp = await fetch(url, {cache: "no-store"});
        const html = await resp.text();
        node.outerHTML = html;
      } catch (e) {
        console.error("Include failed for", url, e);
      }
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", includeFragments);
  } else {
    includeFragments();
  }
})();
