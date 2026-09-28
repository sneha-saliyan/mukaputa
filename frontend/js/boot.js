(async function boot() {
    try {
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
    } catch(e) {
        console.error("BOOT CRASH:", e);
    }
    // Dismiss splash screen
    const splash = document.getElementById('app-splash');
    if (splash) {
        splash.classList.add('fade-out');
        setTimeout(() => splash.remove(), 450);
    }
})();
