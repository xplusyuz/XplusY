
// Load header & footer into pages
export async function attachHeaderFooter() {
  // Header
  const headerHost = document.getElementById('km-header');
  if (headerHost) {
    const res = await fetch('/partials/header.html');
    headerHost.innerHTML = await res.text();
  }
  // Footer
  const footerHost = document.getElementById('km-footer');
  if (footerHost) {
    const res = await fetch('/partials/footer.html');
    footerHost.innerHTML = await res.text();
  }
}
