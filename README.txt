SPA App-Shell

- components/header.html & footer.html: shared once
- js/app-shell.js: loads components then imports common.js (attachAuthUI/initUX)
- js/router.js: swaps <main> using partials
- partials/*: page-specific <main>
- _redirects: Netlify SPA fallback
