
import { attachHeaderFooter } from './include.js';
import { initTheme } from './theme.js';
import { initCarousel, initAssistive } from './ui.js';
import { watchHeaderAuth, requireAuthForPage } from './auth.js';

// Boot
(async function boot(){
  await attachHeaderFooter();
  initTheme();
  initAssistive();

  const page = document.body.dataset.page || '';
  if (page !== 'register') {
    requireAuthForPage({ redirectIfLoggedOut: '/register.html' });
  } else {
    watchHeaderAuth();
  }

  if (page === 'index') initCarousel();
})();
