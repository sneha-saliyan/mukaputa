class Feed {
    constructor() {
        this.container = document.getElementById('feed-posts');
        this.storiesContainer = document.getElementById('stories-tray');
        this.contactsContainer = document.getElementById('contacts-list');
        this.bindEvents();
    }

    render() {
        // Render stories grouped by user
        if (this.storiesContainer) {
            const currentUser = store.getCurrentUser();
            const stories = store.getStories();
            
            // Group by user
            const grouped = {};
            const userOrder = [];
            stories.forEach(s => {
                if (!grouped[s.authorId]) {
                    grouped[s.authorId] = [];
                    userOrder.push(s.authorId);
                }
                grouped[s.authorId].push(s);
            });

            // Handle current user's stories separately to avoid duplicates
            const myStories = grouped[currentUser.id] || [];
            
            // Filter to ONLY friends
            const friends = store.getFriends(currentUser.id);
            const friendIds = new Set(friends.map(f => f.id));
            
            const otherUsersOrder = userOrder.filter(id => id !== currentUser.id && friendIds.has(id));
            const otherStoriesHtml = otherUsersOrder.map(userId => renderStoryGroup(grouped[userId], userId)).join('');
            
            let myStoryCard = '';
            if (myStories.length > 0) {
                // User has stories -> Card plays story, small + adds new
                const firstStory = myStories[0];
                myStoryCard = `
                    <div class="story-card story-item" style="background-image: url('${firstStory.media}'); cursor: pointer;" onclick="app.openStoryViewer('${currentUser.id}')">
                        <div class="story-avatar-container">
                            <div class="avatar-story-ring">
                                <img src="${currentUser.avatar}" class="avatar-small" alt="You">
                            </div>
                        </div>
                        <span class="story-name">Your Story</span>
                        
                        <!-- Mini add button to append to story -->
                        <div onclick="event.stopPropagation(); app.openCreateStoryModal();" style="position: absolute; bottom: 32px; right: 8px; width: 28px; height: 28px; background: var(--accent); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: bold; border: 2px solid var(--bg-card); box-shadow: 0 2px 5px rgba(0,0,0,0.2); z-index: 10;" title="Add to your story">
                            +
                        </div>
                    </div>
                `;
            } else {
                // Standard create story card
                myStoryCard = `
                    <div class="story-card create-story-card" onclick="app.openCreateStoryModal()">
                        <img src="${currentUser.avatar}" alt="User" class="story-img">
                        <div class="create-story-footer">
                            <div class="add-story-btn">+</div>
                            <span class="story-name">Create Story</span>
                        </div>
                    </div>
                `;
            }

            this.storiesContainer.innerHTML = myStoryCard + otherStoriesHtml;
        }

        // Render feed posts with Memories ("On this day") card
        if (this.container) {
            const posts = store.getPosts();
            const memoryPost = posts.find(p => p.id === 'p_memory');
            const regularPosts = posts.filter(p => p.id !== 'p_memory');

            let memoryCardHtml = '';
            if (memoryPost) {
                const author = store.getUser(memoryPost.authorId);
                memoryCardHtml = `
                    <div class="card" style="background: linear-gradient(135deg, rgba(255,122,41,0.12) 0%, rgba(30,41,59,0.5) 100%); border-left: 4px solid var(--accent); margin-bottom: 16px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="font-size: 20px;">✨</span>
                                <strong style="font-size: 15px; font-family: var(--font-heading); color: var(--accent);">On This Day — Memories</strong>
                            </div>
                            <span class="text-secondary" style="font-size: 12px;">2 years ago</span>
                        </div>
                        <p style="font-size: 14px; margin-bottom: 10px;">We thought you'd like to look back on this memory:</p>
                        ${renderPost(memoryPost)}
                    </div>
                `;
            }

            this.container.innerHTML = memoryCardHtml + regularPosts.map(p => renderPost(p)).join('');
        }

        // Render contacts list
        if (this.contactsContainer) {
            const contacts = store.db.users.filter(u => u.id !== store.db.currentUserId);
            this.contactsContainer.innerHTML = contacts.map(c => renderContact(c)).join('');
        }
    }

    bindEvents() {
        if (this.storiesContainer) {
            let isDown = false;
            let startX;
            let scrollLeft;

            this.storiesContainer.addEventListener('mousedown', (e) => {
                isDown = true;
                this.storiesContainer.style.cursor = 'grabbing';
                startX = e.pageX - this.storiesContainer.offsetLeft;
                scrollLeft = this.storiesContainer.scrollLeft;
            });
            this.storiesContainer.addEventListener('mouseleave', () => {
                isDown = false;
                this.storiesContainer.style.cursor = 'pointer';
            });
            this.storiesContainer.addEventListener('mouseup', () => {
                isDown = false;
                this.storiesContainer.style.cursor = 'pointer';
            });
            this.storiesContainer.addEventListener('mousemove', (e) => {
                if (!isDown) return;
                e.preventDefault();
                const x = e.pageX - this.storiesContainer.offsetLeft;
                const walk = (x - startX) * 2; // Scroll speed
                this.storiesContainer.scrollLeft = scrollLeft - walk;
            });
        }

        if (!this.container) return;

        // Hover over like button to show reaction picker
        this.container.addEventListener('mouseenter', (e) => {
            const reactAction = e.target.closest('[data-action="react"]');
            if (reactAction) {
                const picker = reactAction.querySelector('.reaction-picker');
                if (picker) picker.classList.remove('hidden');
            }
        }, true);

        this.container.addEventListener('mouseleave', (e) => {
            const reactAction = e.target.closest('[data-action="react"]');
            if (reactAction) {
                const picker = reactAction.querySelector('.reaction-picker');
                if (picker) picker.classList.add('hidden');
            }
        }, true);

        // Click delegation for reactions
        let touchTimer = null;
        this.container.addEventListener('touchstart', (e) => {
            const reactAction = e.target.closest('[data-action="react"]');
            if (reactAction) {
                touchTimer = setTimeout(() => {
                    const picker = reactAction.querySelector('.reaction-picker');
                    if (picker) picker.classList.remove('hidden');
                }, 350);
            }
        }, { passive: true });

        this.container.addEventListener('touchend', () => {
            if (touchTimer) clearTimeout(touchTimer);
        });

        this.container.addEventListener('click', (e) => {
            // Reaction icon in picker
            const reactionIcon = e.target.closest('.reaction-icon');
            if (reactionIcon) {
                e.stopPropagation();
                const type = reactionIcon.dataset.type;
                const postAction = reactionIcon.closest('.post-action');
                const postId = postAction.dataset.postId;
                
                const rect = reactionIcon.getBoundingClientRect();
                this.spawnReactionFloater(getReactionEmoji(type), rect.left + 6, rect.top - 10);
                
                store.toggleReaction(postId, type, store.db.currentUserId);
                this.render();
                app.showToast(`Reacted with ${getReactionEmoji(type)}!`, 'success');
                return;
            }

            // Double-click/tap on post image to like
            const mediaContainer = e.target.closest('.post-media-container');
            if (mediaContainer && e.detail === 2) {
                const postEl = mediaContainer.closest('.post');
                if (postEl) {
                    const postId = postEl.id.replace('post-', '');
                    const rect = mediaContainer.getBoundingClientRect();
                    this.spawnReactionFloater('❤️', rect.left + rect.width / 2 - 16, rect.top + rect.height / 2 - 16);
                    store.toggleReaction(postId, 'love', store.db.currentUserId);
                    this.render();
                    app.showToast('Loved post ❤️', 'success');
                }
            }

            // Direct Like button click
            const postAction = e.target.closest('.post-action[data-action="react"]');
            if (postAction && !e.target.closest('.reaction-picker')) {
                const postId = postAction.dataset.postId;
                const post = store.getPost(postId);
                let currentReaction = null;
                if (post && post.reactions) {
                    for (const [type, users] of Object.entries(post.reactions)) {
                        if (users && users.includes(store.db.currentUserId)) {
                            currentReaction = type;
                            break;
                        }
                    }
                }

                const rect = postAction.getBoundingClientRect();
                if (!currentReaction) {
                    this.spawnReactionFloater('👍', rect.left + 20, rect.top - 10);
                }

                store.toggleReaction(postId, currentReaction ? null : 'like', store.db.currentUserId);
                this.render();
                if (!currentReaction) app.showToast('Liked post 👍', 'success');
            }
        });

        // Comment input enter key
        this.container.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey && e.target.classList.contains('comment-input-field')) {
                e.preventDefault();
                const text = e.target.value.trim();
                const postId = e.target.dataset.postId;
                if (text && postId) {
                    store.addComment(postId, {
                        id: 'c_' + Date.now(),
                        authorId: store.db.currentUserId,
                        text: text,
                        createdAt: new Date().toISOString(),
                        reactions: {},
                        replies: []
                    });
                    e.target.value = '';
                    this.render();
                    app.showToast('Comment posted! 💬', 'success');
                }
            }
        });
    }

    spawnReactionFloater(emoji, x, y) {
        const floater = document.createElement('div');
        floater.textContent = emoji;
        floater.style.position = 'fixed';
        floater.style.left = `${x}px`;
        floater.style.top = `${y}px`;
        floater.style.fontSize = '32px';
        floater.style.pointerEvents = 'none';
        floater.style.zIndex = '9999';
        floater.style.animation = 'floatUp 0.85s cubic-bezier(0.2, 0.8, 0.2, 1) forwards';
        document.body.appendChild(floater);
        setTimeout(() => floater.remove(), 850);
    }

    addNewPost(text, media = [], feeling = '') {
        if (!text && media.length === 0) return;
        const newPost = {
            id: 'p_' + Date.now(),
            authorId: store.db.currentUserId,
            text: text,
            media: media,
            feeling: feeling,
            createdAt: new Date().toISOString(),
            reactions: { like: [], love: [], haha: [], wow: [], sad: [], angry: [] },
            comments: []
        };
        store.addPost(newPost);
        this.render();
        app.showToast('Post published to your feed! 🚀', 'success');
    }
}

const feed = new Feed();
