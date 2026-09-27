// Boots the app: verifies the session with the backend, loads the full
// data snapshot into the store, then starts rendering. Runs last, after
// store/components/feed/app have all been defined.
(async function boot() {
    const ready = await store.boot();
    if (ready) {
        app.init();
        if (typeof app.startPolling === 'function') {
            app.startPolling();
        }
        if (typeof Calls !== 'undefined' && typeof Calls.init === 'function') {
            Calls.init();
        }
    }
    // Dismiss splash screen — regardless of success/failure (error screen handles itself)
    const splash = document.getElementById('app-splash');
    if (splash) {
        splash.classList.add('fade-out');
        setTimeout(() => splash.remove(), 450);
    }
})();
