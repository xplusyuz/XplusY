// This script should be loaded before your main scripts in Telegram Web App
// Add this to both index.html and admin.html

// Telegram Web App initialization
if (window.Telegram && Telegram.WebApp) {
    // Expand to full height
    Telegram.WebApp.expand();
    
    // Set theme
    Telegram.WebApp.setHeaderColor('#6f42c1');
    Telegram.WebApp.setBackgroundColor('#f8f9fa');
    
    // Enable closing confirmation
    Telegram.WebApp.enableClosingConfirmation();
    
    console.log('Telegram Web App initialized');
    console.log('User ID:', Telegram.WebApp.initDataUnsafe.user?.id);
    console.log('Username:', Telegram.WebApp.initDataUnsafe.user?.username);
}