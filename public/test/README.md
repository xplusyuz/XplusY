# Test Tizimi — bo'laklangan tuzilma

Bu papkada siz bergan `index.html` faylidagi **CSS** va **JS** kodlar alohida fayllarga ajratildi.

## Papka struktura
- index.html
- css/styles.css  (hamma style shu yerda)
- js/
  - 01-config.js        (CONFIG, FIREBASE_CONFIG)
  - 02-state.js         (appState)
  - 03-utils.js         (utils)
  - 04-dom.js           (dom)
  - 05-modal.js         (modalManager)
  - 06-firebase.js      (firebaseManager)
  - 07-security.js      (securityManager)
  - 08-fullscreen.js    (fullscreenManager)
  - 09-user-actions.js  (userActionLogger)
  - 10-test-manager.js  (testManager)
  - 11-banner.js        (bannerManager)
  - 12-message-handler.js (messageHandler)
  - 13-event-handlers.js  (eventHandlers)
  - 14-app-init.js      (app init/bootstrapping)
  - 15-globals.js       (onclick ishlatadigan global funksiyalar)
  - 16-start.js         (startApp)

## Muhim eslatma
- HTML ichidagi `onclick="closeMathModal()"`, `saveMathAnswer()`, `enableMandatoryFullScreen()` kabi chaqiriqlar
  **15-globals.js** ichida `window.closeMathModal = ...` ko'rinishida saqlab qolingan.

## Qanday tahrir qilish oson?
- Dizayn o'zgartirish: `css/styles.css`
- Test tartibi / nav / savol chizish: `js/10-test-manager.js`
- Firebase yuklash/saqlash: `js/06-firebase.js`
- Xavfsizlik/qoida buzilish: `js/07-security.js` va `js/08-fullscreen.js`
