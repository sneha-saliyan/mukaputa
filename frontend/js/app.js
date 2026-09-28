class App {
    constructor() {
        this.activeView = 'home';
        this.currentStoryIndex = 0;
        this.storyTimer = null;
        this.openChatWindows = []; // for desktop floating chat boxes
        this.liveStreamInterval = null;
        this.liveCommentsInterval = null;
    }

    init() {
        // Theme initialization
        this.initTheme();
        
        // Initial view render
        try {
            const savedState = JSON.parse(localStorage.getItem('mukaputa_active_view'));
            if (savedState && savedState.view) {
                this.switchView(savedState.view, savedState.params || {});
            } else {
                this.switchView('home');
            }
        } catch(e) {
            this.switchView('home');
        }

        // Global UI updates
        this.updateHeaderUserInfo();
        this.updateNotificationBadge();

        // Bind global search & nav
        this.bindNavigation();
        this.bindSearch();
        this.bindModals();
    }

    // ==========================================
    // LIVE SYNC (polling)
    // Keeps notifications and open chat threads up to date with what other
    // real users are doing on the backend, without needing a full reload.
    // ==========================================
    startPolling() {
        setInterval(async () => {
            try {
                await store.refreshNotifications();
                this.updateNotificationBadge();
                if (this.activeView === 'notifications') this.renderNotificationsView();
            } catch (e) { /* silent -- next tick will retry */ }
        }, 20000);

        setInterval(async () => {
            try {
                const idsToRefresh = new Set();
                if (this.activeView === 'messages' && this._activeConvId) {
                    idsToRefresh.add(this._activeConvId);
                }
                document.querySelectorAll('.floating-chat-window').forEach(win => {
                    const id = win.id.replace('chat-win-', '');
                    if (id) idsToRefresh.add(id);
                });

                for (const convId of idsToRefresh) {
                    await store.refreshConversation(convId);
                    this.renderChatMessages(convId);
                }

                if (this.activeView === 'messages') {
                    await store.refreshConversations();
                    // Smoothly update just the sidebar list (preview text, unread badges)
                    this.updateMessagesSidebar(this._activeConvId);
                }
            } catch (e) { /* silent -- next tick will retry */ }
        }, 4000);

        // Close any open post-option dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.post-options-menu')) {
                this.closeAllPostMenus();
            }
        });
    }

    // ==========================================
    // THEME MANAGEMENT
    // ==========================================
    initTheme() {
        const themeToggleBtn = document.querySelector('.theme-toggle');
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        let savedTheme = prefersDark ? 'dark' : 'light';
        try {
            savedTheme = localStorage.getItem('mukaputa_theme') || savedTheme;
        } catch(e) {}
        
        document.documentElement.setAttribute('data-theme', savedTheme);
        this.updateThemeIcon(savedTheme);

        if (themeToggleBtn) {
            themeToggleBtn.addEventListener('click', () => {
                const currentTheme = document.documentElement.getAttribute('data-theme');
                const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
                document.documentElement.setAttribute('data-theme', newTheme);
                try {
                    localStorage.setItem('mukaputa_theme', newTheme);
                } catch(e) {}
                this.updateThemeIcon(newTheme);
                this.showToast(`Switched to ${newTheme} mode 🌓`, 'info');
            });
        }
    }

    updateThemeIcon(theme) {
        // Find theme indicator in settings (since top nav button is removed)
        const settingsIndicators = document.querySelectorAll('.theme-toggle-indicator');
        settingsIndicators.forEach(indicator => {
            indicator.textContent = theme === 'dark' ? 'On' : 'Off';
        });
        
        const themeToggleBtn = document.querySelector('.theme-toggle');
        if (!themeToggleBtn) return;
        if (theme === 'dark') {
            themeToggleBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
        } else {
            themeToggleBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';
        }
    }

    toggleThemeFromSettings() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        try {
            localStorage.setItem('mukaputa_theme', newTheme);
        } catch(e) {}
        this.updateThemeIcon(newTheme);
        this.showToast(`Dark mode ${newTheme === 'dark' ? 'enabled' : 'disabled'}`, 'info');
    }

    // ==========================================
    // ROUTING & VIEW SWITCHING
    // ==========================================
    switchView(viewName, params = {}) {
        this.activeView = viewName;
        
        try {
            localStorage.setItem('mukaputa_active_view', JSON.stringify({ view: viewName, params: params }));
        } catch(e) {}

        // Hide all views
        document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));

        if (viewName === 'messages') {
            document.body.classList.add('messages-active');
        } else {
            document.body.classList.remove('messages-active');
        }

        if (viewName === 'reels') {
            document.body.classList.add('reels-active');
        } else {
            document.body.classList.remove('reels-active');
        }

        // Force hide nav-right for reels and messages to bypass any CSS caching
        const navRight = document.querySelector('.top-nav .nav-right');
        const topNav = document.querySelector('.top-nav');
        if (navRight && topNav) {
            if (viewName === 'messages' || viewName === 'reels') {
                navRight.style.display = 'none';
                if (window.innerWidth > 900) {
                    topNav.style.background = 'transparent';
                    topNav.style.boxShadow = 'none';
                    topNav.style.border = 'none';
                    topNav.style.pointerEvents = 'none';
                    const navLeft = topNav.querySelector('.nav-left');
                    if (navLeft) navLeft.style.pointerEvents = 'auto';
                }
            } else {
                navRight.style.display = 'flex';
                topNav.style.background = '';
                topNav.style.boxShadow = '';
                topNav.style.border = '';
                topNav.style.pointerEvents = 'auto';
            }
        }

        // Reset nav tab active classes
        document.querySelectorAll('.nav-tab, .tab-btn, .menu-item[data-nav]').forEach(el => {
            el.classList.remove('active');
            if (el.dataset.target === viewName || el.dataset.nav === viewName) {
                el.classList.add('active');
            }
        });

        // Update Mobile Bottom Tab Slider
        setTimeout(() => {
            const slider = document.getElementById('mobile-tab-slider');
            const activeTab = document.querySelector('.bottom-tab-bar .tab-btn.active');
            if (slider && activeTab && activeTab.offsetWidth > 0) {
                // Determine offset relative to the parent nav
                const nav = activeTab.closest('nav');
                const navRect = nav.getBoundingClientRect();
                const tabRect = activeTab.getBoundingClientRect();
                const offsetLeft = tabRect.left - navRect.left;
                
                slider.style.width = `${tabRect.width}px`;
                slider.style.transform = `translateX(${offsetLeft}px)`;
            }
        }, 10);

        // Show target view
        const targetEl = document.getElementById(`${viewName}-view`);
        if (targetEl) {
            targetEl.classList.remove('hidden');
        }

        // Render view specific content
        switch (viewName) {
            case 'search':
                this.renderSearchView();
                break;
            case 'home':
                feed.render();
                break;
            case 'reels':
                this.renderReelsView();
                break;
            case 'watch':
                this.renderWatchView();
                break;
            case 'jobs':
                this.renderJobsView(params.category);
                break;
            case 'groups':
                this.renderGroupsView();
                break;
            case 'pages':
                this.renderPagesView();
                break;
            case 'events':
                this.renderEventsView();
                break;
            case 'friends':
                this.renderFriendsView();
                break;
            case 'saved':
                this.renderSavedView();
                break;
            case 'profile':
                this.renderProfileView(params.userId || store.db.currentUserId, params.tab || 'posts');
                break;
            case 'notifications':
                this.renderNotificationsView();
                break;
            case 'messages':
                this.renderMessagesView();
                break;
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    bindNavigation() {
        document.querySelectorAll('.nav-tab, .tab-btn').forEach(tab => {
            tab.addEventListener('click', () => {
                const target = tab.dataset.target;
                if (target) this.switchView(target);
            });
        });

        document.querySelectorAll('.menu-item[data-nav]').forEach(item => {
            item.addEventListener('click', () => {
                const target = item.dataset.nav;
                if (target) this.switchView(target);
            });
        });
    }

    // ==========================================
    // VIEW RENDERERS
    // ==========================================

    // ==========================================
    // SEARCH VIEW METHODS
    // ==========================================
    currentSearchFilter = "all";
    currentSearchQuery = "";

    renderSearchView() {
        // Just clear or re-trigger search if needed
        const input = document.getElementById("global-search-input");
        if (input) {
            input.focus();
            this.performGlobalSearch(input.value);
        }
    }

    setSearchFilter(filter) {
        this.currentSearchFilter = filter;
        document.querySelectorAll("#search-filter-pills .pill").forEach(p => {
            if (p.dataset.filter === filter) p.classList.add("active");
            else p.classList.remove("active");
        });
        this.performGlobalSearch(this.currentSearchQuery);
    }

    performGlobalSearch(query) {
        this.currentSearchQuery = query || "";
        const resultsContainer = document.getElementById("global-search-results");
        if (!resultsContainer) return;
        
        const q = this.currentSearchQuery.trim().toLowerCase();
        
        if (!q) {
            resultsContainer.innerHTML = `
                <div style="padding: 40px; text-align: center; color: var(--text-tertiary);">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 16px; opacity: 0.5;"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    <p style="font-size: 16px;">Search for anything across Mukaputa.</p>
                </div>`;
            return;
        }

        let html = "";
        let hasResults = false;
        const filter = this.currentSearchFilter || "all";
        
        // Fetch all results via store.search
        const searchData = store.search(q);

        // People
        if ((filter === "all" || filter === "people") && searchData.people.length > 0) {
            hasResults = true;
            html += `<h4 style="margin: 16px 0 8px;">People</h4>`;
            html += `<div style="display: flex; flex-direction: column; gap: 12px;">`;
            searchData.people.forEach(u => {
                const isFriend = store.getFriends(store.db.currentUserId).some(f => f.id === u.id);
                html += `
                    <div class="card card-interactive" style="padding: 12px; display: flex; align-items: center; gap: 12px; border-radius: var(--radius-lg);">
                        <img src="${u.avatar}" style="width: 48px; height: 48px; border-radius: 50%; object-fit: cover; cursor: pointer;" onclick="app.viewUserProfile('${u.id}')">
                        <div style="flex: 1; cursor: pointer;" onclick="app.viewUserProfile('${u.id}')">
                            <h4 style="font-size: 15px; font-weight: 600; margin: 0 0 2px;">${u.name}</h4>
                            <p style="font-size: 13px; color: var(--text-secondary); margin: 0;">@${u.username || u.name.split(' ')[0].toLowerCase()}</p>
                        </div>
                    </div>`;
            });
            html += `</div>`;
        }

        // Posts
        if ((filter === "all" || filter === "posts") && searchData.posts.length > 0) {
            hasResults = true;
            html += `<h4 style="margin: 16px 0 8px;">Posts</h4>`;
            html += searchData.posts.map(p => {
                const u = store.getUser(p.authorId);
                return renderPost(p, u);
            }).join("");
        }

        // Groups
        if ((filter === "all" || filter === "groups") && searchData.groups.length > 0) {
            hasResults = true;
            html += `<h4 style="margin: 16px 0 8px;">Groups</h4>`;
            html += `<div class="search-grid">`;
            searchData.groups.forEach(g => {
                html += `
                    <div class="card card-interactive" style="padding: 16px; display: flex; gap: 16px; align-items: center;" onclick="app.showToast('Group clicked', 'info')">
                        <img src="${g.cover}" style="width: 60px; height: 60px; border-radius: 12px; object-fit: cover;">
                        <div>
                            <h4 style="margin: 0 0 4px; font-size: 15px; font-weight: 600;">${g.name}</h4>
                            <p style="margin: 0; font-size: 13px; color: var(--text-secondary);">${g.members || '1.2k'} members</p>
                        </div>
                    </div>`;
            });
            html += `</div>`;
        }

        // Jobs
        if ((filter === "all" || filter === "jobs") && searchData.jobs && searchData.jobs.length > 0) {
            hasResults = true;
            html += `<h4 style="margin: 16px 0 8px;">Jobs</h4>`;
            html += `<div style="display: flex; flex-direction: column; gap: 12px;">`;
            searchData.jobs.forEach(j => {
                html += `
                    <div class="card card-interactive" style="padding: 16px;">
                        <h4 style="margin: 0 0 4px; font-size: 16px;">${j.title}</h4>
                        <p style="margin: 0 0 8px; font-size: 14px; color: var(--accent);">${j.company}</p>
                        <p style="margin: 0; font-size: 13px; color: var(--text-secondary);">${j.location} • ${j.type || 'Full-time'}</p>
                    </div>`;
            });
            html += `</div>`;
        }

        if (!hasResults) {
            html = `<div style="padding: 40px; text-align: center; color: var(--text-secondary);">No results found for "${q}".</div>`;
        }

        resultsContainer.innerHTML = html;
    }


    renderReelsView(filter = 'trending') {
        const container = document.getElementById('reels-container');
        if (!container) return;

        // Update desktop sidebar buttons active state
        document.querySelectorAll('.reel-filter-btn').forEach(btn => {
            if (btn.dataset.filter === filter) {
                btn.style.background = '#333';
                btn.style.color = 'white';
            } else {
                btn.style.background = 'transparent';
                btn.style.color = '#ccc';
            }
        });

        // Update mobile top nav buttons active state and slider
        setTimeout(() => {
            const slider = document.getElementById('reels-mobile-tab-slider');
            let activeBtn = null;
            document.querySelectorAll('.reel-mobile-filter-btn').forEach(btn => {
                if (btn.dataset.filter === filter) {
                    btn.style.color = 'white';
                    btn.classList.add('active');
                    activeBtn = btn;
                } else {
                    btn.style.color = 'rgba(255,255,255,0.6)';
                    btn.classList.remove('active');
                }
            });

            if (slider && activeBtn && activeBtn.offsetWidth > 0) {
                const parentNav = activeBtn.closest('.reels-mobile-nav');
                const parentRect = parentNav.getBoundingClientRect();
                const btnRect = activeBtn.getBoundingClientRect();
                const offsetLeft = btnRect.left - parentRect.left;
                
                slider.style.width = `${btnRect.width}px`;
                slider.style.transform = `translateX(${offsetLeft}px)`;
            }
        }, 10);

        const allReels = store.getReels();
        const currentUser = store.getCurrentUser();
        let reelsToRender = [];

        if (filter === 'following') {
            reelsToRender = allReels.filter(r => currentUser.following && currentUser.following.includes(r.authorId));
        } else if (filter === 'saved') {
            reelsToRender = allReels.filter(r => currentUser.savedItems && currentUser.savedItems.includes(r.id));
        } else {
            reelsToRender = allReels; // trending
        }

        if (reelsToRender.length === 0) {
            container.innerHTML = `<div style="color: white; text-align: center; margin-top: 100px; font-size: 18px; width: 100%;">No reels found.</div>`;
        } else {
            container.innerHTML = reelsToRender.map(r => renderReel(r)).join('');
        }

        // Disconnect previous observer if it exists
        if (this.reelsObserver) {
            this.reelsObserver.disconnect();
        }

        // Create new Intersection Observer for Reels
        const options = {
            root: container,
            rootMargin: '0px',
            threshold: 0.6 // Reel must be 60% visible to trigger
        };

        if (typeof window.appReelsMuted === 'undefined') {
            window.appReelsMuted = true;
        }

        this.reelsObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const video = entry.target.querySelector('video');
                if (entry.isIntersecting) {
                    video.muted = window.appReelsMuted;
                    video.play().catch(e => console.log('Autoplay prevented', e));
                    
                    // Update sound icon to match state
                    const reelId = entry.target.id.replace('reel-', '');
                    const iconSvg = document.getElementById(`reel-sound-icon-${reelId}`);
                    if (iconSvg) {
                        if (window.appReelsMuted) {
                            iconSvg.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line>`;
                        } else {
                            iconSvg.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>`;
                        }
                    }
                } else {
                    video.pause();
                    video.currentTime = 0; // reset when scrolled away
                }
            });
        }, options);

        // Observe all newly rendered reel cards
        const cards = container.querySelectorAll('.reel-card');
        cards.forEach(card => this.reelsObserver.observe(card));

        // Keyboard Navigation
        if (!this.reelsKeyHandlerBound) {
            document.addEventListener('keydown', (e) => {
                if (this.activeView !== 'reels') return;
                // Ignore if typing in input
                if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
                
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                    e.preventDefault();
                    const visibleCard = Array.from(cards).find(c => {
                        const rect = c.getBoundingClientRect();
                        return rect.top >= 0 && rect.top < window.innerHeight / 2;
                    });
                    
                    if (visibleCard) {
                        const target = e.key === 'ArrowDown' ? visibleCard.nextElementSibling : visibleCard.previousElementSibling;
                        if (target) {
                            target.scrollIntoView({ behavior: 'smooth' });
                        }
                    }
                }
            });
            this.reelsKeyHandlerBound = true;
        }
    }

    renderWatchView(filter = 'All') {
        const container = document.getElementById('watch-container');
        if (!container) return;
        let videos = store.getWatchVideos();
        if (filter && filter !== 'All') {
            if (filter === 'Education') {
                videos = videos.filter(v => v.category === 'Education');
            } else if (filter === 'IT Field') {
                videos = videos.filter(v => v.category === 'IT Field');
            } else if (filter === 'YouTube') {
                videos = videos.filter(v => v.platform === 'YouTube' || (v.url && v.url.includes('youtube.com')));
            } else if (filter === 'Google') {
                videos = videos.filter(v => v.platform === 'Google' || (v.url && v.url.includes('google.com')));
            }
        }
        container.innerHTML = videos.length > 0
            ? videos.map(v => renderWatchVideo(v)).join('')
            : `<div style="text-align: center; padding: 48px; color: var(--text-secondary);">No videos found in this category.</div>`;
    }

    filterWatchVideos(category, element) {
        document.querySelectorAll('#watch-filter-pills .pill').forEach(p => p.classList.remove('active'));
        if (element) element.classList.add('active');
        this.renderWatchView(category);
    }

    renderJobsView(categoryFilter = null) {
        const container = document.getElementById('jobs-container');
        if (!container) return;
        let jobs = store.getJobVacancies();

        if (categoryFilter && categoryFilter !== 'All') {
            if (categoryFilter === 'Remote') {
                jobs = jobs.filter(j => j.remote === 'Remote');
            } else if (categoryFilter === 'Saved') {
                jobs = jobs.filter(j => store.isJobSaved(j.id));
            } else {
                jobs = jobs.filter(j => j.category === categoryFilter);
            }
        }

        container.innerHTML = jobs.length > 0
            ? jobs.map(j => renderJobCard(j)).join('')
            : `<div style="text-align:center; padding: 60px 20px;">
                <div style="font-size: 48px; margin-bottom: 12px;">💼</div>
                <p class="text-secondary">No jobs found in this category.</p>
              </div>`;
    }

    filterJobsByCategory(category, element) {
        document.querySelectorAll('#jobs-pills .pill').forEach(p => p.classList.remove('active'));
        if (element) element.classList.add('active');
        document.getElementById('jobs-search-input').value = '';
        this.renderJobsView(category);
    }

    filterJobs(query) {
        const container = document.getElementById('jobs-container');
        if (!container) return;
        document.querySelectorAll('#jobs-pills .pill').forEach(p => p.classList.remove('active'));
        document.querySelector('#jobs-pills .pill')?.classList.add('active');

        let jobs = store.getJobVacancies();
        if (query && query.trim()) {
            const q = query.toLowerCase().trim();
            jobs = jobs.filter(j =>
                j.title.toLowerCase().includes(q) ||
                j.company.toLowerCase().includes(q) ||
                j.category.toLowerCase().includes(q) ||
                j.description.toLowerCase().includes(q) ||
                j.location.toLowerCase().includes(q) ||
                j.requirements.some(r => r.toLowerCase().includes(q))
            );
        }

        container.innerHTML = jobs.length > 0
            ? jobs.map(j => renderJobCard(j)).join('')
            : `<div style="text-align:center; padding: 60px 20px;">
                <div style="font-size: 48px; margin-bottom: 12px;">🔍</div>
                <p class="text-secondary">No jobs match "<strong>${query}</strong>"</p>
              </div>`;
    }

    renderGroupsView() {
        const yourContainer = document.getElementById('your-groups-container');
        const discoverContainer = document.getElementById('discover-groups-container');
        if (!yourContainer || !discoverContainer) return;

        const groups = store.getGroups();
        const currentUser = store.getCurrentUser();
        
        const yourGroups = groups.filter(g => g.memberIds && g.memberIds.includes(currentUser.id));
        const discoverGroups = groups.filter(g => !g.memberIds || !g.memberIds.includes(currentUser.id));
        const renderGridCard = (group) => {
            const isMember = group.memberIds && group.memberIds.includes(currentUser.id);
            return `
            <div class="card card-interactive" style="overflow: hidden; display: flex; flex-direction: column; cursor: pointer; padding: 0;" onclick="app.openGroupDetails('${group.id}')">
                <div style="position: relative;">
                    <img src="${group.cover}" style="width: 100%; height: 140px; object-fit: cover;" alt="${group.name}">
                    ${group.private ? `<div style="position: absolute; top: 12px; right: 12px; background: rgba(0,0,0,0.6); color: white; padding: 4px 8px; border-radius: 12px; font-size: 11px; backdrop-filter: blur(4px);">🔒 Private</div>` : ''}
                </div>
                <div style="padding: 16px; flex: 1; display: flex; flex-direction: column;">
                    <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 4px;">${group.name}</h3>
                    <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 8px; flex: 1;">${group.description || 'A community group on Mukaputa.'}</p>
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-top: auto;">
                        <span style="font-size: 12px; font-weight: 600; color: var(--text-tertiary);">${group.memberIds ? group.memberIds.length : 0} Members</span>
                        <button class="btn ${isMember ? 'btn-secondary' : 'btn-primary'} btn-sm" onclick="event.stopPropagation(); app.toggleGroupMembership('${group.id}')">
                            ${isMember ? 'Joined' : 'Join'}
                        </button>
                    </div>
                </div>
            </div>
            `;
        };

        yourContainer.innerHTML = yourGroups.length > 0 ? yourGroups.map(renderGridCard).join('') : '<p style="color: var(--text-secondary); padding: 16px;">You haven\'t joined any groups yet.</p>';
        discoverContainer.innerHTML = discoverGroups.length > 0 ? discoverGroups.map(renderGridCard).join('') : '<p style="color: var(--text-secondary); padding: 16px;">No new groups to discover.</p>';
    }

    renderPagesView() {
        const container = document.getElementById('pages-container');
        if (!container) return;
        const pages = store.getPages();
        container.innerHTML = pages.map(p => renderPage(p)).join('');
    }

    renderEventsView() {
        const container = document.getElementById('events-container');
        if (!container) return;
        const events = store.getEvents();
        container.innerHTML = events.map(e => renderEvent(e)).join('');
    }

    renderFriendsView() {
        const container = document.getElementById('friends-container');
        if (!container) return;
        const currentUser = store.getCurrentUser();
        const friends = store.getFriends(currentUser.id);
        const suggestions = store.getFriendSuggestions();

        container.innerHTML = `
            <div style="margin-bottom: 24px;">
                <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 12px;">Your Friends (${friends.length})</h3>
                <div class="friends-grid">
                    ${friends.length > 0 ? friends.map(f => renderFriendCard(f, true)).join('') : '<p class="text-secondary">No friends yet. Check out suggestions below!</p>'}
                </div>
            </div>

            <div>
                <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 12px;">People You May Know</h3>
                <div class="friends-grid">
                    ${suggestions.map(u => renderFriendCard(u, false)).join('')}
                </div>
            </div>
        `;
    }

    renderSavedView() {
        const container = document.getElementById('saved-container');
        if (!container) return;
        const savedPosts = store.getPosts().filter(p => store.isPostSaved(p.id));
        const savedJobs = store.getJobVacancies().filter(j => store.isJobSaved(j.id));

        const renderSavedPostCard = (p) => {
            const author = store.getUser(p.authorId) || store.getUser(p.userId);
            let mediaHtml = '';
            if (p.media && p.media.length > 0) {
                const mediaUrl = p.media[0];
                if (mediaUrl.match(/\.(mp4|webm)$/i)) {
                    mediaHtml = `<video src="${mediaUrl}" style="width: 100%; height: 180px; object-fit: cover; border-bottom: 1px solid var(--border-color);" muted></video>`;
                } else {
                    mediaHtml = `<img src="${mediaUrl}" style="width: 100%; height: 180px; object-fit: cover; border-bottom: 1px solid var(--border-color);">`;
                }
            } else {
                mediaHtml = `<div style="width: 100%; height: 120px; background: var(--bg-secondary); display: flex; align-items: center; justify-content: center; border-bottom: 1px solid var(--border-color);"><span style="font-size: 32px; color: var(--text-secondary);">📝</span></div>`;
            }

            return `
                <div class="card" style="padding: 0; overflow: hidden; display: flex; flex-direction: column; cursor: pointer; transition: transform 0.2s; position: relative;" onclick="app.viewUserProfile('${author.id}')" onmouseenter="this.style.transform='scale(1.02)'" onmouseleave="this.style.transform='scale(1)'">
                    ${mediaHtml}
                    <div style="padding: 12px; flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
                        <div>
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                                <img src="${author.avatar}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover;">
                                <span style="font-size: 13px; font-weight: 600;">${author.name}</span>
                            </div>
                            <p style="font-size: 13px; color: var(--text-primary); margin: 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${escapeHtml(p.text || p.caption || '')}</p>
                        </div>
                    </div>
                    <button class="icon-btn-small" style="position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.6); color: white; border: none; backdrop-filter: blur(4px);" onclick="event.stopPropagation(); app.savePost('${p.id}')">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                    </button>
                </div>
            `;
        };

        const renderSavedJobCard = (j) => {
            return `
                <div class="card" style="padding: 16px; display: flex; flex-direction: column; gap: 12px; cursor: pointer; transition: transform 0.2s; position: relative;" onmouseenter="this.style.transform='scale(1.02)'" onmouseleave="this.style.transform='scale(1)'" onclick="app.viewJobDetails('${j.id}')">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 48px; height: 48px; background: var(--accent); color: white; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: bold;">
                            ${j.company.charAt(0)}
                        </div>
                        <div style="flex: 1; overflow: hidden;">
                            <h4 style="font-size: 15px; margin: 0 0 4px 0; font-weight: 600;">${j.title}</h4>
                            <p style="font-size: 13px; color: var(--text-secondary); margin: 0;">${j.company} • ${j.location}</p>
                        </div>
                    </div>
                    <p style="font-size: 12px; color: var(--success); margin: 0; font-weight: 600;">${j.salary || 'Salary Negotiable'}</p>
                    <button class="icon-btn-small" style="position: absolute; top: 12px; right: 12px; color: var(--accent); background: var(--bg-secondary);" onclick="event.stopPropagation(); app.toggleJobSave('${j.id}')">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                    </button>
                </div>
            `;
        };

        container.innerHTML = `
            <div style="margin-bottom: 32px;">
                <h3 style="font-size: 20px; font-weight: 700; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                    Saved Posts (${savedPosts.length})
                </h3>
                ${savedPosts.length > 0 
                    ? `<div class="saved-posts-grid">
                        ${savedPosts.map(p => renderSavedPostCard(p)).join('')}
                       </div>`
                    : '<p class="text-secondary" style="padding: 32px; background: var(--bg-card); border-radius: 12px; text-align: center; border: 1px dashed var(--border-color);">No saved posts yet.</p>'}
            </div>

            <div>
                <h3 style="font-size: 20px; font-weight: 700; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
                    Saved Jobs (${savedJobs.length})
                </h3>
                ${savedJobs.length > 0 
                    ? `<div class="saved-jobs-grid">
                        ${savedJobs.map(j => renderSavedJobCard(j)).join('')}
                       </div>`
                    : '<p class="text-secondary" style="padding: 32px; background: var(--bg-card); border-radius: 12px; text-align: center; border: 1px dashed var(--border-color);">No saved jobs yet.</p>'}
            </div>
        `;
    }

    renderProfileView(userId, tab = 'posts') {
        const container = document.getElementById('profile-view');
        if (!container) return;
        const user = store.getUser(userId);
        container.innerHTML = renderProfileView(user, tab);

        if (tab === 'reels') {
            if (this.reelsObserver) {
                this.reelsObserver.disconnect();
            }
            const options = {
                root: null,
                rootMargin: '0px',
                threshold: 0.6
            };
            this.reelsObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    const video = entry.target.querySelector('video');
                    if (video) {
                        if (entry.isIntersecting) {
                            video.play().catch(e => console.log('Auto-play prevented', e));
                        } else {
                            video.pause();
                        }
                    }
                });
            }, options);
            const cards = container.querySelectorAll('.reel-card');
            cards.forEach(card => this.reelsObserver.observe(card));
        }
    }

    switchProfileTab(userId, tabName) {
        this.renderProfileView(userId, tabName);
    }

    viewUserProfile(userId) {
        this.switchView('profile', { userId, tab: 'posts' });
    }

    // ==========================================
    // INTERACTIVE ACTIONS & STATE MACHINE
    // ==========================================
    savePost(id) {
        const isSaved = store.toggleSavePost(id);
        this.showToast(isSaved ? 'Saved to your collection! 🔖' : 'Removed from saved items', 'info');
        if (this.activeView === 'saved') this.renderSavedView();
        else if (this.activeView === 'home') feed.render();
    }

    editPost(postId) {
        const post = store.getPost(postId);
        if (!post) return;
        const newText = prompt("Edit your post text:", post.text);
        if (newText !== null && newText.trim() !== '') {
            store.editPost(postId, newText.trim());
            // Re-render whichever view is active
            if (this.activeView === 'home') feed.render();
            else if (this.activeView === 'profile') this.renderProfileView(store.db.currentUserId);
            this.showToast('Post updated! ✏️', 'success');
        }
    }

    deletePost(postId) {
        if (confirm("Are you sure you want to delete this post?")) {
            store.deletePost(postId);
            // Remove the element directly from DOM for instant feedback
            const el = document.getElementById(`post-${postId}`);
            if (el) {
                el.style.transition = 'opacity 0.2s';
                el.style.opacity = '0';
                setTimeout(() => el.remove(), 200);
            }
            // Also re-render the active view to sync state
            if (this.activeView === 'home') feed.render();
            else if (this.activeView === 'profile') {
                setTimeout(() => this.renderProfileView(store.db.currentUserId), 250);
            }
            this.showToast('Post deleted', 'danger');
        }
    }

    hidePost(postId) {
        const el = document.getElementById(`post-${postId}`);
        if (el) el.style.display = 'none';
        this.showToast("Post hidden from your feed", "info");
    }

    async reportContent(contentType, contentId) {
        this.closeAllPostMenus();
        const reason = prompt(`Why are you reporting this ${contentType}?\n\nExamples: Spam, Harassment, Hate speech, Misinformation, Other`);
        if (!reason || !reason.trim()) return;
        try {
            const res = await fetch('/api/posts/report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contentType, contentId, reason: reason.trim() }),
                credentials: 'include',
            });
            const data = await res.json();
            if (data.ok) {
                this.showToast('Report submitted. Thank you.', 'success');
            } else if (res.status === 409) {
                this.showToast('You already reported this content.', 'info');
            } else {
                this.showToast(data.error || 'Failed to submit report.', 'danger');
            }
        } catch (e) {
            this.showToast('Network error. Please try again.', 'danger');
        }
    }

    sharePost(postId) {
        this.openShareModal('post', postId);
    }

    togglePostMenu(postId) {
        // Close all other open menus first
        document.querySelectorAll('.post-dropdown:not(.hidden)').forEach(m => {
            if (m.id !== `post-menu-${postId}`) m.classList.add('hidden');
        });
        const menu = document.getElementById(`post-menu-${postId}`);
        if (menu) menu.classList.toggle('hidden');
    }
    
    toggleReelMenu(reelId) {
        // Close all other open menus first
        document.querySelectorAll('.post-dropdown:not(.hidden)').forEach(m => {
            if (m.id !== `reel-menu-${reelId}`) m.classList.add('hidden');
        });
        const menu = document.getElementById(`reel-menu-${reelId}`);
        if (menu) menu.classList.toggle('hidden');
    }
    
    notInterestedReel(reelId) {
        this.closeAllPostMenus();
        const reelCard = document.getElementById(`reel-${reelId}`);
        if (reelCard) {
            reelCard.style.display = 'none';
            this.showToast('Reel hidden. We will show fewer reels like this.', 'info');
        }
    }

    closeAllPostMenus() {
        document.querySelectorAll('.post-dropdown').forEach(m => m.classList.add('hidden'));
    }

    showReactionsModal(postId) {
        const post = store.getPost(postId);
        if (!post || !post.reactions) return;
        let details = [];
        for (const [type, users] of Object.entries(post.reactions)) {
            if (users && users.length > 0) {
                const names = users.map(uid => store.getUser(uid).name).join(', ');
                details.push(`${getReactionEmoji(type)} ${type.toUpperCase()}: ${names}`);
            }
        }
        if (details.length > 0) {
            this.showToast(`Reactions:\n${details.join('\n')}`, 'info');
        } else {
            this.showToast('No reactions yet. Be the first! 👍', 'info');
        }
    }

    viewJobDetails(jobId) {
        const jobs = store.getJobVacancies();
        const job = jobs.find(j => j.id === jobId);
        if (!job) return;
        const modal = document.getElementById('job-details-modal');
        const content = document.getElementById('job-details-content');
        if (modal && content) {
            content.innerHTML = renderJobDetailsModal(job);
            modal.classList.remove('hidden');
        }
    }

    applyToJob(jobId) {
        if (store.hasApplied(jobId)) {
            this.showToast('You have already applied to this job!', 'info');
            return;
        }
        store.applyToJob(jobId);
        const job = store.getJobVacancies().find(j => j.id === jobId);
        this.showToast(`🚀 Application submitted to ${job.company}!`, 'success');
        
        // Add a notification for job application
        store.addNotification({
            id: `notif_${Date.now()}`,
            type: 'job',
            targetId: jobId,
            actor: {
                name: job.company,
                avatar: job.logo || 'https://via.placeholder.com/150'
            },
            text: `You have successfully applied for the ${job.title} role at ${job.company}.`,
            createdAt: new Date().toISOString(),
            read: false
        });
        this.updateNotificationBadge();
        
        // Re-render to update Apply button state
        this.renderJobsView();
        const card = document.getElementById(`job-${jobId}`);
        if (card) {
            const applyBtn = card.querySelector('.btn-primary, .btn-secondary');
            if (applyBtn) {
                applyBtn.className = 'btn btn-secondary btn-sm';
                applyBtn.textContent = '✓ Applied';
            }
        }
    }

    toggleJobSave(jobId) {
        const isSaved = store.toggleJobSaved(jobId);
        this.showToast(isSaved ? '⭐ Job saved to your collection!' : 'Job removed from saved', 'info');
        // Re-render current card bookmark icon
        const card = document.getElementById(`job-${jobId}`);
        if (card) {
            const saveBtn = card.querySelector('.job-save-btn');
            if (saveBtn) {
                saveBtn.classList.toggle('saved', isSaved);
                saveBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="${isSaved ? 'var(--accent)' : 'none'}" stroke="${isSaved ? 'var(--accent)' : 'currentColor'}" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>`;
            }
        }
        if (this.activeView === 'saved') this.renderSavedView();
    }

    toggleFollow(userId, btnEl = null) {
        if (userId === store.db.currentUserId) return;
        const isFollowing = store.toggleFollow(userId);
        const user = store.getUser(userId);
        
        if (isFollowing) {
            this.showToast(`Now following ${user.name} ✨`, 'success');
        } else {
            this.showToast(`Unfollowed ${user.name}`, 'info');
        }

        // If a button element was passed, update it instantly
        if (btnEl) {
            if (isFollowing) {
                btnEl.textContent = 'Following';
                btnEl.classList.remove('btn-primary');
                btnEl.classList.add('btn-secondary');
            } else {
                btnEl.textContent = 'Follow';
                btnEl.classList.remove('btn-secondary');
                btnEl.classList.add('btn-primary');
            }
        }
    }

    reactComment(postId, commentId) {
        this.showToast('Liked comment 👍', 'success');
    }

    editCommentUI(postId, commentId, oldText) {
        const newText = prompt("Edit your comment:", oldText);
        if (newText !== null && newText.trim() !== "" && newText.trim() !== oldText) {
            const cleanText = newText.trim();
            store.editComment(postId, commentId, cleanText);
            const textEl = document.querySelector(`#comment-${commentId} .comment-text`);
            if (textEl) textEl.textContent = cleanText;
            
            // Update the onclick attribute so the next edit has the updated text
            const editBtn = document.querySelector(`#comment-${commentId} .comment-action-btn[onclick^="app.editCommentUI"]`);
            if (editBtn) {
                editBtn.setAttribute('onclick', `app.editCommentUI('${postId}', '${commentId}', \`${cleanText.replace(/`/g, '\\`')}\`)`);
            }
            
            this.showToast('Comment updated', 'success');
        }
    }

    deleteCommentUI(postId, commentId) {
        if (confirm("Are you sure you want to delete this comment?")) {
            store.deleteComment(postId, commentId);
            const commentEl = document.getElementById(`comment-${commentId}`);
            if (commentEl) commentEl.remove();
            
            const countEl = document.querySelector(`#post-${postId} .post-stats span:last-child`);
            if (countEl && countEl.textContent.includes('comment')) {
                const countMatch = countEl.textContent.match(/(\d+)/);
                if (countMatch) {
                    const currentCount = parseInt(countMatch[1], 10);
                    countEl.textContent = `${Math.max(0, currentCount - 1)} comments`;
                }
            }
            this.showToast('Comment deleted', 'info');
        }
    }

    focusReplyInput(postId, commentId) {
        const input = document.getElementById(`comment-input-${postId}`);
        if (input) {
            input.value = `@User `;
            input.focus();
        }
    }

    toggleComments(postId) {
        const commentsSection = document.getElementById(`comments-${postId}`);
        if (commentsSection) {
            commentsSection.classList.toggle('hidden');
            if (!commentsSection.classList.contains('hidden')) {
                const input = document.getElementById(`comment-input-${postId}`);
                if (input) input.focus();
            }
        }
    }

    // ==========================================
    // PHOTO VIEWER LIGHTBOX
    // ==========================================
    openPhotoViewer(startIndex, userId) {
        const photos = store.getPosts()
            .filter(p => p.authorId === userId && p.media && p.media.length > 0)
            .flatMap(p => p.media);

        if (!photos.length) return;

        this._photoViewerPhotos = photos;
        this._photoViewerIndex = Math.min(startIndex, photos.length - 1);

        const overlay = document.getElementById('photo-viewer-overlay');
        if (overlay) {
            overlay.classList.remove('hidden');
            this._updatePhotoViewer();

            // Swipe support for mobile
            let touchStartX = 0;
            overlay.ontouchstart = (e) => { touchStartX = e.touches[0].clientX; };
            overlay.ontouchend = (e) => {
                const diff = touchStartX - e.changedTouches[0].clientX;
                if (Math.abs(diff) > 50) {
                    diff > 0 ? this.nextPhoto() : this.prevPhoto();
                }
            };
        }
    }

    _updatePhotoViewer() {
        const photos = this._photoViewerPhotos || [];
        const i = this._photoViewerIndex;
        const img = document.getElementById('photo-viewer-img');
        const counter = document.getElementById('photo-viewer-counter');
        if (img) img.src = photos[i];
        if (counter) counter.textContent = `${i + 1} / ${photos.length}`;
    }

    nextPhoto() {
        const photos = this._photoViewerPhotos || [];
        if (this._photoViewerIndex < photos.length - 1) {
            this._photoViewerIndex++;
            this._updatePhotoViewer();
        }
    }

    prevPhoto() {
        if (this._photoViewerIndex > 0) {
            this._photoViewerIndex--;
            this._updatePhotoViewer();
        }
    }

    closePhotoViewer() {
        document.getElementById('photo-viewer-overlay')?.classList.add('hidden');
        this._photoViewerPhotos = [];
        this._photoViewerIndex = 0;
    }

    toggleGroupMembership(groupId) {
        const group = store.getGroups().find(g => g.id === groupId);
        if (!group) return;
        const isMember = group.memberIds && group.memberIds.includes(store.db.currentUserId);
        if (isMember) {
            store.leaveGroup(groupId, store.db.currentUserId);
            this.showToast(`Left ${group.name}`, 'info');
        } else {
            store.joinGroup(groupId, store.db.currentUserId);
            this.showToast(`Joined ${group.name}! 🎉`, 'success');
        }
        this.renderGroupsView();
        
        // If the modal is currently open for this group, re-render it
        const modal = document.getElementById('group-details-modal');
        if (!modal.classList.contains('hidden')) {
            this.openGroupDetails(groupId);
        }
    }

    openGroupDetails(groupId) {
        const group = store.getGroups().find(g => g.id === groupId);
        if (!group) return;
        const isMember = group.memberIds && group.memberIds.includes(store.db.currentUserId);
        
        const content = document.getElementById('group-details-content');
        
        // Mock group posts
        const groupPosts = store.getPosts().slice(0, 3).map(p => renderPost(p)).join('');

        content.innerHTML = `
            <div style="position: relative; height: 200px;">
                <img src="${group.cover}" style="width: 100%; height: 100%; object-fit: cover;" alt="Group Cover">
                <button class="icon-btn" style="position: absolute; top: 16px; left: 16px; background: rgba(0,0,0,0.5); color: white;" onclick="document.getElementById('group-details-modal').classList.add('hidden')">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                </button>
            </div>
            <div style="padding: 24px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
                    <div>
                        <h2 style="font-size: 24px; font-weight: 800; margin-bottom: 8px;">${group.name}</h2>
                        <div style="display: flex; align-items: center; gap: 8px; color: var(--text-secondary); font-size: 14px;">
                            <span>${group.private ? '🔒 Private Group' : '🌍 Public Group'}</span>
                            <span>•</span>
                            <span>${group.memberIds ? group.memberIds.length : 0} members</span>
                        </div>
                    </div>
                    <button class="btn ${isMember ? 'btn-secondary' : 'btn-primary'}" onclick="app.toggleGroupMembership('${group.id}')">
                        ${isMember ? 'Joined' : 'Join Group'}
                    </button>
                </div>
                <p style="font-size: 15px; line-height: 1.5; color: var(--text-secondary); margin-bottom: 24px;">
                    ${group.description || 'Welcome to our community!'}
                </p>
                <div style="display: flex; gap: 16px; border-bottom: 1px solid var(--border-color); margin-bottom: 16px;">
                    <div style="padding-bottom: 12px; font-weight: 600; color: var(--accent); border-bottom: 2px solid var(--accent);">Discussion</div>
                    <div style="padding-bottom: 12px; font-weight: 500; color: var(--text-secondary); cursor: pointer;">Members</div>
                    <div style="padding-bottom: 12px; font-weight: 500; color: var(--text-secondary); cursor: pointer;">Media</div>
                </div>
                
                ${isMember || !group.private ? `
                    <div class="card" style="margin-bottom: 16px; padding: 16px; display: flex; align-items: center; gap: 12px;">
                        <img src="${store.getCurrentUser().avatar}" class="avatar-small">
                        <div style="background: var(--bg-secondary); padding: 12px 16px; border-radius: 20px; flex: 1; color: var(--text-tertiary); cursor: pointer;">Write something...</div>
                    </div>
                    ${groupPosts}
                ` : `
                    <div style="text-align: center; padding: 48px 16px; color: var(--text-secondary);">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="margin-bottom: 16px; opacity: 0.5;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                        <h3 style="font-size: 18px; margin-bottom: 8px;">This group is private</h3>
                        <p>Join this group to view or participate in discussions.</p>
                    </div>
                `}
            </div>
        `;
        document.getElementById('group-details-modal').classList.remove('hidden');
    }

    togglePageFollow(pageId) {
        const page = store.getPages().find(p => p.id === pageId);
        if (!page) return;
        const isFollowing = page.followerIds && page.followerIds.includes(store.db.currentUserId);
        if (isFollowing) {
            store.unfollowPage(pageId, store.db.currentUserId);
            this.showToast(`Unfollowed ${page.name}`, 'info');
        } else {
            store.followPage(pageId, store.db.currentUserId);
            this.showToast(`Following ${page.name}! ⭐`, 'success');
        }
        this.renderPagesView();
    }

    rsvpEvent(eventId, status) {
        store.rsvpEvent(eventId, status, store.db.currentUserId);
        this.showToast(`RSVP updated to ${status === 'going' ? 'Going ✓' : 'Interested ⭐'}`, 'success');
        this.renderEventsView();
    }

    addFriend(userId) {
        store.addFriend(userId);
        const user = store.getUser(userId);
        this.showToast(`Connected with ${user.name}! 🤝`, 'success');
        this.renderFriendsView();
    }

    removeFriend(userId) {
        if (confirm("Remove friend?")) {
            store.removeFriend(userId);
            this.showToast('Friend removed', 'info');
            this.renderFriendsView();
        }
    }

    // ==========================================
    // REELS INTERACTIONS
    // ==========================================
    likeReel(reelId, animateIcon = true) {
        store.toggleReelLike(reelId, store.db.currentUserId);
        const reelCard = document.getElementById(`reel-${reelId}`);
        if (reelCard) {
            const likeIconDiv = reelCard.querySelector('.reel-action-btn:nth-child(1) .reel-action-icon');
            const likeIconSvg = document.getElementById(`reel-like-icon-${reelId}`);
            const likeLabel = document.getElementById(`reel-likes-count-${reelId}`);
            
            if (likeIconDiv && likeIconSvg && likeLabel) {
                const isLiked = store.getReels().find(r => r.id === reelId).reactions.like.includes(store.db.currentUserId);
                likeIconDiv.style.color = isLiked ? 'var(--love-red)' : 'white';
                likeIconSvg.setAttribute('fill', isLiked ? 'currentColor' : 'none');
                likeLabel.textContent = store.getReels().find(r => r.id === reelId).reactions.like.length;

                if (animateIcon) {
                    likeIconSvg.style.transform = 'scale(1.4)';
                    setTimeout(() => {
                        likeIconSvg.style.transform = 'scale(1)';
                    }, 200);
                }
            }
        }
    }

    handleReelDoubleClick(event, reelId) {
        event.preventDefault(); // Prevent text selection
        const reel = store.getReels().find(r => r.id === reelId);
        if (reel) {
            const isLiked = reel.reactions.like.includes(store.db.currentUserId);
            if (!isLiked) {
                this.likeReel(reelId, true);
            }
            
            // Trigger giant heart animation
            const heartAnim = document.getElementById(`reel-heart-${reelId}`);
            if (heartAnim) {
                // Reset animation
                heartAnim.style.animation = 'none';
                heartAnim.offsetHeight; // trigger reflow
                heartAnim.style.animation = 'doubleClickHeart 1s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards';
            }
        }
    }

    toggleReelPlay(videoEl, reelId) {
        const animIcon = document.getElementById(`reel-play-pause-${reelId}`);
        
        if (videoEl.paused) {
            videoEl.play();
            if (animIcon) {
                animIcon.innerHTML = `<svg width="60" height="60" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
            }
        } else {
            videoEl.pause();
            if (animIcon) {
                animIcon.innerHTML = `<svg width="60" height="60" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>`;
            }
        }

        // Trigger pulse animation
        if (animIcon) {
            animIcon.style.animation = 'none';
            animIcon.offsetHeight;
            animIcon.style.animation = 'pulsePlayPause 0.6s ease-out forwards';
        }
    }

    toggleReelSound(event, reelId) {
        event.stopPropagation();
        // Toggle the global state
        window.appReelsMuted = !window.appReelsMuted;
        
        // Update all rendered reels immediately
        document.querySelectorAll('.reel-card').forEach(card => {
            const videoEl = card.querySelector('.reel-media');
            const rId = card.id.replace('reel-', '');
            const iconSvg = document.getElementById(`reel-sound-icon-${rId}`);
            
            if (videoEl && iconSvg) {
                videoEl.muted = window.appReelsMuted;
                if (window.appReelsMuted) {
                    iconSvg.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line>`;
                } else {
                    iconSvg.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>`;
                }
            }
        });
    }

    updateReelProgress(videoEl, reelId) {
        const fill = document.getElementById(`reel-progress-fill-${reelId}`);
        if (fill && videoEl.duration) {
            const progress = (videoEl.currentTime / videoEl.duration) * 100;
            fill.style.width = `${progress}%`;
        }
    }

    seekReel(event, container, reelId) {
        event.stopPropagation();
        const reelCard = document.getElementById(`reel-${reelId}`);
        if (reelCard) {
            const videoEl = reelCard.querySelector('.reel-media');
            if (videoEl && videoEl.duration) {
                const rect = container.getBoundingClientRect();
                const pos = (event.clientX - rect.left) / rect.width;
                videoEl.currentTime = pos * videoEl.duration;
            }
        }
    }

    openReelComments(reelId) {
        this.currentReelId = reelId;
        const modal = document.getElementById('reel-comments-modal');
        const list = document.getElementById('reel-comments-list');
        if (!modal || !list) return;

        const reel = store.getReels().find(r => r.id === reelId);
        list.innerHTML = (reel.comments || []).map(c => {
            const author = store.getUser(c.authorId);
            const isCommentOwner = c.authorId === store.db.currentUserId;
            const isReelOwner = reel.authorId === store.db.currentUserId;
            
            let actionsHtml = '';
            if (isCommentOwner || isReelOwner) {
                actionsHtml += `<div style="display: flex; gap: 8px; margin-top: 4px;">`;
                if (isCommentOwner) {
                    actionsHtml += `<span style="font-size: 11px; color: var(--text-secondary); cursor: pointer;" onclick="app.editReelCommentUI('${c.id}', \`${escapeHtml(c.text).replace(/`/g, '\\`')}\`)">Edit</span>`;
                }
                actionsHtml += `<span style="font-size: 11px; color: var(--danger, #ff4d4d); cursor: pointer;" onclick="app.deleteReelCommentUI('${c.id}')">Delete</span>`;
                actionsHtml += `</div>`;
            }

            return `
                <div style="display: flex; gap: 12px; margin-bottom: 16px;">
                    <img src="${author.avatar}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; flex-shrink: 0;">
                    <div style="flex: 1;">
                        <strong style="font-size: 13px;">${author.name}</strong>
                        <p style="font-size: 14px; margin: 4px 0 0 0;">${escapeHtml(c.text)}</p>
                        ${actionsHtml}
                    </div>
                </div>
            `;
        }).join('');
        
        modal.classList.remove('hidden');
    }

    editReelCommentUI(commentId, oldText) {
        const newText = prompt("Edit your comment:", oldText);
        if (newText !== null && newText.trim() !== "" && newText.trim() !== oldText) {
            store.editReelComment(this.currentReelId, commentId, newText.trim());
            this.openReelComments(this.currentReelId);
            this.showToast('Comment updated', 'success');
        }
    }

    deleteReelCommentUI(commentId) {
        if (confirm("Are you sure you want to delete this comment?")) {
            store.deleteReelComment(this.currentReelId, commentId);
            this.openReelComments(this.currentReelId);
            // Also update the comment count on the reel card
            const reel = store.getReels().find(r => r.id === this.currentReelId);
            const reelCard = document.getElementById(`reel-${this.currentReelId}`);
            if (reelCard && reel) {
                const countSpan = reelCard.querySelector('.reel-action-btn:nth-child(2) span');
                if (countSpan) countSpan.textContent = reel.comments.length;
            }
            this.showToast('Comment deleted', 'info');
        }
    }

    closeReelComments() {
        const modal = document.getElementById('reel-comments-modal');
        if (modal) modal.classList.add('hidden');
    }

    submitReelComment() {
        const input = document.getElementById('reel-comment-input');
        if (!input || !input.value.trim() || !this.currentReelId) return;

        store.addReelComment(this.currentReelId, {
            id: 'rc_' + Date.now(),
            authorId: store.db.currentUserId,
            text: input.value.trim()
        });
        
        input.value = '';
        this.openReelComments(this.currentReelId);
        
        // Update count on card
        const reelCard = document.getElementById(`reel-${this.currentReelId}`);
        if (reelCard) {
            const commentLabel = reelCard.querySelector('.reel-action-btn:nth-child(2) span');
            if (commentLabel) {
                const count = store.getReels().find(r => r.id === this.currentReelId).comments.length;
                commentLabel.textContent = count;
            }
        }
    }

    shareReel(reelId) {
        this.openShareModal('reel', reelId);
    }

    saveReel(reelId) {
        const isSaved = store.toggleSavePost(reelId);
        
        // Update UI
        const iconSvg = document.getElementById(`reel-save-icon-${reelId}`);
        if (iconSvg) {
            iconSvg.setAttribute('fill', isSaved ? 'currentColor' : 'none');
            iconSvg.parentElement.style.color = isSaved ? 'var(--accent)' : 'white';
        }
        
        this.showToast(isSaved ? 'Reel saved!' : 'Reel removed from saved', 'info');
    }

    playWatchVideo(videoId) {
        const v = store.getWatchVideos().find(x => x.id === videoId);
        if (v) {
            if (v.url) {
                this.showToast(`Opening ${v.platform || 'video'}: "${v.title}"... 🚀`, 'info');
                window.open(v.url, '_blank');
            } else {
                this.showToast(`Playing "${v.title}" in HD 4K... 🎬`, 'info');
            }
        }
    }

    copyText(text, message = 'Copied to clipboard! 📋') {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                this.showToast(message, 'success');
            }).catch(() => {
                this.showToast(message, 'info');
            });
        } else {
            const tempInput = document.createElement('input');
            tempInput.value = text;
            document.body.appendChild(tempInput);
            tempInput.select();
            document.execCommand('copy');
            document.body.removeChild(tempInput);
            this.showToast(message, 'success');
        }
    }

    // ==========================================
    // GLOBAL SEARCH
    // ==========================================
    openSearchModal() {
        const modal = document.getElementById('search-modal');
        if (modal) {
            modal.classList.remove('hidden');
            const input = document.getElementById('modal-search-input');
            if (input) {
                input.value = '';
                input.focus();
            }
            document.getElementById('modal-search-results').innerHTML = '<div style="padding: 32px 16px; text-align: center; color: var(--text-tertiary);">Type to search...</div>';
        }
    }

    closeSearchModal() {
        const modal = document.getElementById('search-modal');
        if (modal) modal.classList.add('hidden');
    }

    bindSearch() {
        const input = document.getElementById('modal-search-input');
        const resultsContainer = document.getElementById('modal-search-results');
        if (!input || !resultsContainer) return;

        input.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            if (!query) {
                resultsContainer.innerHTML = '<div style="padding: 32px 16px; text-align: center; color: var(--text-tertiary);">Type to search...</div>';
                return;
            }

            const results = store.search(query);
            let html = '';

            if (results.people.length > 0) {
                html += `<div class="search-category-title" style="margin-top: 16px;">People</div>`;
                html += results.people.slice(0, 3).map(u => `
                    <div class="search-result-item" style="padding: 8px; border-radius: 8px; cursor: pointer;" onclick="app.closeSearchModal(); app.viewUserProfile('${u.id}')">
                        <img src="${u.avatar}" class="avatar-small" alt="${u.name}">
                        <div class="search-result-info">
                            <h4 style="margin:0;">${u.name}</h4>
                            <span style="font-size: 12px; color: var(--text-secondary);">@${u.username}</span>
                        </div>
                    </div>
                `).join('');
            }

            if (results.jobs.length > 0) {
                html += `<div class="search-category-title" style="margin-top: 16px;">Jobs</div>`;
                html += results.jobs.slice(0, 2).map(j => `
                    <div class="search-result-item" style="padding: 8px; border-radius: 8px; cursor: pointer;" onclick="app.closeSearchModal(); app.viewJobDetails('${j.id}')">
                        <img src="${j.logo}" style="width: 36px; height: 36px; border-radius: 6px; object-fit: cover;" alt="${j.company}" onerror="this.src='https://images.unsplash.com/photo-1497366216548-37526070297c?w=200'">
                        <div class="search-result-info">
                            <h4 style="margin:0;">${j.title}</h4>
                            <span style="font-size: 12px; color: var(--text-secondary);">${j.company} &bull; ${j.location}</span>
                        </div>
                    </div>
                `).join('');
            }

            if (!html) {
                html = `<div style="padding: 32px 16px; text-align: center; color: var(--text-tertiary);">No results for "${escapeHtml(query)}"</div>`;
            }

            resultsContainer.innerHTML = html;
        });
    }


    // ==========================================
    // SHARE MODAL SYSTEM
    // ==========================================
    openShareModal(type, id) {
        const modal = document.getElementById("share-modal");
        const linkInput = document.getElementById("share-link-input");
        const friendsList = document.getElementById("share-friends-list");
        
        if (!modal || !linkInput || !friendsList) return;
        
        // Generate a fake link
        const baseUrl = "https://mukaputa.com";
        linkInput.value = `${baseUrl}/${type}/${id}`;
        
        // Populate friends list for direct sending
        const friends = store.getFriends(store.db.currentUserId);
        if (friends.length === 0) {
            friendsList.innerHTML = `<p class="text-secondary" style="font-size: 13px;">Add some friends to send this directly!</p>`;
        } else {
            friendsList.innerHTML = friends.map(f => `
                <div style="display: flex; flex-direction: column; align-items: center; gap: 8px; flex-shrink: 0; width: 64px;">
                    <img src="${f.avatar}" style="width: 52px; height: 52px; border-radius: 50%; object-fit: cover; border: 1px solid var(--border);">
                    <span style="font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; text-align: center;">${f.name.split(" ")[0]}</span>
                    <button class="btn btn-secondary btn-sm" onclick="app.sendToFriend('${f.id}', '${type}', '${id}')" style="padding: 4px 10px; font-size: 11px; border-radius: 12px;">Send</button>
                </div>
            `).join("");
        }
        
        modal.classList.remove("hidden");
    }

    closeShareModal() {
        const modal = document.getElementById("share-modal");
        if (modal) modal.classList.add("hidden");
    }

    copyShareLink() {
        const linkInput = document.getElementById("share-link-input");
        if (linkInput) {
            linkInput.select();
            document.execCommand("copy"); // fallback for older browsers just in case
            this.showToast("Link copied to clipboard! ??", "success");
        }
    }

    async sendToFriend(friendId, type, id) {
        const friend = store.getUser(friendId);
        if (friend) {
            // Find or properly create conversation with this friend on the backend
            let conv = await store.getConversationWithUser(friendId);
            
            const baseUrl = "https://mukaputa.com";
            const messageText = `Check out this ${type}:\n${baseUrl}/${type}/${id}`;
            
            store.sendMessage(conv.id, messageText, store.db.currentUserId, 'text');
            
            this.showToast(`Sent to ${friend.name}! 🚀`, "success");
            this.closeShareModal();
        }
    }


    // ==========================================
    // NOTIFICATIONS SYSTEM
    // ==========================================
    toggleNotifications() {
        this.switchView('notifications');
    }

    renderNotificationsView() {
        const container = document.getElementById('notifications-view');
        if (!container) return;
        
        const notifs = store.getNotifications();
        
        let html = `
            <div class="card" style="margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <h2 style="font-size: 20px; font-weight: 700;">Notifications</h2>
                    ${notifs.length > 0 ? `<button class="btn btn-secondary btn-sm" onclick="app.markAllNotificationsRead()">Mark all as read</button>` : ''}
                </div>
                <div class="notifications-list">
        `;

        if (notifs.length > 0) {
            html += notifs.map(n => renderNotificationItem(n)).join('');
        } else {
            html += `<div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                        <div style="font-size: 48px; margin-bottom: 12px;">🔔</div>
                        <p>All caught up! No notifications.</p>
                     </div>`;
        }

        html += `
                </div>
            </div>
        `;
        
        container.innerHTML = html;
    }

    handleNotificationClick(notifId, type, targetId) {
        store.markNotificationRead(notifId);
        this.updateNotificationBadge();

        const reactionTypes = ['like', 'love', 'haha', 'wow', 'sad', 'angry'];
        if (reactionTypes.includes(type) || type === 'comment') {
            this.switchView('home');
        } else if (type === 'friend_request') {
            this.switchView('friends');
        } else if (type === 'follow') {
            this.switchView('profile', { userId: targetId });
        } else if (type === 'message') {
            this.startChatWithUser(targetId);
        } else if (type === 'job') {
            this.switchView('jobs');
        } else if (type === 'event_invite') {
            this.switchView('events');
        }
    }

    markAllNotificationsRead() {
        store.markAllNotificationsRead();
        if (this.activeView === 'notifications') {
            this.renderNotificationsView();
        }
        this.updateNotificationBadge();
        this.showToast('All notifications marked as read ✔', 'info');
    }

    updateNotificationBadge() {
        const badge = document.getElementById('notification-badge');
        if (!badge) return;
        const count = store.getUnreadNotificationCount();
        if (count > 0) {
            badge.textContent = count;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    // ==========================================
    // MESSAGING & CHAT SYSTEM
    // ==========================================
    toggleMessenger() {
        this.switchView('messages');
    }

    renderMessagesView(activeConvId = null) {
        const container = document.getElementById('messages-view');
        if (!container) return;

        this._activeConvId = activeConvId; // tracked so polling can refresh the open thread

        const convs = store.getConversations();
        
        let sidebarHtml = `
            <div class="messages-sidebar ${activeConvId ? 'hidden-on-mobile' : ''}">
                <div class="messages-sidebar-header" style="display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <button class="icon-btn-small" onclick="app.switchView('home')">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                        </button>
                        <h2 style="font-size: 24px; font-weight: 700; margin: 0;">Chats</h2>
                    </div>
                    <button class="icon-btn-small" onclick="app.showNewMessageModal()">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                    </button>
                </div>
                <div class="messages-list" id="messages-sidebar-list">
                </div>
            </div>
        `;

        let chatAreaHtml = `
            <div class="messages-chat-area ${!activeConvId ? 'hidden-on-mobile' : ''}">
        `;

        if (activeConvId) {
            const conv = store.getConversation(activeConvId);
            const otherId = conv.participantIds.find(id => id !== store.db.currentUserId);
            const otherUser = store.getUser(otherId);
            
            chatAreaHtml += `
                <div class="chat-area-header">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <button class="icon-btn-small mobile-only" onclick="app.renderMessagesView(null)" style="margin-left: -8px;">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                        </button>
                        <img src="${otherUser.avatar}" class="avatar-small" alt="${otherUser.name}">
                        <div>
                            <h3 style="margin: 0; font-size: 16px;">${otherUser.name}</h3>
                            <span style="font-size: 12px; color: var(--status-online);">Active now</span>
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="icon-btn-small" style="color: var(--accent);" onclick="app.startCall('${otherUser.id}', 'audio')">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                        </button>
                        <button class="icon-btn-small" style="color: var(--accent);" onclick="app.startCall('${otherUser.id}', 'video')">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
                        </button>
                        <button class="icon-btn-small" style="color: var(--accent);" onclick="app.viewUserProfile('${otherUser.id}')">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                        </button>
                    </div>
                </div>
                <div class="chat-area-messages chat-body" id="chat-body-${conv.id}">
                </div>
                <form class="chat-area-input" style="z-index: 10; position: relative;" onsubmit="event.preventDefault(); app.sendMainChatMessage('${conv.id}', '${otherUser.id}');">
                    <button type="button" class="icon-btn-small" style="color: var(--accent);" onclick="app.triggerImageUpload('${conv.id}', '${otherUser.id}')">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                    </button>
                    <button type="button" id="voice-btn-${conv.id}" class="icon-btn-small" style="color: var(--accent);" onclick="app.recordVoiceNote('${conv.id}', '${otherUser.id}')">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>
                    </button>
                    <input type="text" id="main-chat-input-${conv.id}" class="chat-input" placeholder="Aa" autocomplete="off" style="pointer-events: auto; user-select: auto;">
                    <button type="submit" class="icon-btn-small" style="color: var(--accent); background: none; border: none; pointer-events: auto;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                    </button>
                </form>
            `;
        } else {
            chatAreaHtml += `
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--text-secondary);">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 16px; opacity: 0.5;"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                    <h3 style="font-size: 20px; font-weight: 600; color: var(--text-primary);">Select a conversation</h3>
                    <p style="margin-bottom: 24px;">Choose a chat from the list or start a new one.</p>
                    <button class="btn btn-primary" onclick="app.showNewMessageModal()">New Message</button>
                </div>
            `;
        }
        
        chatAreaHtml += `</div>`;

        container.innerHTML = `
            <div class="messages-layout card">
                ${sidebarHtml}
                ${chatAreaHtml}
            </div>
        `;

        this.updateMessagesSidebar(activeConvId);
        
        if (activeConvId) {
            this.renderChatMessages(activeConvId);
        }
    }

    updateMessagesSidebar(activeConvId) {
        const sidebarList = document.getElementById('messages-sidebar-list');
        if (!sidebarList) return;

        const convs = store.getConversations();
        let html = '';

        if (convs.length > 0) {
            html = convs.map(c => {
                const otherId = c.participantIds.find(id => id !== store.db.currentUserId);
                const otherUser = store.getUser(otherId);
                const lastMsg = c.messages && c.messages.length > 0 ? c.messages[c.messages.length - 1] : null;
                const isActive = c.id === activeConvId;
                
                const isUnread = lastMsg && lastMsg.senderId !== store.db.currentUserId && Math.random() > 0.5;
                const timeStr = lastMsg ? timeAgo(lastMsg.createdAt).replace(' ago', '') : '';
                
                return `
                    <div class="menu-item ${isActive ? 'active' : ''}" style="padding: 12px; gap: 12px; border-radius: 8px;" onclick="app.renderMessagesView('${c.id}')">
                        <div style="position: relative;">
                            <img src="${otherUser.avatar}" class="avatar" alt="${otherUser.name}">
                            ${isUnread ? '<div style="position: absolute; top: 0; right: 0; width: 12px; height: 12px; background: var(--accent); border: 2px solid var(--bg-card); border-radius: 50%;"></div>' : ''}
                        </div>
                        <div style="flex: 1; overflow: hidden;">
                            <h4 style="font-size: 15px; margin: 0; ${isUnread ? 'font-weight: 700;' : 'font-weight: 500;'}">${otherUser.name}</h4>
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <p style="font-size: 13px; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; ${isUnread ? 'font-weight: 600; color: var(--text-primary);' : 'color: var(--text-secondary);'}">
                                    ${lastMsg ? (lastMsg.senderId === store.db.currentUserId ? 'You: ' + escapeHtml(lastMsg.text || 'Attachment') : escapeHtml(lastMsg.text || 'Attachment')) : 'Start conversation...'}
                                </p>
                                <span style="font-size: 11px; color: var(--text-tertiary); margin-left: 6px; flex-shrink: 0;">${timeStr}</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            html = `
                <div style="padding: 40px 20px; text-align: center; color: var(--text-secondary);">
                    <div style="margin-bottom: 12px;">No messages yet</div>
                    <button class="btn btn-primary btn-sm" onclick="app.showNewMessageModal()">Start a Chat</button>
                </div>
            `;
        }
        sidebarList.innerHTML = html;
    }

    async startChatWithUser(otherUserId, initialText = null) {
        const conv = await store.getConversationWithUser(otherUserId);
        this.switchView('messages');
        this.renderMessagesView(conv.id);

        if (initialText) {
            this.sendMainChatMessage(conv.id, otherUserId, initialText);
        }
    }

    sendMainChatMessage(convId, otherUserId, explicitText = null) {
        let text = explicitText;
        let inputEl = null;
        if (!text) {
            inputEl = document.getElementById(`main-chat-input-${convId}`);
            if (!inputEl) return;
            text = inputEl.value.trim();
            if (!text) return;
            inputEl.value = '';
        }

        this.sendChatMessage(convId, text, otherUserId);
        
        // Update sidebar preview text manually to avoid full DOM re-render which breaks typing indicator and focus
        const sidebarItems = document.querySelectorAll('.messages-list .menu-item');
        sidebarItems.forEach(item => {
            if (item.getAttribute('onclick') && item.getAttribute('onclick').includes(convId)) {
                const previewEl = item.querySelector('p');
                const timeEl = item.querySelector('span');
                if (previewEl) previewEl.textContent = 'You: ' + text;
                if (timeEl) timeEl.textContent = 'Just now';
            }
        });
        
        if (inputEl) {
            inputEl.focus();
        }
    }

    showNewMessageModal() {
        const modal = document.getElementById('new-message-modal');
        const list = document.getElementById('new-message-friends-list');
        if (!modal || !list) return;

        const friends = store.getFriends(store.db.currentUserId);
        
        if (friends.length === 0) {
            list.innerHTML = `<div style="text-align:center; padding: 40px 20px; color: var(--text-secondary);">You don't have any friends yet.<br><br>Go to the Friends page to connect with people!</div>`;
        } else {
            list.innerHTML = friends.map(f => `
                <div class="menu-item" style="padding: 12px; border-radius: 8px; gap: 12px;" onclick="document.getElementById('new-message-modal').classList.add('hidden'); app.startChatWithUser('${f.id}')">
                    <img src="${f.avatar}" class="avatar" alt="${f.name}">
                    <div>
                        <strong style="font-size: 15px; color: var(--text-primary);">${f.name}</strong>
                    </div>
                </div>
            `).join('');
        }

        modal.classList.remove('hidden');
    }

    openFloatingChat(convId, otherUser) {
        const container = document.getElementById('floating-chat-container');
        if (!container) return;

        let existing = document.getElementById(`chat-win-${convId}`);
        if (existing) {
            existing.classList.remove('minimized');
            return;
        }

        const win = document.createElement('div');
        win.className = 'floating-chat-window';
        win.id = `chat-win-${convId}`;
        win.innerHTML = `
            <div class="chat-header" onclick="app.toggleMinimizeChat('${convId}')">
                <div class="chat-header-user">
                    <img src="${otherUser.avatar}" class="avatar-small" alt="${otherUser.name}">
                    <div>
                        <strong>${otherUser.name}</strong>
                        <div style="font-size: 10px; color: var(--status-online);">Active Now</div>
                    </div>
                </div>
                <div class="chat-header-actions">
                    <button class="icon-btn-small" onclick="event.stopPropagation(); app.closeFloatingChat('${convId}')">✕</button>
                </div>
            </div>
            <div class="chat-body" id="chat-body-${convId}"></div>
            <form class="chat-footer" style="margin: 0; display: flex; align-items: center; gap: 4px; padding: 12px;" onsubmit="event.preventDefault(); app.submitChatMessage('${convId}', '${otherUser.id}');">
                <button type="button" class="icon-btn-small" style="color: var(--accent); padding: 4px;" onclick="app.triggerImageUpload('${convId}', '${otherUser.id}')">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                </button>
                <button type="button" id="voice-btn-${convId}" class="icon-btn-small" style="color: var(--accent); padding: 4px;" onclick="app.recordVoiceNote('${convId}', '${otherUser.id}')">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>
                </button>
                <input type="text" class="chat-input" id="chat-input-${convId}" placeholder="Aa" autocomplete="off" style="pointer-events: auto; user-select: auto;">
                <button type="submit" class="icon-btn-small" style="color: var(--accent); padding: 4px; background: none; border: none; pointer-events: auto;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                </button>
            </form>
        `;

        container.appendChild(win);
        this.renderChatMessages(convId);
    }

    renderChatMessages(convId) {
        // Try getting both the floating body and the main full-screen body
        const floatingBody = document.getElementById(`chat-body-${convId}`);
        const mainBody = document.getElementById(`main-chat-body-${convId}`);
        const conv = store.getConversations().find(c => c.id === convId);
        
        if (!conv) return;

        // Mock Read Receipts: Assume last message sent by Me is 'Delivered' (not read), and previous ones are 'Read'
        const myMessages = conv.messages.filter(m => m.senderId === store.db.currentUserId);
        if (myMessages.length > 0) {
            myMessages.forEach(m => m.isRead = true);
            myMessages[myMessages.length - 1].isRead = false; // Last one just delivered
        }

        const renderHtml = conv.messages.map(m => {
            const isMe = m.senderId === store.db.currentUserId;
            
            // Handle reply context
            let replyHtml = '';
            if (m.replyTo) {
                const repliedMsg = conv.messages.find(msg => msg.id === m.replyTo);
                if (repliedMsg) {
                    replyHtml = `<div style="background: rgba(0,0,0,0.15); border-left: 3px solid var(--accent); padding: 4px 8px; border-radius: 4px; font-size: 11px; margin-bottom: 6px; color: ${isMe ? 'rgba(255,255,255,0.8)' : 'var(--text-secondary)'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;">
                        ${escapeHtml(repliedMsg.text || 'Attachment')}
                    </div>`;
                }
            }

            let contentHtml = '';
            if (m.type === 'image') {
                contentHtml = `${replyHtml}<img src="${escapeHtml(m.text)}" style="max-width: 200px; border-radius: 8px; display: block; margin-bottom: 4px;">`;
            } else if (m.type === 'audio') {
                contentHtml = `${replyHtml}${this.renderVoiceNotePlayer(m.text)}`;
            } else if (m.type === 'call') {
                contentHtml = `${replyHtml}${this.renderCallLog(m.text)}`;
            } else {
                let textContent = escapeHtml(m.text);
                
                // Parse Mukaputa links for rich preview buttons
                const urlMatch = m.text.match(/https:\/\/mukaputa\.com\/(reel|post)\/([a-zA-Z0-9_-]+)/);
                if (urlMatch) {
                    const type = urlMatch[1];
                    const linkId = urlMatch[2];
                    let embedHtml = `<br><button type="button" style="margin-top: 8px; background: rgba(255,255,255,0.2); border: none; color: white; padding: 6px 12px; border-radius: 12px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" onclick="app.switchView('${type === 'reel' ? 'reels' : 'home'}')">${type === 'reel' ? '▶ View Reel' : 'View Post'}</button>`;
                    
                    if (type === 'reel') {
                        const reel = store.getReels().find(r => r.id === linkId);
                        if (reel) {
                            const author = store.getUser(reel.authorId);
                            embedHtml = `
                                <div style="margin-top: 8px; border-radius: 12px; overflow: hidden; background: #000; width: 180px; height: 320px; position: relative; border: 1px solid rgba(255,255,255,0.1); cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.5);" onclick="app.switchView('reels')">
                                    <video src="${escapeHtml(reel.videoUrl)}" style="width: 100%; height: 100%; object-fit: cover;" muted autoplay loop playsinline></video>
                                    <div style="position: absolute; bottom: 12px; left: 12px; display: flex; align-items: center; gap: 6px; z-index: 2;">
                                        <img src="${escapeHtml(author?.avatar || '')}" style="width: 24px; height: 24px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.3);">
                                        <span style="color: white; font-size: 12px; font-weight: 600; text-shadow: 0 1px 3px rgba(0,0,0,0.8);">${escapeHtml(author?.name || 'Unknown')}</span>
                                    </div>
                                    <div style="position: absolute; top: 12px; right: 12px; background: rgba(0,0,0,0.5); padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; backdrop-filter: blur(4px);">
                                        Reel
                                    </div>
                                </div>
                            `;
                        }
                    }
                    
                    textContent = textContent.replace(urlMatch[0], embedHtml);
                    textContent = textContent.replace(/\n/g, '<br>');
                } else {
                    // Regular text
                    textContent = textContent.replace(/\n/g, '<br>');
                }

                contentHtml = `${replyHtml}${textContent}` + (m.isEdited ? `<span style="font-size: 10px; color: ${isMe ? 'rgba(255,255,255,0.7)' : 'var(--text-tertiary)'}; margin-left: 4px;">(edited)</span>` : '');
            }

            // Reactions Html
            const reactionHtml = m.reaction ? `
                <div style="position: absolute; bottom: -8px; ${isMe ? 'right: 12px;' : 'left: 12px;'} background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 12px; padding: 2px 4px; font-size: 12px; box-shadow: var(--shadow-xs);">
                    ${m.reaction}
                </div>
            ` : '';

            // Actions (Reply, Edit, Unsend)
            const actionsHtml = `
                <div class="msg-actions" style="display: none; position: absolute; ${isMe ? 'right: 100%' : 'left: 100%'}; top: 50%; transform: translateY(-50%); padding: 0 8px; gap: 4px; z-index: 2;">
                    <button onclick="app.setReplyTo('${convId}', '${m.id}')" title="Reply" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text-primary);"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 17 4 12 9 7"></polyline><path d="M20 18v-2a4 4 0 0 0-4-4H4"></path></svg></button>
                    ${isMe && m.type === 'text' ? `<button onclick="app.promptEditChatMessage('${convId}', '${m.id}')" title="Edit" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text-primary);"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg></button>` : ''}
                    ${isMe ? `<button onclick="app.unsendChatMessage('${convId}', '${m.id}')" title="Unsend" style="background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--danger);"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>` : ''}
                </div>
            `;

            // Read receipt logic
            let receiptHtml = '';
            if (isMe) {
                if (m.isRead) {
                    receiptHtml = `<svg style="margin-left: 4px; vertical-align: middle; color: var(--accent);" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L7 17l-5-5"></path><path d="M22 10l-3.5 3.5L14 10"></path></svg>`;
                } else {
                    receiptHtml = `<svg style="margin-left: 4px; vertical-align: middle; color: var(--text-muted);" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L7 17l-5-5"></path><path d="M22 10l-3.5 3.5L14 10"></path></svg>`;
                }
            }

            return `
                <div class="chat-msg ${isMe ? 'sent' : 'received'}" style="position: relative; margin-bottom: 12px;" onmouseenter="this.querySelector('.msg-actions')?.style.setProperty('display', 'flex')" onmouseleave="this.querySelector('.msg-actions')?.style.setProperty('display', 'none')">
                    ${actionsHtml}
                    <div class="chat-bubble" title="Double click to react ❤️" ondblclick="app.toggleReaction('${convId}', '${m.id}')" style="cursor: pointer; position: relative;">
                        ${contentHtml}
                        ${reactionHtml}
                    </div>
                    <span class="chat-time" style="display: block; margin-top: 4px; font-size: 10px; opacity: 0.8; padding: 0 4px;">
                        ${timeAgo(m.createdAt)}
                        ${receiptHtml}
                    </span>
                </div>
            `;
        }).join('');

        // Render to wherever it's open
        if (floatingBody) {
            floatingBody.innerHTML = renderHtml;
            // Typing indicator
            if (conv.isTyping) {
                floatingBody.innerHTML += `<div class="chat-msg received" style="margin-bottom: 12px;"><div class="chat-bubble" style="background: var(--bg-tertiary); padding: 8px 12px; border-radius: 18px; display: inline-flex; align-items: center; gap: 4px; height: 32px;"><div style="width: 6px; height: 6px; background: var(--text-secondary); border-radius: 50%; animation: bounce 1.4s infinite ease-in-out both; animation-delay: -0.32s;"></div><div style="width: 6px; height: 6px; background: var(--text-secondary); border-radius: 50%; animation: bounce 1.4s infinite ease-in-out both; animation-delay: -0.16s;"></div><div style="width: 6px; height: 6px; background: var(--text-secondary); border-radius: 50%; animation: bounce 1.4s infinite ease-in-out both;"></div></div></div>`;
            }
            floatingBody.scrollTop = floatingBody.scrollHeight;
        }

        if (mainBody) {
            mainBody.innerHTML = renderHtml;
            // Typing indicator
            if (conv.isTyping) {
                mainBody.innerHTML += `<div class="chat-msg received" style="margin-bottom: 12px;"><div class="chat-bubble" style="background: var(--bg-tertiary); padding: 8px 12px; border-radius: 18px; display: inline-flex; align-items: center; gap: 4px; height: 32px;"><div style="width: 6px; height: 6px; background: var(--text-secondary); border-radius: 50%; animation: bounce 1.4s infinite ease-in-out both; animation-delay: -0.32s;"></div><div style="width: 6px; height: 6px; background: var(--text-secondary); border-radius: 50%; animation: bounce 1.4s infinite ease-in-out both; animation-delay: -0.16s;"></div><div style="width: 6px; height: 6px; background: var(--text-secondary); border-radius: 50%; animation: bounce 1.4s infinite ease-in-out both;"></div></div></div>`;
            }
            mainBody.scrollTop = mainBody.scrollHeight;
        }
    }

    submitChatMessage(convId, otherUserId) {
        const input = document.getElementById(`chat-input-${convId}`);
        if (!input) return;
        const text = input.value.trim();
        if (text) {
            this.sendChatMessage(convId, text, otherUserId);
            input.value = '';
        }
    }

    startCall(userId, type = 'audio') {
        // Real WebRTC calling -- see js/calls.js. It rings on the other
        // person's screen live and they can accept/decline for real.
        Calls.start(userId, type);
    }

    triggerImageUpload(convId, otherUserId) {
        const input = document.getElementById('chat-image-upload');
        if (input) {
            input.dataset.convId = convId;
            input.dataset.otherId = otherUserId;
            input.click();
        }
    }

    async handleImageSelected(event) {
        const file = event.target.files[0];
        if (!file) return;
        const convId = event.target.dataset.convId;
        event.target.value = '';

        const url = await this.uploadFile(file);
        if (!url) return;

        store.sendMessage(convId, url, store.db.currentUserId, 'image');
        this.renderChatMessages(convId);
    }

    async recordVoiceNote(convId, otherUserId) {
        const btn = document.getElementById(`voice-btn-${convId}`);
        const inputField = document.getElementById(`chat-input-${convId}`) || document.getElementById(`main-chat-input-${convId}`);
        if (!btn || !inputField) return;

        // Already recording this conversation -> stop it.
        if (this._activeRecorder && this._activeRecorder.convId === convId) {
            this._activeRecorder.recorder.stop();
            return;
        }
        if (this._activeRecorder) {
            this.showToast('Please finish your current recording first.', 'info');
            return;
        }
        if (!navigator.mediaDevices || !window.MediaRecorder) {
            this.showToast('Voice recording is not supported in this browser.', 'danger');
            return;
        }

        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 48000,
                    channelCount: 1
                } 
            });
        } catch (e) {
            this.showToast('Microphone access denied.', 'danger');
            return;
        }

        const mimeCandidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
        const mimeType = mimeCandidates.find(t => window.MediaRecorder.isTypeSupported && window.MediaRecorder.isTypeSupported(t)) || '';
        
        const recorderOptions = { audioBitsPerSecond: 128000 };
        if (mimeType) {
            recorderOptions.mimeType = mimeType;
        }
        
        const recorder = new MediaRecorder(stream, recorderOptions);
        const chunks = [];
        const startedAt = Date.now();

        // --- Live, mic-reactive waveform (real audio levels, not decoration) ---
        let audioCtx = null, analyser = null, dataArray = null, rafId = null, bars = [], timerEl = null;
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            audioCtx = new AudioCtx();
            const source = audioCtx.createMediaStreamSource(stream);
            analyser = audioCtx.createAnalyser();
            analyser.fftSize = 64;
            analyser.smoothingTimeConstant = 0.75;
            source.connect(analyser);
            dataArray = new Uint8Array(analyser.frequencyBinCount);
        } catch (e) {
            console.warn('Live waveform unavailable, recording still works:', e);
        }

        const drawFrame = () => {
            if (!analyser || bars.length === 0) return;
            analyser.getByteFrequencyData(dataArray);
            const step = Math.floor(dataArray.length / bars.length) || 1;
            bars.forEach((bar, i) => {
                const level = dataArray[i * step] / 255; // 0..1 real mic amplitude for this band
                const pct = Math.max(14, Math.min(100, level * 100));
                bar.style.height = pct + '%';
            });
            if (timerEl) timerEl.textContent = this.formatDuration((Date.now() - startedAt) / 1000);
            rafId = requestAnimationFrame(drawFrame);
        };

        const restoreUI = () => {
            btn.classList.remove('recording');
            btn.style.color = 'var(--accent)';
            btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="22"></line></svg>`;
            const visualizer = inputField.parentElement.querySelector('.voice-recording-visualizer');
            if (visualizer) visualizer.remove();
            inputField.style.display = 'block';
            if (rafId) cancelAnimationFrame(rafId);
            if (audioCtx) { try { audioCtx.close(); } catch (e) {} }
            if (this._recorderTimerInterval) { clearInterval(this._recorderTimerInterval); this._recorderTimerInterval = null; }
        };

        recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };

        recorder.onstop = async () => {
            stream.getTracks().forEach(t => t.stop());
            this._activeRecorder = null;
            clearTimeout(maxDurationTimer);
            restoreUI();

            const elapsedMs = Date.now() - startedAt;
            if (elapsedMs < 600 || chunks.length === 0) {
                this.showToast('Recording too short.', 'info');
                return;
            }

            const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' });
            const ext = (blob.type.includes('mp4') || blob.type.includes('aac')) ? 'm4a'
                : blob.type.includes('ogg') ? 'ogg' : 'webm';
            const file = new File([blob], `voice-note-${Date.now()}.${ext}`, { type: blob.type });

            const url = await this.uploadFile(file);
            if (!url) return;

            store.sendMessage(convId, url, store.db.currentUserId, 'audio');
            this.renderChatMessages(convId);
        };

        this._activeRecorder = { recorder, convId };
        recorder.start();

        const maxDurationTimer = setTimeout(() => {
            if (this._activeRecorder && this._activeRecorder.convId === convId) {
                this.showToast('Max recording length reached (2 min).', 'info');
                recorder.stop();
            }
        }, 120000);

        // Recording UI
        btn.classList.add('recording');
        btn.style.color = 'var(--danger)';
        btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg>`;

        inputField.style.display = 'none';
        const visualizer = document.createElement('div');
        visualizer.className = 'voice-recording-visualizer';
        visualizer.innerHTML = `
            <span class="voice-recording-dot"></span>
            <span class="voice-recording-timer">0:00</span>
            <div class="voice-recording-bars"></div>
        `;
        inputField.parentElement.insertBefore(visualizer, inputField);

        timerEl = visualizer.querySelector('.voice-recording-timer');
        const barsContainer = visualizer.querySelector('.voice-recording-bars');
        bars = [...Array(20)].map(() => {
            const bar = document.createElement('div');
            bar.className = 'voice-recording-bar';
            barsContainer.appendChild(bar);
            return bar;
        });

        if (analyser) {
            rafId = requestAnimationFrame(drawFrame);
        } else {
            // Fallback if AudioContext/AnalyserNode isn't available: gentle
            // generic pulse so recording still visibly looks "alive".
            bars.forEach(bar => {
                bar.style.animation = `voiceWave ${0.4 + Math.random() * 0.4}s infinite ease-in-out alternate ${Math.random() * 0.5}s`;
            });
            this._recorderTimerInterval = setInterval(() => {
                if (timerEl) timerEl.textContent = this.formatDuration((Date.now() - startedAt) / 1000);
            }, 500);
        }
    }

    // ==========================================
    // REAL VOICE NOTE PLAYBACK
    // ==========================================
    renderVoiceNotePlayer(url) {
        const safeUrl = escapeHtml(url);
        return `
            <div class="voice-note-player">
                <audio class="voice-note-audio" src="${safeUrl}" preload="metadata"
                    onloadedmetadata="app.onVoiceMeta(this)"
                    ontimeupdate="app.onVoiceTimeUpdate(this)"
                    onended="app.onVoiceEnded(this)"></audio>
                <button type="button" class="voice-note-play-btn" onclick="app.toggleVoicePlayback(this)">
                    <svg class="icon-play" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                    <svg class="icon-pause" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none" style="display:none;"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                </button>
                <div class="voice-note-track" onclick="app.seekVoice(event, this)">
                    <div class="voice-note-progress"></div>
                </div>
                <span class="voice-note-time">0:00</span>
            </div>
        `;
    }

    formatDuration(seconds) {
        if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) return '0:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${String(s).padStart(2, '0')}`;
    }

    setVoiceIcon(player, playing) {
        const playIcon = player.querySelector('.icon-play');
        const pauseIcon = player.querySelector('.icon-pause');
        if (playIcon) playIcon.style.display = playing ? 'none' : 'block';
        if (pauseIcon) pauseIcon.style.display = playing ? 'block' : 'none';
    }

    toggleVoicePlayback(btn) {
        const player = btn.closest('.voice-note-player');
        const audioEl = player.querySelector('.voice-note-audio');
        if (!audioEl) return;

        if (audioEl.paused) {
            if (this._currentlyPlayingAudio && this._currentlyPlayingAudio !== audioEl) {
                this._currentlyPlayingAudio.pause();
            }
            audioEl.play().catch(() => this.showToast('Could not play voice note.', 'danger'));
            this._currentlyPlayingAudio = audioEl;
            this.setVoiceIcon(player, true);
        } else {
            audioEl.pause();
            this.setVoiceIcon(player, false);
        }
    }

    seekVoice(event, trackEl) {
        const player = trackEl.closest('.voice-note-player');
        const audioEl = player.querySelector('.voice-note-audio');
        if (!audioEl || !isFinite(audioEl.duration)) return;
        const rect = trackEl.getBoundingClientRect();
        const pct = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
        audioEl.currentTime = pct * audioEl.duration;
    }

    onVoiceMeta(audioEl) {
        const player = audioEl.closest('.voice-note-player');
        const timeEl = player && player.querySelector('.voice-note-time');
        if (timeEl && audioEl.paused) timeEl.textContent = this.formatDuration(audioEl.duration);
    }

    onVoiceTimeUpdate(audioEl) {
        const player = audioEl.closest('.voice-note-player');
        if (!player) return;
        const progress = player.querySelector('.voice-note-progress');
        const timeEl = player.querySelector('.voice-note-time');
        const pct = audioEl.duration ? (audioEl.currentTime / audioEl.duration) * 100 : 0;
        if (progress) progress.style.width = pct + '%';
        if (timeEl) timeEl.textContent = this.formatDuration(audioEl.currentTime);
    }

    onVoiceEnded(audioEl) {
        const player = audioEl.closest('.voice-note-player');
        if (!player) return;
        this.setVoiceIcon(player, false);
        const progress = player.querySelector('.voice-note-progress');
        if (progress) progress.style.width = '0%';
        const timeEl = player.querySelector('.voice-note-time');
        if (timeEl) timeEl.textContent = this.formatDuration(audioEl.duration);
        if (this._currentlyPlayingAudio === audioEl) this._currentlyPlayingAudio = null;
    }

    // ==========================================
    // CALL HISTORY LOG BUBBLES
    // ==========================================
    renderCallLog(rawText) {
        let data = {};
        try { data = JSON.parse(rawText); } catch (e) { data = {}; }
        const isVideo = data.kind === 'video';

        const labels = {
            completed: isVideo ? 'Video call' : 'Voice call',
            missed: 'Missed call',
            declined: 'Call declined',
            cancelled: 'Missed call',
            unavailable: 'Call not answered'
        };
        let label = labels[data.status] || (isVideo ? 'Video call' : 'Voice call');
        if (data.status === 'completed' && data.duration) {
            label += ` · ${this.formatDuration(data.duration)}`;
        }

        const icon = isVideo
            ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>`
            : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>`;

        return `<div class="chat-call-log">${icon}<span>${escapeHtml(label)}</span></div>`;
    }

    promptEditChatMessage(convId, msgId) {
        const conv = store.getConversations().find(c => c.id === convId);
        if (conv) {
            const msg = conv.messages.find(m => m.id === msgId);
            if (msg && msg.type === 'text') {
                const newText = prompt("Edit message:", msg.text);
                if (newText !== null && newText.trim() !== '') {
                    store.editChatMessage(convId, msgId, newText.trim());
                    this.renderChatMessages(convId);
                }
            }
        }
    }

    unsendChatMessage(convId, msgId) {
        if (confirm("Unsend this message for everyone?")) {
            store.deleteChatMessage(convId, msgId);
            this.renderChatMessages(convId);
        }
    }

    toggleReaction(convId, msgId) {
        store.toggleMessageReaction(convId, msgId, '❤️');
        this.renderChatMessages(convId);
    }

    setReplyTo(convId, msgId) {
        this._currentReplyTo = { convId, msgId };
        const conv = store.getConversations().find(c => c.id === convId);
        const msg = conv.messages.find(m => m.id === msgId);
        
        // Show reply context above input
        const inputContainer = document.getElementById(`chat-input-${convId}`)?.parentElement;
        if (inputContainer) {
            // Remove existing reply banner if any
            const existing = inputContainer.parentElement.querySelector('.reply-banner');
            if (existing) existing.remove();
            
            const banner = document.createElement('div');
            banner.className = 'reply-banner';
            banner.style.cssText = 'background: rgba(0,0,0,0.05); padding: 8px 12px; border-left: 3px solid var(--accent); display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: var(--text-secondary);';
            banner.innerHTML = `
                <div style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Replying to: <strong>${escapeHtml(msg.text || 'Attachment')}</strong></div>
                <button onclick="app.cancelReply('${convId}')" style="background: none; border: none; cursor: pointer; color: var(--text-tertiary);">✕</button>
            `;
            inputContainer.parentElement.insertBefore(banner, inputContainer);
        }
        
        const input = document.getElementById(`chat-input-${convId}`) || document.getElementById(`main-chat-input-${convId}`);
        if (input) input.focus();
    }

    cancelReply(convId) {
        this._currentReplyTo = null;
        const inputContainer = document.getElementById(`chat-input-${convId}`)?.parentElement;
        if (inputContainer) {
            const existing = inputContainer.parentElement.querySelector('.reply-banner');
            if (existing) existing.remove();
        }
    }

    sendChatMessage(convId, text, otherUserId) {
        // Handle reply-to context (computed before sending so it's included
        // in the persisted message rather than lost after the fact).
        let replyTo = null;
        if (this._currentReplyTo && this._currentReplyTo.convId === convId) {
            replyTo = this._currentReplyTo.msgId;
            this.cancelReply(convId);
        }

        store.sendMessage(convId, text, store.db.currentUserId, 'text', replyTo);
        this.renderChatMessages(convId);
        // The other participant is a real account now -- their reply (if any)
        // will show up automatically the next time this thread polls/refreshes.
    }
    toggleMinimizeChat(convId) {
        const win = document.getElementById(`chat-win-${convId}`);
        if (win) win.classList.toggle('minimized');
    }

    closeFloatingChat(convId) {
        const win = document.getElementById(`chat-win-${convId}`);
        if (win) win.remove();
    }

    // ==========================================
    // FULLSCREEN STORY VIEWER (5-Second Timer)
    // ==========================================
    openStoryViewer(userId) {
        const modal = document.getElementById('story-viewer-modal');
        if (!modal) return;
        
        // Group all stories by user to allow seamless transition between users
        const allStories = store.getStories();
        const grouped = {};
        this.storyUsersOrder = [];
        
        allStories.forEach(s => {
            if (!grouped[s.authorId]) {
                grouped[s.authorId] = [];
                this.storyUsersOrder.push(s.authorId);
            }
            grouped[s.authorId].push(s);
        });
        
        this.groupedStories = grouped;
        
        // Find the index of the user that was clicked
        this.currentStoryUserIndex = this.storyUsersOrder.indexOf(userId);
        if (this.currentStoryUserIndex === -1) this.currentStoryUserIndex = 0;
        
        this.currentStoryItemIndex = 0;
        modal.classList.remove('hidden');
        this.renderStorySlide();
    }

    renderStorySlide() {
        if (this.currentStoryUserIndex >= this.storyUsersOrder.length) {
            this.closeStoryViewer();
            return;
        }
        
        if (this.currentStoryUserIndex < 0) this.currentStoryUserIndex = 0;
        
        const currentUserId = this.storyUsersOrder[this.currentStoryUserIndex];
        const userStories = this.groupedStories[currentUserId];
        
        if (this.currentStoryItemIndex >= userStories.length) {
            // Move to next user
            this.currentStoryUserIndex++;
            this.currentStoryItemIndex = 0;
            this.renderStorySlide();
            return;
        }
        
        if (this.currentStoryItemIndex < 0) {
            // Move to previous user
            if (this.currentStoryUserIndex > 0) {
                this.currentStoryUserIndex--;
                const prevUserStories = this.groupedStories[this.storyUsersOrder[this.currentStoryUserIndex]];
                this.currentStoryItemIndex = prevUserStories.length - 1;
                this.renderStorySlide();
            } else {
                this.currentStoryItemIndex = 0; // Stay at first story
            }
            return;
        }

        const story = userStories[this.currentStoryItemIndex];
        this.currentActiveStory = story; // Track for deletion
        const author = store.getUser(story.authorId);

        const deleteBtn = document.getElementById('story-delete-btn');
        if (deleteBtn) {
            if (story.authorId === store.db.currentUserId) {
                deleteBtn.classList.remove('hidden');
            } else {
                deleteBtn.classList.add('hidden');
            }
        }

        const mediaEl = document.getElementById('story-viewer-media') || document.getElementById('story-viewer-img');
        if (mediaEl) mediaEl.src = story.media;
        
        const avatarEl = document.getElementById('story-viewer-avatar');
        if (avatarEl) avatarEl.src = author.avatar;

        const nameEl = document.getElementById('story-viewer-name');
        if (nameEl) nameEl.textContent = author.name;

        const timeEl = document.getElementById('story-viewer-time');
        if (timeEl) timeEl.textContent = timeAgo(story.createdAt);

        // Render progress bars ONLY for the current user's stories
        const barsContainer = document.getElementById('story-progress-bars');
        if (barsContainer) {
            barsContainer.innerHTML = userStories.map((_, i) => `
                <div class="story-progress-bar">
                    <div class="story-progress-fill" id="story-fill-${i}" style="width: ${i < this.currentStoryItemIndex ? '100%' : '0%'}"></div>
                </div>
            `).join('');
        }

        // Animate active progress bar
        if (this.storyTimer) clearTimeout(this.storyTimer);
        const fill = document.getElementById(`story-fill-${this.currentStoryItemIndex}`);
        if (fill) {
            fill.style.transition = 'width 5s linear';
            // slight delay to allow the DOM to reset to 0% first if needed
            setTimeout(() => fill.style.width = '100%', 50);
        }

        this.storyTimer = setTimeout(() => {
            this.nextStory();
        }, 5000);
    }

    nextStory() {
        this.currentStoryItemIndex++;
        this.renderStorySlide();
    }

    prevStory() {
        this.currentStoryItemIndex--;
        this.renderStorySlide();
    }

    closeStoryViewer() {
        if (this.storyTimer) clearTimeout(this.storyTimer);
        document.getElementById('story-viewer-modal')?.classList.add('hidden');
    }

    deleteCurrentStory() {
        if (this.storyTimer) clearTimeout(this.storyTimer);
        if (this.currentActiveStory && confirm('Are you sure you want to delete this story?')) {
            // Delete story from store
            store.deleteStory(this.currentActiveStory.id);
            this.showToast('Story deleted', 'info');
            this.closeStoryViewer();
            if (this.activeView === 'home') feed.render();
        } else {
            // Resume timer if cancelled
            this.renderStorySlide();
        }
    }

    openStorySettings() {
        if (this.storyTimer) clearTimeout(this.storyTimer);
        alert('Story settings: \n- Privacy: Public\n- Allow Replies: Yes\n(Demo)');
        // Resume timer after closing alert
        this.renderStorySlide();
    }

    // ==========================================
    // REEL ACTIONS
    // ==========================================
    deleteReel(reelId) {
        if (confirm('Are you sure you want to delete this reel?')) {
            store.deleteReel(reelId);
            this.showToast('Reel deleted', 'info');
            
            // Re-render views that might contain the reel
            if (this.activeView === 'reels') {
                const currentFilterBtn = document.querySelector('.reel-filter-btn[style*="background: rgb(51, 51, 51)"]') || document.querySelector('.reel-filter-btn[style*="background: #333"]');
                const filter = currentFilterBtn ? currentFilterBtn.dataset.filter : 'trending';
                this.renderReelsView(filter);
            } else if (this.activeView === 'profile') {
                this.renderProfileView(store.db.currentUserId, 'reels');
            }
        }
    }

    // ==========================================
    // LIVE BROADCAST STUDIO (Webcam + Simulation)
    // ==========================================
    openLiveStudio() {
        const modal = document.getElementById('live-studio-modal');
        if (!modal) return;
        modal.classList.remove('hidden');

        // Try getting real camera stream, otherwise show animated canvas
        const video = document.getElementById('live-webcam-preview');
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({ video: true, audio: false })
                .then(stream => {
                    video.srcObject = stream;
                    video.play();
                })
                .catch(() => {
                    console.log("Webcam permission not granted; using simulated stream.");
                });
        }

        // Live stats simulation
        let viewers = 14;
        const countEl = document.getElementById('live-viewers-count');
        this.liveStreamInterval = setInterval(() => {
            viewers += Math.floor(Math.random() * 5) - 1;
            if (viewers < 5) viewers = 5;
            if (countEl) countEl.textContent = `${viewers} viewers`;
        }, 2000);

        // Live comments simulation
        const commentsEl = document.getElementById('live-comments-stream');
        const cannedLiveComments = [
            { user: "Jane Smith", text: "Hey John! Great stream 👏" },
            { user: "Michael Johnson", text: "Quality looks crystal clear!" },
            { user: "Sarah Connor", text: "Love the new UI changes!" },
            { user: "Alex Turing", text: "Orange and Navy combo is fire 🔥" }
        ];

        this.liveCommentsInterval = setInterval(() => {
            if (commentsEl) {
                const comment = cannedLiveComments[Math.floor(Math.random() * cannedLiveComments.length)];
                const bubble = document.createElement('div');
                bubble.className = 'live-comment-bubble';
                bubble.innerHTML = `<strong>${comment.user}:</strong> ${comment.text}`;
                commentsEl.appendChild(bubble);
                commentsEl.scrollTop = commentsEl.scrollHeight;
            }
        }, 2600);

        // Floating live reactions (hearts, fires, likes)
        const container = document.querySelector('.live-studio-container');
        this.liveReactionsInterval = setInterval(() => {
            if (container) {
                const emojis = ['❤️', '🔥', '👍', '🚀', '✨', '👏'];
                const emoji = emojis[Math.floor(Math.random() * emojis.length)];
                const floater = document.createElement('div');
                floater.style.position = 'absolute';
                floater.style.bottom = '80px';
                floater.style.right = `${20 + Math.random() * 40}px`;
                floater.style.fontSize = '26px';
                floater.style.pointerEvents = 'none';
                floater.style.zIndex = '50';
                floater.style.animation = 'floatUp 2.2s ease-out forwards';
                floater.textContent = emoji;
                container.appendChild(floater);
                setTimeout(() => floater.remove(), 2200);
            }
        }, 1200);
    }

    endLiveStudio() {
        clearInterval(this.liveStreamInterval);
        clearInterval(this.liveCommentsInterval);
        clearInterval(this.liveReactionsInterval);

        const video = document.getElementById('live-webcam-preview');
        if (video && video.srcObject) {
            video.srcObject.getTracks().forEach(t => t.stop());
        }

        document.getElementById('live-studio-modal')?.classList.add('hidden');

        // Post the recorded broadcast to feed
        store.addPost({
            id: 'p_live_' + Date.now(),
            authorId: store.db.currentUserId,
            text: "🔴 John was live: 'Mukaputa 2.0 Live Broadcast & Q&A' — Thanks everyone for tuning in!",
            media: ["https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800"],
            createdAt: new Date().toISOString(),
            reactions: { like: ["u2", "u3", "u4"], love: ["u1"] },
            comments: []
        });

        feed.render();
        this.showToast('Live stream published as video post! 🎥', 'success');
    }

    // ==========================================
    // FILE UPLOADS
    // ==========================================
    async uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await fetch('/api/upload', { method: 'POST', body: formData, credentials: 'same-origin' });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data || !data.url) {
                this.showToast((data && data.error) || 'Upload failed. Please try again.', 'danger');
                return null;
            }
            return data.url;
        } catch (e) {
            this.showToast('Upload failed. Please check your connection.', 'danger');
            return null;
        }
    }

    // ==========================================
    // MODALS & FORM BUILDERS
    // ==========================================
    bindModals() {
        // Create Post Modal Triggers
        const trigger = document.getElementById('create-post-trigger');
        const modal = document.getElementById('create-post-modal');
        const closeBtn = document.getElementById('close-post-modal');
        const submitBtn = document.getElementById('submit-post-btn');

        if (trigger && modal) {
            trigger.addEventListener('click', () => this.openCreatePostModal());
        }
        if (closeBtn && modal) {
            closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
        }

        if (submitBtn) {
            submitBtn.addEventListener('click', async () => {
                const text = document.getElementById('post-composer-text').value.trim();
                const feeling = document.getElementById('post-feeling-select').value;
                const hasImage = this._pendingPostFile != null;

                if (!text && !hasImage) {
                    this.showToast('Please add text or an image to post.', 'info');
                    return;
                }

                submitBtn.disabled = true;
                let media = [];
                if (hasImage) {
                    const url = this._pendingPostUpload ? await this._pendingPostUpload : await this.uploadFile(this._pendingPostFile);
                    if (url) media = [url];
                }
                submitBtn.disabled = false;

                feed.addNewPost(text, media, feeling);
                document.getElementById('post-composer-text').value = '';
                this.removePostImagePreview();
                modal.classList.add('hidden');
            });
        }

        // Post Image Upload -- instant local preview, real upload kicked off
        // in the background so it's ready by the time the user hits Post.
        const fileInput = document.getElementById('post-file-input');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    this._pendingPostFile = file;
                    document.getElementById('post-image-preview-src').src = URL.createObjectURL(file);
                    document.getElementById('post-image-preview-container').style.display = 'block';
                    this._pendingPostUpload = this.uploadFile(file);
                }
            });
        }

        // Close modals on backdrop click
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.classList.add('hidden');
                }
            });
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal-overlay, .story-viewer-modal, .popover-dropdown, .post-dropdown').forEach(el => {
                    el.classList.add('hidden');
                });
                this.closeStoryViewer();
                this.closePhotoViewer();
            }
        });

        // Close dropdowns on outside click
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.icon-btn') && !e.target.closest('.popover-dropdown')) {
                document.getElementById('messenger-popover')?.classList.add('hidden');
                document.getElementById('notifications-popover')?.classList.add('hidden');
            }
            if (!e.target.closest('.post-options-menu')) {
                document.querySelectorAll('.post-dropdown').forEach(d => d.classList.add('hidden'));
            }
        });
    }

    openCreatePostModal(focusTarget = null) {
        const modal = document.getElementById('create-post-modal');
        if (modal) {
            modal.classList.remove('hidden');
            if (focusTarget === 'photo') {
                setTimeout(() => document.getElementById('post-file-input')?.click(), 150);
            } else if (focusTarget === 'feeling') {
                setTimeout(() => document.getElementById('post-feeling-select')?.focus(), 150);
            } else {
                document.getElementById('post-composer-text')?.focus();
            }
        }
    }

    removePostImagePreview() {
        document.getElementById('post-image-preview-src').src = '';
        document.getElementById('post-image-preview-container').style.display = 'none';
        document.getElementById('post-file-input').value = '';
        this._pendingPostFile = null;
        this._pendingPostUpload = null;
    }

    // Story Creation Modal
    openCreateStoryModal() {
        document.getElementById('create-story-modal').classList.remove('hidden');
        document.getElementById('story-preview-container').style.display = 'none';
        document.getElementById('story-image-upload').value = '';
        this._pendingStoryFile = null;
        this._pendingStoryUpload = null;
    }

    handleStoryImagePreview(event) {
        const file = event.target.files[0];
        if (file) {
            this._pendingStoryFile = file;
            document.getElementById('story-preview-img').src = URL.createObjectURL(file);
            document.getElementById('story-preview-container').style.display = 'block';
            this._pendingStoryUpload = this.uploadFile(file);
        }
    }

    async submitCreateStory() {
        const container = document.getElementById('story-preview-container');
        if (container.style.display === 'block' && this._pendingStoryFile) {
            const submitBtn = document.querySelector('#create-story-modal .btn-primary');
            if (submitBtn) submitBtn.disabled = true;

            const url = this._pendingStoryUpload ? await this._pendingStoryUpload : await this.uploadFile(this._pendingStoryFile);

            if (submitBtn) submitBtn.disabled = false;
            if (!url) return;

            store.addStory({
                id: 's_' + Date.now(),
                authorId: store.db.currentUserId,
                media: url,
                createdAt: new Date().toISOString()
            });
            feed.render();
            document.getElementById('create-story-modal').classList.add('hidden');
            this._pendingStoryFile = null;
            this._pendingStoryUpload = null;
            this.showToast('Story added to your tray! 🚀', 'success');
        } else {
            this.showToast('Please select a photo or video first.', 'danger');
        }
    }

    // Reel Upload Modal
    openCreateReelModal() {
        this.resetCreateReelModal();
        document.getElementById('create-reel-modal').classList.remove('hidden');
    }

    resetCreateReelModal() {
        document.getElementById('reel-video-upload').value = '';
        document.getElementById('reel-caption-input').value = '';
        document.getElementById('reel-preview-container').style.display = 'none';
        document.getElementById('reel-upload-prompt').style.display = 'block';
        document.getElementById('reel-preview-video').src = '';
        this._pendingReelFile = null;
        this._pendingReelUpload = null;
    }

    handleReelVideoPreview(event) {
        const file = event.target.files[0];
        if (!file) return;
        if (!file.type.startsWith('video/')) {
            this.showToast('Please select a video file.', 'danger');
            return;
        }

        this._pendingReelFile = file;
        document.getElementById('reel-preview-video').src = URL.createObjectURL(file);
        document.getElementById('reel-upload-prompt').style.display = 'none';
        document.getElementById('reel-preview-container').style.display = 'block';
        this._pendingReelUpload = this.uploadFile(file);
    }

    async submitCreateReel() {
        if (!this._pendingReelFile) {
            this.showToast('Please select a video first.', 'danger');
            return;
        }

        const submitBtn = document.getElementById('reel-submit-btn');
        const caption = document.getElementById('reel-caption-input').value.trim();

        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Uploading…'; }
        const url = this._pendingReelUpload ? await this._pendingReelUpload : await this.uploadFile(this._pendingReelFile);
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Post Reel'; }

        if (!url) return;

        store.addReel({
            id: 'r_' + Date.now(),
            authorId: store.db.currentUserId,
            media: url,
            caption: caption,
            createdAt: new Date().toISOString(),
            reactions: { like: [] },
            comments: []
        });

        document.getElementById('create-reel-modal').classList.add('hidden');
        this.resetCreateReelModal();
        this.showToast('Reel posted! 🎬', 'success');
        if (this.activeView === 'reels') this.renderReelsView();
    }

    // Post Job Modal
    openPostJobModal() {
        const title = prompt("Job Title (e.g. Senior Frontend Engineer):");
        if (!title) return;
        const company = prompt("Company Name:", "My Company");
        if (!company) return;
        const salary = prompt("Salary Range (e.g. $80,000 – $120,000/yr):", "$80,000 – $120,000/yr");
        const category = prompt("Category (Engineering / Design / AI-ML / DevOps / Marketing / Sales):", "Engineering");
        const remote = prompt("Work Type (Remote / Hybrid / On-site):", "Hybrid");
        const location = prompt("Location (e.g. San Francisco, CA):", "Remote");
        const description = prompt("Brief job description:", "We are looking for a talented professional to join our growing team.");

        store.addJobVacancy({
            id: 'j_' + Date.now(),
            postedBy: store.db.currentUserId,
            company: company,
            logo: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=200&auto=format&fit=crop&q=80",
            title: title,
            type: "Full-Time",
            location: location || "Remote",
            remote: remote || "Hybrid",
            salary: salary || "Competitive",
            category: category || "Engineering",
            description: description || "Join our team and make an impact.",
            requirements: ["Relevant experience", "Strong communication skills"],
            benefits: ["Competitive salary", "Health insurance", "Flexible hours"],
            applicants: 0,
            appliedBy: [],
            postedAt: new Date().toISOString(),
            saved: false
        });

        this.renderJobsView();
        this.showToast(`💼 Job posted: ${title} at ${company}!`, 'success');
    }

    // Create Group Modal
    openCreateGroupModal() {
        const modal = document.getElementById('create-group-modal');
        if (modal) {
            document.getElementById('create-group-name').value = '';
            document.getElementById('create-group-desc').value = '';
            modal.classList.remove('hidden');
        }
    }

    submitCreateGroup() {
        const name = document.getElementById('create-group-name').value.trim();
        const desc = document.getElementById('create-group-desc').value.trim();
        const privacy = document.getElementById('create-group-privacy').value;

        if (!name) {
            this.showToast('Please enter a group name', 'danger');
            return;
        }

        store.addGroup({
            id: 'g_' + Date.now(),
            name: name,
            description: desc || "A community for creative thinkers.",
            cover: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800",
            private: privacy === 'private',
            memberIds: [store.db.currentUserId]
        });

        document.getElementById('create-group-modal').classList.add('hidden');
        this.renderGroupsView();
        this.showToast(`Group "${name}" created successfully!`, 'success');
    }

    // Create Event Modal
    openCreateEventModal() {
        const title = prompt("Event title:");
        if (!title) return;
        const location = prompt("Location:", "San Francisco");

        store.addEvent({
            id: 'e_' + Date.now(),
            title: title,
            hostId: store.db.currentUserId,
            datetime: new Date(Date.now() + 86400000 * 3).toISOString(),
            location: location || "Online",
            cover: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800",
            description: "Join us for this exciting event!",
            rsvps: { going: [store.db.currentUserId], interested: [], invited: [] }
        });

        this.renderEventsView();
        this.showToast(`Event "${title}" published! 📅`, 'success');
    }

    // Create Page Modal
    openCreatePageModal() {
        const name = prompt("Page name:");
        if (!name) return;
        const category = prompt("Page category (Business, Brand, Creator):", "Creator");

        store.addPage({
            id: 'pg_' + Date.now(),
            name: name,
            category: category || "General",
            cover: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800",
            description: "Official page on Mukaputa.",
            followerIds: [store.db.currentUserId]
        });

        this.renderPagesView();
        this.showToast(`Page "${name}" created! ⭐`, 'success');
    }

    // Settings Modals
    openPasswordModal() {
        document.getElementById('current-password-input').value = '';
        document.getElementById('new-password-input').value = '';
        document.getElementById('confirm-password-input').value = '';
        document.getElementById('password-modal').classList.remove('hidden');
    }

    async submitPasswordChange() {
        const currentPassword = document.getElementById('current-password-input').value;
        const newPassword = document.getElementById('new-password-input').value;
        const confirmPassword = document.getElementById('confirm-password-input').value;

        if (!currentPassword || !newPassword) {
            this.showToast('Please fill in all password fields.', 'danger');
            return;
        }
        if (newPassword.length < 6) {
            this.showToast('New password must be at least 6 characters.', 'danger');
            return;
        }
        if (newPassword !== confirmPassword) {
            this.showToast('New passwords do not match.', 'danger');
            return;
        }

        const { ok, data } = await store._api('PUT', '/api/auth/password', { currentPassword, newPassword });
        if (ok) {
            this.showToast('Password updated securely!', 'success');
            document.getElementById('password-modal').classList.add('hidden');
        } else {
            this.showToast((data && data.error) || 'Could not update password.', 'danger');
        }
    }
    
    // Privacy Settings
    openPrivacyModal() {
        const user = store.getCurrentUser();
        // Set defaults if not exist
        if (!user.privacySettings) {
            user.privacySettings = { posts: 'public', requests: 'everyone' };
        }
        document.getElementById('privacy-posts').value = user.privacySettings.posts;
        document.getElementById('privacy-requests').value = user.privacySettings.requests;
        document.getElementById('privacy-settings-modal').classList.remove('hidden');
    }

    savePrivacySettings() {
        const posts = document.getElementById('privacy-posts').value;
        const requests = document.getElementById('privacy-requests').value;
        store.updateProfile({ privacySettings: { posts, requests } });
        document.getElementById('privacy-settings-modal').classList.add('hidden');
        this.showToast('Privacy settings updated! 🔒', 'success');
    }

    // Blocked Accounts
    openBlockedModal() {
        const user = store.getCurrentUser();
        const container = document.getElementById('blocked-accounts-list');

        if (!user.blockedUsers) user.blockedUsers = [];

        if (user.blockedUsers.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: var(--text-secondary); padding: 20px;">You haven\'t blocked anyone.</div>';
        } else {
            container.innerHTML = user.blockedUsers.map(b => `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; border-bottom: 1px solid var(--border-color);">
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <img src="${b.avatar}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">
                        <div style="font-weight: 600;">${b.name}</div>
                    </div>
                    <button class="btn btn-secondary btn-sm" onclick="app.unblockUser('${b.id}')">Unblock</button>
                </div>
            `).join('');
        }
        document.getElementById('blocked-accounts-modal').classList.remove('hidden');
    }

    unblockUser(id) {
        const user = store.getCurrentUser();
        user.blockedUsers = user.blockedUsers.filter(b => b.id !== id);
        store.updateProfile({ blockedUsers: user.blockedUsers });
        this.showToast('User unblocked.', 'info');
        this.openBlockedModal(); // Refresh list
    }

    // Data Portability
    downloadMyData() {
        const user = store.getCurrentUser();
        const data = {
            profile: user,
            posts: store.getPosts().filter(p => p.authorId === user.id),
            timestamp: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mukaputa_data_${user.username}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        this.showToast('Your data download has started! 📁', 'success');
    }

    // Delete Account
    openDeleteAccountModal() {
        document.getElementById('delete-account-modal').classList.remove('hidden');
    }

    async confirmDeactivateAccount() {
        if (confirm("Are you sure you want to deactivate your account? You can reactivate it simply by logging in again.")) {
            const { ok, data } = await store._api('POST', '/api/auth/deactivate');
            document.getElementById('delete-account-modal').classList.add('hidden');
            if (ok) {
                this.showToast('Account deactivated. Redirecting...', 'info');
                setTimeout(() => { window.location.href = 'login.html'; }, 1500);
            } else {
                this.showToast((data && data.error) || 'Could not deactivate account.', 'danger');
            }
        }
    }

    async confirmDeleteAccount() {
        if (confirm("Are you absolutely sure? This CANNOT be undone.")) {
            const { ok, data } = await store._api('DELETE', '/api/auth/account');
            document.getElementById('delete-account-modal').classList.add('hidden');
            if (ok) {
                this.showToast('Account deleted. Redirecting...', 'danger');
                setTimeout(() => { window.location.href = 'login.html'; }, 1500);
            } else {
                this.showToast((data && data.error) || 'Could not delete account.', 'danger');
            }
        }
    }
    openNotificationSettingsModal() {
        document.getElementById('notification-settings-modal').classList.remove('hidden');
    }
    openHelpModal() {
        document.getElementById('help-modal').classList.remove('hidden');
    }
    openTermsModal() {
        document.getElementById('terms-modal').classList.remove('hidden');
    }

    // Edit Profile Modal
    openEditProfileModal() {
        const user = store.getCurrentUser();
        this._tempEditAvatar = null;
        this._tempEditCover = null;
        document.getElementById('edit-profile-avatar').value = '';
        document.getElementById('edit-profile-cover').value = '';
        document.getElementById('edit-profile-name').value = user.name || "";
        document.getElementById('edit-profile-username').value = user.username || "";
        document.getElementById('edit-profile-bio').value = user.bio || "";
        document.getElementById('edit-profile-work').value = user.work || "";
        document.getElementById('edit-profile-location').value = user.location || "";
        document.getElementById('edit-profile-modal').classList.remove('hidden');
    }

    async submitEditProfile() {
        const name = document.getElementById('edit-profile-name').value.trim();
        const username = document.getElementById('edit-profile-username').value.trim();
        const bio = document.getElementById('edit-profile-bio').value.trim();
        const work = document.getElementById('edit-profile-work').value.trim();
        const location = document.getElementById('edit-profile-location').value.trim();

        if (!name) {
            this.showToast('Name cannot be empty.', 'danger');
            return;
        }

        const updates = { name, username, bio, work, location };
        if (this._tempEditAvatar) {
            updates.avatar = this._tempEditAvatar;
            this._tempEditAvatar = null;
        }
        if (this._tempEditCover) {
            updates.cover = this._tempEditCover;
            this._tempEditCover = null;
        }

        const btn = document.getElementById('edit-profile-modal').querySelector('.btn-primary');
        if (btn) btn.disabled = true;
        
        const res = await store.updateProfile(updates);
        
        if (btn) btn.disabled = false;
        
        if (res && res.ok === false) {
            this.showToast(res.error || 'Failed to update profile', 'danger');
            return;
        }

        this.updateHeaderUserInfo();
        this.renderProfileView(store.db.currentUserId);
        document.getElementById('edit-profile-modal').classList.add('hidden');
        this.showToast('Profile updated successfully! ✨', 'success');
    }

    async handleProfileImageUpdate(event, type) {
        const file = event.target.files[0];
        if (!file) return;

        this.showToast(type === 'avatar' ? 'Uploading profile photo…' : 'Uploading cover photo…', 'info');
        const url = await this.uploadFile(file);
        if (!url) return;

        if (type === 'avatar') {
            this._tempEditAvatar = url;
            this.showToast('Profile photo staged for saving', 'info');
        } else {
            this._tempEditCover = url;
            this.showToast('Cover photo staged for saving', 'info');
        }
    }

    triggerAvatarUpload() {
        this.openEditProfileModal();
    }

    triggerCoverUpload() {
        this.openEditProfileModal();
    }

    // Update Header Avatar & Display
    updateHeaderUserInfo() {
        const currentUser = store.getCurrentUser();
        document.querySelectorAll('.current-user-avatar').forEach(img => img.src = currentUser.avatar);
        document.querySelectorAll('.current-user-name').forEach(el => el.textContent = currentUser.name);
    }

    // ==========================================
    // AUTHENTICATION & LOGOUT
    // ==========================================
    async logout() {
        this.showToast('Logging out...', 'info');
        try {
            localStorage.removeItem('mukaputa_active_view');
        } catch(e) {}
        await store.logout();
        window.location.href = 'login.html';
    }

    // ==========================================
    // TOAST NOTIFICATIONS
    // ==========================================
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        let icon = '🔔';
        if (type === 'success') icon = '✓';
        if (type === 'danger') icon = '✕';
        if (type === 'info') icon = '✨';

        toast.innerHTML = `
            <span class="toast-icon">${icon}</span>
            <span class="toast-message">${message}</span>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3200);
    }
}

const app = new App();
// app.init() is now triggered from boot.js once the backend session/data
// has been loaded into the store (see js/boot.js).

window.addEventListener("resize", () => {
    if (window.innerWidth <= 767) {
        const slider = document.getElementById("mobile-tab-slider");
        const activeTab = document.querySelector(".bottom-tab-bar .tab-btn.active");
        if (slider && activeTab && activeTab.offsetWidth > 0) {
            const nav = activeTab.closest("nav");
            const navRect = nav.getBoundingClientRect();
            const tabRect = activeTab.getBoundingClientRect();
            slider.style.width = `${tabRect.width}px`;
            slider.style.transform = `translateX(${tabRect.left - navRect.left}px)`;
        }
    }
});




