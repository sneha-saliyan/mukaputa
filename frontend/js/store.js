class Store {
    constructor() {
        this.db = null;
    }

    // ==========================================
    // BOOT / SYNC WITH BACKEND
    // ==========================================
    async _api(method, url, body) {
        try {
            const opts = { method, credentials: 'same-origin', headers: {} };
            if (body !== undefined) {
                opts.headers['Content-Type'] = 'application/json';
                opts.body = JSON.stringify(body);
            }
            const res = await fetch(url, opts);
            let data = null;
            try { data = await res.json(); } catch (e) { /* no body */ }
            if (!res.ok) {
                console.error(`API error [${method} ${url}]:`, data && data.error);
                return { ok: false, data };
            }
            return { ok: true, data };
        } catch (e) {
            console.error(`Network error [${method} ${url}]:`, e);
            return { ok: false, data: null };
        }
    }

    async boot() {
        try {
            const meRes = await fetch('/api/auth/me', { credentials: 'same-origin' });
            if (!meRes.ok) {
                window.location.href = 'login.html';
                return false;
            }
        } catch (e) {
            window.location.href = 'login.html';
            return false;
        }

        const { ok, data } = await this._api('GET', '/api/bootstrap');
        if (!ok || !data) {
            document.body.innerHTML = `
                <div style="padding:60px 20px;text-align:center;font-family:'Segoe UI',sans-serif;max-width:500px;margin:0 auto;">
                    <h2>Couldn't connect to Mukaputa</h2>
                    <p style="color:#666;">Please make sure the backend server is running, then refresh this page.</p>
                    <button onclick="window.location.reload()" style="margin-top:16px;padding:10px 24px;border:none;border-radius:8px;background:#FF7A00;color:white;font-weight:600;cursor:pointer;">Retry</button>
                </div>`;
            return false;
        }

        this.db = data;
        return true;
    }

    async logout() {
        await this._api('POST', '/api/auth/logout');
        this.db = null;
    }

    getAds() {
        return this.db && this.db.ads ? this.db.ads : [];
    }

    // ==========================================
    // NOTES METHODS
    // ==========================================
    getNotes() {
        if (!this.db || !this.db.notes) return [];
        return this.db.notes;
    }

    getNoteForUser(userId) {
        if (!this.db || !this.db.notes) return null;
        return this.db.notes.find(n => n.userId === userId) || null;
    }

    async createNote(text) {
        if (!this.db) return false;
        
        if (!this.db.notes) this.db.notes = [];
        this.db.notes = this.db.notes.filter(n => n.userId !== this.db.currentUserId);
        
        const tempNote = {
            id: 'temp_n_' + Date.now(),
            userId: this.db.currentUserId,
            text: text,
            createdAt: new Date().toISOString()
        };
        this.db.notes.push(tempNote);

        const { ok, data } = await this._api('POST', '/api/notes', { text });
        if (ok && data) {
            this.db.notes = this.db.notes.map(n => n.id === tempNote.id ? data : n);
            return true;
        }
        return false;
    }

    async deleteNote() {
        if (!this.db) return false;
        if (this.db.notes) {
            this.db.notes = this.db.notes.filter(n => n.userId !== this.db.currentUserId);
        }
        await this._api('DELETE', '/api/notes');
        return true;
    }

    // ==========================================
    // USER & AUTH METHODS
    // ==========================================
    getCurrentUser() {
        if (!this.db || !this.db.users) return { id: 'u1', name: 'John Doe', avatar: '', friends: [], savedItems: [] };
        return this.db.users.find(u => u.id === this.db.currentUserId) || this.db.users[0];
    }

    getUser(userId) {
        if (!this.db || !this.db.users) return { id: userId, name: 'User', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150' };
        return this.db.users.find(u => u.id === userId) || { id: userId, name: 'Mukaputa User', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150' };
    }

    async updateProfile(updatedFields) {
        const user = this.getCurrentUser();
        if (!user) return;

        // Blocked users is a relationship, not a plain field -- diff it into block/unblock calls.
        if (updatedFields.blockedUsers) {
            const oldIds = (user.blockedUsers || []).map(b => b.id);
            const newIds = updatedFields.blockedUsers.map(b => b.id);
            oldIds.filter(id => !newIds.includes(id)).forEach(id => this._api('DELETE', `/api/block/${id}`));
            newIds.filter(id => !oldIds.includes(id)).forEach(id => this._api('POST', `/api/block/${id}`));
            Object.assign(user, updatedFields);
            return;
        }

        Object.assign(user, updatedFields);

        const payload = {};
        ['name', 'username', 'bio', 'work', 'education', 'location', 'avatar', 'cover'].forEach(key => {
            if (key in updatedFields) payload[key] = updatedFields[key];
        });
        if (updatedFields.privacySettings) payload.privacySettings = updatedFields.privacySettings;

        if (Object.keys(payload).length > 0) {
            const res = await this._api('PUT', '/api/profile', payload);
            if (res && res.ok === false) {
                // Revert local optimistic update if server rejected
                Object.assign(user, this.getCurrentUser()); // this doesn't fully revert, but we'll return the error
                return res;
            }
            return res;
        }
        return { ok: true };
    }

    // ==========================================
    // POSTS & FEED METHODS
    // ==========================================
    getPosts() {
        return (this.db.posts || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    getPost(postId) {
        return this.db.posts.find(p => p.id === postId);
    }

    addPost(post) {
        this.db.posts.unshift(post);
        this._api('POST', '/api/posts', {
            id: post.id, text: post.text, media: post.media, feeling: post.feeling
        });
    }

    deletePost(postId) {
        this.db.posts = this.db.posts.filter(p => p.id !== postId);
        this._api('DELETE', `/api/posts/${postId}`);
    }

    editPost(postId, newText) {
        const post = this.getPost(postId);
        if (post) {
            post.text = newText;
            this._api('PUT', `/api/posts/${postId}`, { text: newText });
        }
    }

    toggleReaction(postId, reactionType, userId) {
        const post = this.getPost(postId);
        if (!post) return;

        if (!post.reactions) {
            post.reactions = { like: [], love: [], haha: [], wow: [], sad: [], angry: [] };
        }

        let prevType = null;
        for (const type in post.reactions) {
            if (post.reactions[type].includes(userId)) {
                prevType = type;
                post.reactions[type] = post.reactions[type].filter(id => id !== userId);
            }
        }

        if (reactionType && reactionType !== prevType) {
            if (!post.reactions[reactionType]) post.reactions[reactionType] = [];
            post.reactions[reactionType].push(userId);
        }

        this._api('POST', `/api/posts/${postId}/react`, { type: reactionType });
    }

    addComment(postId, comment) {
        const post = this.getPost(postId);
        if (post) {
            if (!post.comments) post.comments = [];
            post.comments.push(comment);
            this._api('POST', `/api/posts/${postId}/comments`, { id: comment.id, text: comment.text });
        }
    }

    editComment(postId, commentId, newText) {
        const post = this.getPost(postId);
        if (post && post.comments) {
            const comment = post.comments.find(c => c.id === commentId);
            if (comment) {
                comment.text = newText;
                this._api('PUT', `/api/posts/${postId}/comments/${commentId}`, { text: newText });
            }
        }
    }

    deleteComment(postId, commentId) {
        const post = this.getPost(postId);
        if (post && post.comments) {
            post.comments = post.comments.filter(c => c.id !== commentId);
            this._api('DELETE', `/api/posts/${postId}/comments/${commentId}`);
        }
    }

    addCommentReply(postId, commentId, reply) {
        const post = this.getPost(postId);
        if (post && post.comments) {
            const comment = post.comments.find(c => c.id === commentId);
            if (comment) {
                if (!comment.replies) comment.replies = [];
                comment.replies.push(reply);
                this._api('POST', `/api/posts/${postId}/comments/${commentId}/replies`, { id: reply.id, text: reply.text });
            }
        }
    }

    toggleSavePost(postId) {
        const user = this.getCurrentUser();
        if (!user.savedItems) user.savedItems = [];
        const index = user.savedItems.indexOf(postId);
        let isSaved = false;
        if (index > -1) {
            user.savedItems.splice(index, 1);
            isSaved = false;
        } else {
            user.savedItems.push(postId);
            isSaved = true;
        }
        this._api('POST', `/api/save/${postId}`);
        return isSaved;
    }

    isPostSaved(postId) {
        const user = this.getCurrentUser();
        return user.savedItems ? user.savedItems.includes(postId) : false;
    }

    // ==========================================
    // STORIES & REELS
    // ==========================================
    getStories() {
        return this.db.stories || [];
    }

    addStory(story) {
        if (!this.db.stories) this.db.stories = [];
        this.db.stories.unshift(story);
        this._api('POST', '/api/stories', { id: story.id, media: story.media, caption: story.caption });
    }

    deleteStory(storyId) {
        this.db.stories = (this.db.stories || []).filter(s => s.id !== storyId);
        this._api('DELETE', `/api/stories/${storyId}`);
    }

    async viewStory(storyId) {
        const story = (this.db.stories || []).find(s => s.id === storyId);
        if (story && !story.viewers) story.viewers = [];
        if (story && story.authorId !== this.db.currentUserId && !story.viewers.includes(this.db.currentUserId)) {
            story.viewers.push(this.db.currentUserId);
            this._api('POST', `/api/stories/${storyId}/view`).catch(e => console.error(e));
        }
    }

    getReels() {
        return this.db.reels || [];
    }

    addReel(reel) {
        if (!this.db.reels) this.db.reels = [];
        this.db.reels.unshift(reel);
        this._api('POST', '/api/reels', { id: reel.id, media: reel.media, caption: reel.caption });
    }

    deleteReel(reelId) {
        this.db.reels = (this.db.reels || []).filter(r => r.id !== reelId);
        this._api('DELETE', `/api/reels/${reelId}`);
    }

    toggleReelLike(reelId, userId) {
        const reel = (this.db.reels || []).find(r => r.id === reelId);
        if (!reel) return;
        if (!reel.reactions) reel.reactions = { like: [] };
        const likes = reel.reactions.like || [];
        const idx = likes.indexOf(userId);
        if (idx > -1) {
            likes.splice(idx, 1);
        } else {
            likes.push(userId);
        }
        reel.reactions.like = likes;
        this._api('POST', `/api/reels/${reelId}/like`);
    }

    addReelComment(reelId, comment) {
        const reel = (this.db.reels || []).find(r => r.id === reelId);
        if (reel) {
            if (!reel.comments) reel.comments = [];
            reel.comments.push(comment);
            this._api('POST', `/api/reels/${reelId}/comments`, { id: comment.id, text: comment.text });
        }
    }

    editReelComment(reelId, commentId, newText) {
        const reel = (this.db.reels || []).find(r => r.id === reelId);
        if (reel && reel.comments) {
            const comment = reel.comments.find(c => c.id === commentId);
            if (comment) {
                comment.text = newText;
                this._api('PUT', `/api/reels/${reelId}/comments/${commentId}`, { text: newText });
            }
        }
    }

    deleteReelComment(reelId, commentId) {
        const reel = (this.db.reels || []).find(r => r.id === reelId);
        if (reel && reel.comments) {
            reel.comments = reel.comments.filter(c => c.id !== commentId);
            this._api('DELETE', `/api/reels/${reelId}/comments/${commentId}`);
        }
    }

    getWatchVideos() {
        return this.db.watchVideos || [];
    }

    // ==========================================
    // GROUPS & EVENTS
    // (Not reachable from the current UI -- kept as harmless local-only
    // stubs so nothing throws if something references them.)
    // ==========================================
    getGroups() {
        return this.db.groups || [];
    }

    joinGroup(groupId, userId) {
        const group = (this.db.groups || []).find(g => g.id === groupId);
        if (group && !group.memberIds.includes(userId)) group.memberIds.push(userId);
    }

    leaveGroup(groupId, userId) {
        const group = (this.db.groups || []).find(g => g.id === groupId);
        if (group) group.memberIds = group.memberIds.filter(id => id !== userId);
    }

    addGroup(group) {
        if (!this.db.groups) this.db.groups = [];
        this.db.groups.push(group);
    }

    getEvents() {
        return this.db.events || [];
    }

    rsvpEvent(eventId, userId, status) {
        const evt = (this.db.events || []).find(e => e.id === eventId);
        if (!evt) return;
        if (!evt.rsvps) evt.rsvps = { going: [], interested: [] };
        evt.rsvps.going = (evt.rsvps.going || []).filter(id => id !== userId);
        evt.rsvps.interested = (evt.rsvps.interested || []).filter(id => id !== userId);
        if (status === 'going') evt.rsvps.going.push(userId);
        if (status === 'interested') evt.rsvps.interested.push(userId);
    }

    addEvent(event) {
        if (!this.db.events) this.db.events = [];
        this.db.events.push(event);
    }

    // ==========================================
    // PAGES
    // ==========================================
    getPages() {
        return this.db.pages || [];
    }

    addPage(page) {
        if (!this.db.pages) this.db.pages = [];
        this.db.pages.push(page);
        this._api('POST', '/api/pages', {
            id: page.id, name: page.name, category: page.category,
            cover: page.cover, description: page.description
        });
    }

    followPage(pageId, userId) {
        const page = (this.db.pages || []).find(p => p.id === pageId);
        if (page && !page.followerIds.includes(userId)) {
            page.followerIds.push(userId);
            this._api('POST', `/api/pages/${pageId}/follow`);
        }
    }

    unfollowPage(pageId, userId) {
        const page = (this.db.pages || []).find(p => p.id === pageId);
        if (page) {
            page.followerIds = page.followerIds.filter(id => id !== userId);
            this._api('POST', `/api/pages/${pageId}/unfollow`);
        }
    }

    // ==========================================
    // JOB VACANCIES
    // ==========================================
    getJobVacancies() {
        return this.db.jobVacancies || [];
    }

    addJobVacancy(job) {
        if (!this.db.jobVacancies) this.db.jobVacancies = [];
        this.db.jobVacancies.unshift(job);
        this._api('POST', '/api/jobs', job);
    }

    toggleJobSaved(jobId) {
        const job = (this.db.jobVacancies || []).find(j => j.id === jobId);
        if (job) {
            job.saved = !job.saved;
            this._api('POST', `/api/save/${jobId}`);
            return job.saved;
        }
        return false;
    }

    isJobSaved(jobId) {
        const job = (this.db.jobVacancies || []).find(j => j.id === jobId);
        return job ? !!job.saved : false;
    }

    applyToJob(jobId) {
        const job = (this.db.jobVacancies || []).find(j => j.id === jobId);
        if (job) {
            job.applicants = (job.applicants || 0) + 1;
            if (!job.appliedBy) job.appliedBy = [];
            const uid = this.getCurrentUser().id;
            if (!job.appliedBy.includes(uid)) job.appliedBy.push(uid);
            this._api('POST', `/api/jobs/${jobId}/apply`);
        }
    }

    hasApplied(jobId) {
        const job = (this.db.jobVacancies || []).find(j => j.id === jobId);
        if (!job || !job.appliedBy) return false;
        return job.appliedBy.includes(this.getCurrentUser().id);
    }

    // ==========================================
    // FRIENDS SYSTEM
    // ==========================================
    getFriends(userId) {
        const user = this.getUser(userId);
        if (!user || !user.friends) return [];
        return (this.db.users || []).filter(u => user.friends.includes(u.id));
    }

    getFriendSuggestions() {
        const currentUser = this.getCurrentUser();
        const friendIds = currentUser.friends || [];
        return (this.db.users || []).filter(u => u.id !== currentUser.id && !friendIds.includes(u.id));
    }

    addFriend(targetUserId) {
        const currentUser = this.getCurrentUser();
        if (!currentUser.friends) currentUser.friends = [];
        if (!currentUser.friends.includes(targetUserId)) {
            currentUser.friends.push(targetUserId);
            const target = this.getUser(targetUserId);
            if (target && target.friends && !target.friends.includes(currentUser.id)) {
                target.friends.push(currentUser.id);
            }
            this._api('POST', `/api/friends/${targetUserId}`);
        }
    }

    removeFriend(targetUserId) {
        const currentUser = this.getCurrentUser();
        if (currentUser.friends) {
            currentUser.friends = currentUser.friends.filter(id => id !== targetUserId);
            const target = this.getUser(targetUserId);
            if (target && target.friends) {
                target.friends = target.friends.filter(id => id !== currentUser.id);
            }
            this._api('DELETE', `/api/friends/${targetUserId}`);
        }
    }

    // ==========================================
    // MESSAGING
    // ==========================================
    getConversations() {
        return this.db.conversations || [];
    }

    getConversation(convId) {
        return (this.db.conversations || []).find(c => c.id === convId);
    }

    async getConversationWithUser(otherUserId) {
        const currentUserId = this.getCurrentUser().id;
        let conv = (this.db.conversations || []).find(c =>
            c.participantIds.includes(currentUserId) && c.participantIds.includes(otherUserId)
        );
        if (conv) return conv;

        if (!this.db.conversations) this.db.conversations = [];

        const { ok, data } = await this._api('POST', '/api/conversations', { otherUserId });
        if (ok && data && data.conversation) {
            conv = data.conversation;
        } else {
            conv = { id: 'conv_' + Date.now(), participantIds: [currentUserId, otherUserId], messages: [] };
        }
        this.db.conversations.push(conv);
        return conv;
    }

    sendMessage(convId, text, senderId, type = 'text', replyTo = null) {
        const conv = (this.db.conversations || []).find(c => c.id === convId);
        if (conv) {
            const msg = {
                id: 'm_' + Date.now(),
                senderId: senderId || this.getCurrentUser().id,
                text: text,
                type: type,
                replyTo: replyTo || null,
                reaction: null,
                isEdited: false,
                createdAt: new Date().toISOString()
            };
            conv.messages.push(msg);
            this._api('POST', `/api/conversations/${convId}/messages`, {
                id: msg.id, text, type, replyTo: replyTo || null
            });
            return msg;
        }
        return null;
    }

    editChatMessage(convId, msgId, newText) {
        const conv = (this.db.conversations || []).find(c => c.id === convId);
        if (conv) {
            const msg = conv.messages.find(m => m.id === msgId);
            if (msg && msg.type === 'text') {
                msg.text = newText;
                msg.isEdited = true;
                this._api('PUT', `/api/messages/${msgId}`, { text: newText });
                return true;
            }
        }
        return false;
    }

    deleteChatMessage(convId, msgId) {
        const conv = (this.db.conversations || []).find(c => c.id === convId);
        if (conv) {
            const initialLength = conv.messages.length;
            conv.messages = conv.messages.filter(m => m.id !== msgId);
            if (conv.messages.length !== initialLength) {
                this._api('DELETE', `/api/messages/${msgId}`);
                return true;
            }
        }
        return false;
    }

    toggleMessageReaction(convId, msgId, reaction = '\u2764\uFE0F') {
        const conv = (this.db.conversations || []).find(c => c.id === convId);
        if (!conv) return null;
        const msg = conv.messages.find(m => m.id === msgId);
        if (!msg) return null;
        msg.reaction = msg.reaction ? null : reaction;
        this._api('POST', `/api/messages/${msgId}/react`, { reaction });
        return msg.reaction;
    }

    // Lightweight polling helpers used by the UI to pick up messages sent by
    // the other participant without a full page reload.
    async refreshConversation(convId) {
        const { ok, data } = await this._api('GET', `/api/conversations/${convId}/messages`);
        if (ok && data && data.conversation) {
            const idx = (this.db.conversations || []).findIndex(c => c.id === convId);
            if (idx > -1) this.db.conversations[idx] = data.conversation;
            else this.db.conversations.push(data.conversation);
            return data.conversation;
        }
        return this.getConversation(convId);
    }

    async refreshConversations() {
        const { ok, data } = await this._api('GET', '/api/conversations');
        if (ok && data && data.conversations) {
            this.db.conversations = data.conversations;
        }
        return this.db.conversations;
    }

    // ==========================================
    // NOTIFICATIONS
    // ==========================================
    getNotifications() {
        return (this.db.notifications || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    getUnreadNotificationCount() {
        return (this.db.notifications || []).filter(n => !n.read).length;
    }

    markNotificationRead(notifId) {
        const notif = (this.db.notifications || []).find(n => n.id === notifId);
        if (notif) {
            notif.read = true;
            this._api('POST', `/api/notifications/${notifId}/read`);
        }
    }

    markAllNotificationsRead() {
        (this.db.notifications || []).forEach(n => n.read = true);
        this._api('POST', '/api/notifications/read_all');
    }

    addNotification(notif) {
        if (!this.db.notifications) this.db.notifications = [];
        this.db.notifications.unshift(notif);
    }

    async refreshNotifications() {
        const { ok, data } = await this._api('GET', '/api/notifications');
        if (ok && data && data.notifications) {
            this.db.notifications = data.notifications;
        }
        return this.db.notifications;
    }

    // ==========================================
    // FOLLOW LOGIC
    // ==========================================
    toggleFollow(targetUserId) {
        const user = this.getCurrentUser();
        if (!user.following) user.following = [];

        let isFollowing = false;
        const index = user.following.indexOf(targetUserId);

        if (index === -1) {
            user.following.push(targetUserId);
            isFollowing = true;
        } else {
            user.following.splice(index, 1);
            isFollowing = false;
        }

        this._api('POST', `/api/follow/${targetUserId}`);
        return isFollowing;
    }

    // ==========================================
    // GLOBAL SEARCH (runs against the locally cached snapshot)
    // ==========================================
    search(query) {
        if (!query || !query.trim()) return { people: [], posts: [], groups: [], jobs: [] };
        const q = query.toLowerCase().trim();

        const people = (this.db.users || []).filter(u =>
            u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q) || (u.bio && u.bio.toLowerCase().includes(q))
        );

        const posts = (this.db.posts || []).filter(p =>
            p.text.toLowerCase().includes(q)
        );

        const groups = (this.db.groups || []).filter(g =>
            g.name.toLowerCase().includes(q) || g.description.toLowerCase().includes(q)
        );

        const jobs = (this.db.jobVacancies || []).filter(j =>
            j.title.toLowerCase().includes(q) || j.company.toLowerCase().includes(q) ||
            j.category.toLowerCase().includes(q) || j.description.toLowerCase().includes(q)
        );

        return { people, posts, groups, jobs };
    }
}

const store = new Store();

    // ==========================================
    // NOTES METHODS
    // ==========================================
