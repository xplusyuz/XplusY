
import { attachHeaderFooter } from './include.js';
import { initTheme } from './theme.js';
import { initAssistive, initCarousel } from './ui.js';
import { requireAuthForPage } from './auth.js';

(async ()=>{
  await attachHeaderFooter();
  initTheme();
  initAssistive();
  const page = document.body.dataset.page || '';
  if (page !== 'register'){ requireAuthForPage({ redirectIfLoggedOut:'register.html' }); }
  if (page === 'index'){ initCarousel(); }
})();
