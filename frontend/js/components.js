// ==========================================================================
// UTILITY FUNCTIONS
// ==========================================================================
function timeAgo(dateString) {
    if (!dateString) return 'Just now';
    const now = new Date();
    const past = new Date(dateString);
    const diffMs = now - past;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m`;
    if (diffHour < 24) return `${diffHour}h`;
    if (diffDay < 7) return `${diffDay}d`;
    return past.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getReactionEmoji(type) {
    switch (type) {
        case 'like': return '';
        case 'love': return '';
        case 'haha': return '';
        case 'wow': return '';
        case 'sad': return '';
        case 'angry': return '';
        default: return '';
    }
}

function getReactionColorClass(type) {
    switch (type) {
        case 'like': return 'liked text-like';
        case 'love': return 'text-love';
        case 'haha': return 'text-haha';
        case 'wow': return 'text-wow';
        case 'sad': return 'text-sad';
        case 'angry': return 'text-angry';
        default: return '';
    }
}

// ==========================================================================
// POST COMPONENT
// ==========================================================================
function renderPost(post) {
    const author = store.getUser(post.authorId);
    const currentUser = store.getCurrentUser();
    
    // Determine user reaction
    let userReactionType = null;
    if (post.reactions) {
        for (const [type, users] of Object.entries(post.reactions)) {
            if (users && users.includes(currentUser.id)) {
                userReactionType = type;
                break;
            }
        }
    }

    // Total reactions & top reaction icons
    let totalReactions = 0;
    const activeReactionTypes = [];
    if (post.reactions) {
        for (const [type, users] of Object.entries(post.reactions)) {
            if (users && users.length > 0) {
                totalReactions += users.length;
                activeReactionTypes.push(type);
            }
        }
    }

    const actionText = userReactionType 
        ? userReactionType.charAt(0).toUpperCase() + userReactionType.slice(1) 
        : 'Like';
    const actionColorClass = userReactionType ? getReactionColorClass(userReactionType) : '';
    const actionEmoji = userReactionType ? getReactionEmoji(userReactionType) : '';

    const isSaved = store.isPostSaved(post.id);
    const isAuthor = currentUser.id === post.authorId;

    const mediaHtml = (post.media && post.media.length > 0) 
        ? `<div class="post-media-container"><img src="${post.media[0]}" class="post-media" alt="Post media" loading="lazy"></div>` 
        : '';

    const feelingHtml = post.feeling 
        ? `<span style="font-weight: normal; color: var(--text-secondary);"> is ${post.feeling}</span>` 
        : '';

    // Comments HTML
    const commentsHtml = (post.comments || []).map(c => {
        const cAuthor = store.getUser(c.authorId);
        const repliesHtml = (c.replies || []).map(r => {
            const rAuthor = store.getUser(r.authorId);
            return `
                <div class="comment-item" style="margin-top: 6px;">
                    <img src="${rAuthor.avatar}" class="avatar-small" alt="${rAuthor.name}">
                    <div class="comment-content-box">
                        <div class="comment-bubble">
                            <span class="comment-author" onclick="app.viewUserProfile('${rAuthor.id}')">${rAuthor.name}</span>
                            <div class="comment-text">${escapeHtml(r.text)}</div>
                        </div>
                        <div class="comment-actions">
                            <span class="comment-time">${timeAgo(r.createdAt)}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        const isCommentOwner = c.authorId === store.db.currentUserId;
        const isPostOwner = post.authorId === store.db.currentUserId;
        
        let extraActions = '';
        if (isCommentOwner) {
            extraActions += `<span class="comment-action-btn" onclick="app.editCommentUI('${post.id}', '${c.id}', \`${escapeHtml(c.text).replace(/`/g, '\\`')}\`)">Edit</span>`;
        }
        if (isCommentOwner || isPostOwner) {
            extraActions += `<span class="comment-action-btn" style="color: var(--danger, #ff4d4d);" onclick="app.deleteCommentUI('${post.id}', '${c.id}')">Delete</span>`;
        }

        return `
            <div class="comment-item" id="comment-${c.id}">
                <img src="${cAuthor.avatar}" class="avatar-small" alt="${cAuthor.name}">
                <div class="comment-content-box">
                    <div class="comment-bubble">
                        <span class="comment-author" onclick="app.viewUserProfile('${cAuthor.id}')">${cAuthor.name}</span>
                        <div class="comment-text">${escapeHtml(c.text)}</div>
                    </div>
                    <div class="comment-actions">
                        <span class="comment-action-btn" onclick="app.reactComment('${post.id}', '${c.id}')">Like</span>
                        <span class="comment-action-btn" onclick="app.focusReplyInput('${post.id}', '${c.id}')">Reply</span>
                        ${extraActions}
                        <span class="comment-time">${timeAgo(c.createdAt)}</span>
                    </div>
                    <div class="comment-replies" id="replies-${c.id}">${repliesHtml}</div>
                </div>
            </div>
        `;
    }).join('');

    return `
        <div class="post" id="post-${post.id}">
            <div class="post-header">
                <div class="post-author-info">
                    <img src="${author.avatar}" class="avatar" alt="${author.name}" onclick="app.viewUserProfile('${author.id}')" style="cursor: pointer;">
                    <div>
                        <div class="post-author-name" onclick="app.viewUserProfile('${author.id}')" style="cursor: pointer;">
                            ${author.name} ${feelingHtml}
                        </div>
                        <div class="post-meta">
                            <span>${timeAgo(post.createdAt)}</span>  <span> Public</span>
                        </div>
                    </div>
                </div>
                <div class="post-options-menu">
                    <button class="icon-btn-small" onclick="app.togglePostMenu('${post.id}')" title="Options">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
                    </button>
                    <div class="post-dropdown hidden" id="post-menu-${post.id}">
                        <div class="post-dropdown-item" onclick="app.savePost('${post.id}')">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="${isSaved ? 'var(--accent)' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                            <span>${isSaved ? 'Unsave post' : 'Save post'}</span>
                        </div>
                        ${isAuthor ? `
                        <div class="post-dropdown-item" onclick="app.editPost('${post.id}')">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                            <span>Edit post</span>
                        </div>
                        <div class="post-dropdown-item" onclick="app.deletePost('${post.id}')" style="color: var(--badge-red);">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            <span>Delete post</span>
                        </div>
                        ` : `
                        <div class="post-dropdown-item" onclick="app.hidePost('${post.id}')">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
                            <span>Hide post</span>
                        </div>
                        <div class="post-dropdown-item" onclick="app.reportContent('post','${post.id}')" style="color: var(--badge-red);">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                            <span>Report post</span>
                        </div>
                        `}
                    </div>
                </div>
            </div>

            <div class="post-content">${escapeHtml(post.text)}</div>
            ${mediaHtml}

            <div class="post-stats">
                <div class="post-reactions-summary" onclick="app.showReactionsModal('${post.id}')">
                    <div class="reactions-badge-stack">
                        ${activeReactionTypes.slice(0, 3).map(t => `<div class="reaction-badge-icon">${getReactionEmoji(t)}</div>`).join('')}
                    </div>
                    <span>${totalReactions > 0 ? `${totalReactions} ${totalReactions === 1 ? 'reaction' : 'reactions'}` : 'Be the first to react'}</span>
                </div>
                <div style="cursor: pointer;" onclick="app.toggleComments('${post.id}')">
                    ${(post.comments || []).length} comments
                </div>
            </div>

            <div class="post-actions">
                <div class="post-action ${actionColorClass}" data-action="react" data-post-id="${post.id}">
                    <div class="reaction-picker hidden" id="picker-${post.id}">
                        <span class="reaction-icon" data-type="like" title="Like"></span>
                        <span class="reaction-icon" data-type="love" title="Love"></span>
                        <span class="reaction-icon" data-type="haha" title="Haha"></span>
                        <span class="reaction-icon" data-type="wow" title="Wow"></span>
                        <span class="reaction-icon" data-type="sad" title="Sad"></span>
                        <span class="reaction-icon" data-type="angry" title="Angry"></span>
                    </div>
                    ${actionEmoji ? `<span style="font-size: 18px;">${actionEmoji}</span>` : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>`}
                    <span>${actionText}</span>
                </div>
                <div class="post-action" onclick="app.toggleComments('${post.id}')">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg> 
                    <span>Comment</span>
                </div>
                <div class="post-action" onclick="app.sharePost('${post.id}')">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg> 
                    <span>Share</span>
                </div>
            </div>

            <div class="comments-section hidden" id="comments-${post.id}">
                <div class="comment-composer">
                    <img src="${currentUser.avatar}" class="avatar-small" alt="${currentUser.name}">
                    <div class="comment-input-wrapper">
                        <input type="text" class="comment-input-field" id="comment-input-${post.id}" data-post-id="${post.id}" placeholder="Write a comment... (Press Enter to post)">
                    </div>
                </div>
                <div class="comments-list">${commentsHtml}</div>
            </div>
        </div>
    `;
}

// ==========================================
// STORY COMPONENT
// ==========================================
function renderStoryGroup(group, userId) {
    if (!group || group.length === 0) return '';
    const firstStory = group[0]; // thumbnail
    const author = store.getUser(userId);
    return `
        <div class="story-card story-item" style="background-image: url('${firstStory.media}')" onclick="app.openStoryViewer('${userId}')">
            <div class="story-avatar-container">
                <div class="avatar-story-ring">
                    <img src="${author.avatar}" class="avatar-small" alt="${author.name}">
                </div>
            </div>
            <span class="story-name">${author.name}</span>
        </div>
    `;
}

// ==========================================
// REEL COMPONENT
// ==========================================
function renderReel(reel) {
    const author = store.getUser(reel.authorId);
    const currentUser = store.getCurrentUser();
    const isLiked = reel.reactions && reel.reactions.like && reel.reactions.like.includes(currentUser.id);
    const likesCount = reel.reactions && reel.reactions.like ? reel.reactions.like.length : 0;
    const commentsCount = reel.comments ? reel.comments.length : 0;
    
    const isFollowing = currentUser.following && currentUser.following.includes(author.id);
    const followBtnClass = isFollowing ? 'btn-secondary' : 'btn-primary';
    const followBtnText = isFollowing ? 'Following' : 'Follow';

    return `
        <div class="reel-card" id="reel-${reel.id}" style="position: relative;">
            <video src="${reel.media}" class="reel-media" loop playsinline autoplay muted 
                onclick="app.toggleReelPlay(this, '${reel.id}')"
                ondblclick="app.handleReelDoubleClick(event, '${reel.id}')"
                ontimeupdate="app.updateReelProgress(this, '${reel.id}')"
            ></video>
            
            <!-- Double click heart animation overlay -->
            <div id="reel-heart-${reel.id}" class="reel-heart-animation">
                <svg width="100" height="100" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            </div>

            <!-- Play/pause animation overlay -->
            <div id="reel-play-pause-${reel.id}" class="reel-play-pause-anim">
                <svg width="60" height="60" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            </div>

            <!-- Sound Toggle -->
            <div class="reel-sound-toggle" onclick="app.toggleReelSound(event, '${reel.id}')">
                <svg id="reel-sound-icon-${reel.id}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
            </div>

            <!-- Overlay Content -->
            <div class="reel-overlay-content">
                <div class="reel-author-row">
                    <img src="${author.avatar}" class="avatar" alt="${author.name}" onclick="app.viewUserProfile('${author.id}')" style="cursor: pointer;">
                    <div>
                        <strong onclick="app.viewUserProfile('${author.id}')" style="cursor: pointer;">${author.name}</strong>
                        ${author.id !== currentUser.id ? `<button class="btn ${followBtnClass} btn-sm btn-pill" style="margin-left: 8px; padding: 3px 10px; font-size: 11px;" onclick="app.toggleFollow('${author.id}', this)">${followBtnText}</button>` : ''}
                    </div>
                </div>
                <div style="font-size: 14px; margin-top: 4px; margin-bottom: 8px;">${escapeHtml(reel.caption)}</div>
                <div class="reel-audio-track">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
                    <marquee scrollamount="3">Original Audio - ${author.name}  Original Audio - ${author.name}</marquee>
                </div>
            </div>

            <!-- Progress Bar -->
            <div class="reel-progress-container" onclick="app.seekReel(event, this, '${reel.id}')">
                <div class="reel-progress-bg"></div>
                <div class="reel-progress-fill" id="reel-progress-fill-${reel.id}"></div>
            </div>

            <div class="reel-actions-sidebar">
                <div class="reel-action-btn" onclick="app.likeReel('${reel.id}')">
                    <div class="reel-action-icon" style="color: ${isLiked ? 'var(--love-red)' : 'white'};">
                        <svg id="reel-like-icon-${reel.id}" width="24" height="24" viewBox="0 0 24 24" fill="${isLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" style="transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                    </div>
                    <span id="reel-likes-count-${reel.id}">${likesCount}</span>
                </div>

                <div class="reel-action-btn" onclick="app.openReelComments('${reel.id}')">
                    <div class="reel-action-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                    </div>
                    <span>${commentsCount}</span>
                </div>

                <div class="reel-action-btn" onclick="app.shareReel('${reel.id}')">
                    <div class="reel-action-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                    </div>
                    <span>Share</span>
                </div>

                <div class="reel-action-btn" onclick="app.saveReel('${reel.id}')">
                    <div class="reel-action-icon" style="color: ${currentUser.savedItems && currentUser.savedItems.includes(reel.id) ? 'var(--accent)' : 'white'};">
                        <svg id="reel-save-icon-${reel.id}" width="24" height="24" viewBox="0 0 24 24" fill="${currentUser.savedItems && currentUser.savedItems.includes(reel.id) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                    </div>
                    <span>Save</span>
                </div>
                
                <div class="reel-action-btn" style="position: relative;">
                    <div class="reel-action-icon" onclick="event.stopPropagation(); app.toggleReelMenu('${reel.id}')" style="cursor: pointer;">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="2"></circle><circle cx="12" cy="19" r="2"></circle><circle cx="12" cy="5" r="2"></circle></svg>
                    </div>
                    <!-- Menu popup -->
                    <div class="post-dropdown hidden" id="reel-menu-${reel.id}" style="position: absolute; right: 50px; bottom: 0; top: auto; background: var(--bg-card, #121c32); border: 1px solid var(--border-glass, rgba(255,255,255,0.15)); border-radius: 12px; min-width: 170px; z-index: 9999; box-shadow: 0 10px 30px rgba(0,0,0,0.8);">
                        <div class="post-dropdown-item" onclick="event.stopPropagation(); app.reportContent('reel', '${reel.id}')" style="padding: 12px 14px; cursor: pointer; display: flex; gap: 10px; align-items: center; color: var(--danger, #ff4444);">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>
                            <span style="font-weight: 600; font-size: 14px;">Report</span>
                        </div>
                        <div class="post-dropdown-item" onclick="event.stopPropagation(); app.notInterestedReel('${reel.id}')" style="padding: 12px 14px; cursor: pointer; display: flex; gap: 10px; align-items: center; color: white;">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12h20M12 2v20"></path></svg>
                            <span style="font-weight: 600; font-size: 14px;">Not Interested</span>
                        </div>
                    </div>
                </div>
                
                ${author.id === currentUser.id ? `
                <div class="reel-action-btn" style="color: var(--danger);" onclick="app.deleteReel('${reel.id}')">
                    <div class="reel-action-icon" style="color: var(--danger);">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                    </div>
                    <span>Delete</span>
                </div>
                ` : ''}
            </div>

            <!-- Progress Bar -->
            <div class="reel-progress-bar-container" onclick="app.seekReel(event, this, '${reel.id}')">
                <div id="reel-progress-fill-${reel.id}" class="reel-progress-fill"></div>
            </div>
        </div>
    `;
}

// ==========================================
// WATCH VIDEO COMPONENT
// ==========================================
function renderWatchVideo(video) {
    const author = store.getUser(video.authorId) || { name: video.sourceName || 'Educator', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150' };
    const isYouTube = video.platform === 'YouTube' || (video.url && video.url.includes('youtube.com'));
    const isGoogle = video.platform === 'Google' || (video.url && video.url.includes('google.com'));

    const platformBadge = isYouTube 
        ? `<span style="display: inline-flex; align-items: center; gap: 5px; background: rgba(255, 0, 0, 0.15); color: #ff4d4d; border: 1px solid rgba(255, 0, 0, 0.3); padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
            YouTube
           </span>`
        : `<span style="display: inline-flex; align-items: center; gap: 5px; background: rgba(66, 133, 244, 0.15); color: #4285F4; border: 1px solid rgba(66, 133, 244, 0.3); padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/></svg>
            Google Resource
           </span>`;

    const buttonLabel = isYouTube ? 'Watch on YouTube ' : 'Open Google Resource ';
    const buttonBg = isYouTube ? 'background: #ff0000; color: #fff;' : 'background: #4285F4; color: #fff;';

    return `
        <div class="card card-interactive" style="padding: 0; overflow: hidden; margin-bottom: 24px; border: 1px solid var(--border); box-shadow: var(--shadow-sm);">
            <div style="position: relative; width: 100%; height: 360px; background: black; cursor: pointer;" onclick="app.playWatchVideo('${video.id}')">
                <img src="${video.media}" style="width: 100%; height: 100%; object-fit: cover;" alt="${escapeHtml(video.title)}">
                <div style="position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.7) 100%);"></div>
                <div style="position: absolute; top: 14px; left: 14px; display: flex; gap: 8px;">
                    ${platformBadge}
                    <span style="background: rgba(0,0,0,0.7); color: var(--gold-bright, #ff7a29); padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600;">${video.category || 'Education & IT'}</span>
                </div>
                <div style="position: absolute; bottom: 14px; right: 14px; background: rgba(0,0,0,0.85); color: white; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 700;">${video.duration || '10:00'}</div>
                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 64px; height: 64px; border-radius: 50%; background: ${isYouTube ? 'rgba(255,0,0,0.9)' : 'var(--accent-gradient)'}; display: flex; align-items: center; justify-content: center; color: white; box-shadow: 0 10px 30px rgba(0,0,0,0.5); transition: transform 0.2s;" onmouseenter="this.style.transform='translate(-50%, -50%) scale(1.1)'" onmouseleave="this.style.transform='translate(-50%, -50%) scale(1)'">
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                </div>
            </div>
            <div style="padding: 20px;">
                <div style="display: flex; gap: 14px; align-items: flex-start; justify-content: space-between;">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                            <span style="font-size: 12px; font-weight: 700; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em;">${video.sourceName || author.name}</span>
                            <span style="font-size: 11px; color: var(--text-tertiary);"> ${video.subcategory || video.category}</span>
                        </div>
                        <h3 style="font-size: 17px; font-weight: 700; line-height: 1.35; margin-bottom: 8px;">${escapeHtml(video.title)}</h3>
                        ${video.description ? `<p style="font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 14px;">${escapeHtml(video.description)}</p>` : ''}
                        <p class="text-secondary" style="font-size: 12px; margin-bottom: 12px;"> ${video.views || '100K views'}  ${video.category}</p>
                    </div>
                </div>
                <div style="display: flex; gap: 10px; align-items: center; justify-content: space-between; padding-top: 14px; border-top: 1px solid var(--border); flex-wrap: wrap;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <img src="${author.avatar}" class="avatar-small" alt="${author.name}" style="width: 32px; height: 32px; border-radius: 50%;">
                        <span style="font-size: 13px; font-weight: 600;">${escapeHtml(author.name)}</span>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <a href="${video.url}" target="_blank" rel="noopener noreferrer" class="btn btn-sm" style="${buttonBg} border: none; border-radius: 20px; padding: 7px 16px; font-weight: 600; text-decoration: none; display: inline-flex; align-items: center; gap: 6px;" onclick="event.stopPropagation();">
                            ${buttonLabel}
                        </a>
                        <button class="btn btn-secondary btn-sm" style="border-radius: 20px; padding: 7px 14px;" onclick="event.stopPropagation(); app.copyText('${video.url}', 'Link copied to clipboard! ');">
                            Share
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ==========================================
// JOB VACANCY CARD COMPONENT
// ==========================================
function renderJobCard(job) {
    const poster = store.getUser(job.postedBy);
    const isSaved = store.isJobSaved(job.id);
    const applied = store.hasApplied(job.id);
    const daysAgo = Math.floor((Date.now() - new Date(job.postedAt).getTime()) / 86400000);
    const postedLabel = daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : `${daysAgo}d ago`;

    const remoteColor = job.remote === 'Remote' ? '#22c55e' : job.remote === 'Hybrid' ? '#f59e0b' : '#6366f1';

    return `
        <div class="job-card" id="job-${job.id}">
            <div class="job-card-header">
                <img src="${job.logo}" class="job-company-logo" alt="${job.company}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1497366216548-37526070297c?w=200'">
                <div class="job-header-info">
                    <h3 class="job-title">${escapeHtml(job.title)}</h3>
                    <div class="job-company-name">${escapeHtml(job.company)}</div>
                    <div class="job-meta">
                        <span> ${job.location}</span>
                        <span class="job-remote-badge" style="background: ${remoteColor}20; color: ${remoteColor}; border: 1px solid ${remoteColor}40;">${job.remote}</span>
                    </div>
                </div>
                <button class="job-save-btn ${isSaved ? 'saved' : ''}" onclick="app.toggleJobSave('${job.id}')" title="${isSaved ? 'Unsave' : 'Save job'}">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="${isSaved ? 'var(--accent)' : 'none'}" stroke="${isSaved ? 'var(--accent)' : 'currentColor'}" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                </button>
            </div>

            <p class="job-description">${escapeHtml(job.description)}</p>

            <div class="job-tags">
                <span class="job-tag">${job.category}</span>
                <span class="job-tag">${job.type}</span>
                ${job.requirements.slice(0, 2).map(r => `<span class="job-tag job-tag-req"> ${escapeHtml(r)}</span>`).join('')}
            </div>

            <div class="job-salary"> ${escapeHtml(job.salary)}</div>

            <div class="job-footer">
                <div class="job-footer-left">
                    <img src="${poster.avatar}" class="avatar-xs" alt="${poster.name}">
                    <span class="job-posted-by">Posted by <strong>${poster.name}</strong>  ${postedLabel}</span>
                    <span class="job-applicants"> ${job.applicants} applicants</span>
                </div>
                <div class="job-actions">
                    <button class="btn btn-outline btn-sm" onclick="app.viewJobDetails('${job.id}')">Details</button>
                    <button class="btn ${applied ? 'btn-secondary' : 'btn-primary'} btn-sm" onclick="app.applyToJob('${job.id}')">
                        ${applied ? ' Applied' : 'Apply Now'}
                    </button>
                </div>
            </div>
        </div>
    `;
}

// Full Job Details Modal HTML
function renderJobDetailsModal(job) {
    const poster = store.getUser(job.postedBy);
    const applied = store.hasApplied(job.id);
    const daysAgo = Math.floor((Date.now() - new Date(job.postedAt).getTime()) / 86400000);

    return `
        <div class="job-details-header">
            <img src="${job.logo}" class="job-company-logo-lg" alt="${job.company}" onerror="this.src='https://images.unsplash.com/photo-1497366216548-37526070297c?w=200'">
            <div>
                <h2 style="font-size: 22px; font-weight: 800;">${escapeHtml(job.title)}</h2>
                <div style="font-size: 16px; font-weight: 600; color: var(--accent); margin: 4px 0;">${escapeHtml(job.company)}</div>
                <div style="color: var(--text-secondary); font-size: 14px;"> ${job.location}  ${job.remote}  ${job.type}</div>
            </div>
        </div>

        <div class="job-detail-salary" style="font-size: 18px; font-weight: 700; margin: 16px 0; color: #22c55e;"> ${escapeHtml(job.salary)}</div>

        <h4 style="font-weight: 700; margin-bottom: 8px;">About the Role</h4>
        <p style="color: var(--text-secondary); line-height: 1.7; margin-bottom: 20px;">${escapeHtml(job.description)}</p>

        <h4 style="font-weight: 700; margin-bottom: 10px;">Requirements</h4>
        <ul style="margin-bottom: 20px; padding-left: 20px;">
            ${job.requirements.map(r => `<li style="color: var(--text-secondary); margin-bottom: 6px; line-height: 1.5;"> ${escapeHtml(r)}</li>`).join('')}
        </ul>

        <h4 style="font-weight: 700; margin-bottom: 10px;">Benefits & Perks</h4>
        <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px;">
            ${job.benefits.map(b => `<span class="job-tag" style="background: var(--accent-light); color: var(--accent);"> ${escapeHtml(b)}</span>`).join('')}
        </div>

        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px; padding: 12px; background: var(--bg-secondary); border-radius: var(--radius-md);">
            <img src="${poster.avatar}" class="avatar-small" alt="${poster.name}">
            <div>
                <div style="font-weight: 600; font-size: 14px;">Posted by ${escapeHtml(poster.name)}</div>
                <div style="color: var(--text-secondary); font-size: 12px;">${daysAgo === 0 ? 'Today' : daysAgo + 'd ago'}   ${job.applicants} total applicants</div>
            </div>
            <button class="btn btn-outline btn-sm" style="margin-left: auto;" onclick="app.startChatWithUser('${poster.id}', 'Hi! I saw your job posting for ${job.title} at ${job.company}. I'd love to learn more.')">Message</button>
        </div>

        <button class="btn ${applied ? 'btn-secondary' : 'btn-primary'} full-width" style="font-size: 16px; padding: 14px;" onclick="app.applyToJob('${job.id}'); document.getElementById('job-details-modal').classList.add('hidden');">
            ${applied ? ' Already Applied' : ' Apply Now'}
        </button>
    `;
}


// ==========================================
// GROUP COMPONENT
// ==========================================
function renderGroup(group) {
    const currentUser = store.getCurrentUser();
    const isMember = group.memberIds && group.memberIds.includes(currentUser.id);

    return `
        <div class="card card-interactive" style="display: flex; gap: 16px; align-items: center;">
            <img src="${group.cover}" style="width: 84px; height: 84px; border-radius: var(--radius-md); object-fit: cover;" alt="${group.name}">
            <div style="flex: 1;">
                <h3 style="font-size: 17px; font-weight: 700; margin-bottom: 4px;">${group.name}</h3>
                <p class="text-secondary" style="font-size: 13px; margin-bottom: 6px;">${group.memberIds ? group.memberIds.length : 0} members  ${group.private ? ' Private' : ' Public group'}</p>
                <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.4;">${group.description}</p>
            </div>
            <button class="btn ${isMember ? 'btn-secondary' : 'btn-primary'}" onclick="app.toggleGroupMembership('${group.id}')">
                ${isMember ? 'Joined ' : 'Join Group'}
            </button>
        </div>
    `;
}

// ==========================================
// PAGE COMPONENT
// ==========================================
function renderPage(page) {
    const currentUser = store.getCurrentUser();
    const isFollowing = page.followerIds && page.followerIds.includes(currentUser.id);

    return `
        <div class="card card-interactive" style="display: flex; gap: 16px; align-items: center;">
            <img src="${page.cover}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover;" alt="${page.name}">
            <div style="flex: 1;">
                <h3 style="font-size: 17px; font-weight: 700;">${page.name}</h3>
                <p class="text-secondary" style="font-size: 13px; margin: 2px 0 6px;">${page.category}  ${page.followerIds ? page.followerIds.length : 0} followers</p>
                <p style="font-size: 13px; color: var(--text-secondary);">${page.description}</p>
            </div>
            <button class="btn ${isFollowing ? 'btn-secondary' : 'btn-primary'}" onclick="app.togglePageFollow('${page.id}')">
                ${isFollowing ? 'Following ' : 'Follow'}
            </button>
        </div>
    `;
}

// ==========================================
// EVENT COMPONENT
// ==========================================
function renderEvent(event) {
    const host = store.getUser(event.hostId);
    const currentUser = store.getCurrentUser();
    const dateObj = new Date(event.datetime);
    const month = dateObj.toLocaleDateString(undefined, { month: 'short' }).toUpperCase();
    const day = dateObj.getDate();
    const dateStr = dateObj.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    const isGoing = event.rsvps && event.rsvps.going && event.rsvps.going.includes(currentUser.id);
    const isInterested = event.rsvps && event.rsvps.interested && event.rsvps.interested.includes(currentUser.id);

    return `
        <div class="card card-interactive" style="display: flex; gap: 16px; align-items: center;">
            <div style="width: 70px; height: 74px; background: var(--bg-secondary); border-radius: var(--radius-md); display: flex; flex-direction: column; align-items: center; justify-content: center; border: 1px solid var(--border); flex-shrink: 0;">
                <span style="font-size: 11px; font-weight: 700; color: var(--accent);">${month}</span>
                <span style="font-size: 24px; font-weight: 700; font-family: var(--font-heading);">${day}</span>
            </div>
            <div style="flex: 1;">
                <span style="font-size: 12px; font-weight: 600; color: var(--accent);">${dateStr}</span>
                <h3 style="font-size: 17px; font-weight: 700; margin: 2px 0;">${event.title}</h3>
                <p class="text-secondary" style="font-size: 13px;"> ${event.location}  Hosted by ${host.name}</p>
                <p class="text-secondary" style="font-size: 12px; margin-top: 4px;">${(event.rsvps && event.rsvps.going) ? event.rsvps.going.length : 0} going  ${(event.rsvps && event.rsvps.interested) ? event.rsvps.interested.length : 0} interested</p>
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px;">
                <button class="btn ${isGoing ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="app.rsvpEvent('${event.id}', 'going')">
                    ${isGoing ? 'Going ' : 'Going'}
                </button>
                <button class="btn ${isInterested ? 'btn-primary' : 'btn-outline'} btn-sm" onclick="app.rsvpEvent('${event.id}', 'interested')">
                    ${isInterested ? 'Interested ' : 'Interested'}
                </button>
            </div>
        </div>
    `;
}

// ==========================================
// FRIEND COMPONENT
// ==========================================
function renderFriendCard(user, isFriend) {
    return `
        <div class="card card-interactive" style="padding: 12px 16px; display: flex; align-items: center; gap: 14px; border-radius: var(--radius-lg);">
            <img src="${user.avatar}" style="width: 52px; height: 52px; border-radius: 50%; object-fit: cover; cursor: pointer; border: 1px solid var(--border);" alt="${user.name}" onclick="app.viewUserProfile('${user.id}')">
            <div style="flex: 1; min-width: 0; text-align: left;">
                <h4 style="font-size: 15px; font-weight: 600; margin: 0 0 4px 0; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" onclick="app.viewUserProfile('${user.id}')">${user.name}</h4>
                <p class="text-secondary" style="font-size: 13px; margin: 0;">${user.friends ? user.friends.length : 0} mutual friends</p>
            </div>
            <div style="display: flex; gap: 8px;">
                ${isFriend ? `
                    <button class="btn btn-secondary btn-sm" onclick="app.startChatWithUser('${user.id}')" style="padding: 6px 14px; border-radius: 20px; font-size: 13px;">Message</button>
                    <button class="btn btn-secondary btn-sm" onclick="app.removeFriend('${user.id}')" title="Unfriend" style="padding: 6px 10px; border-radius: 20px; background: rgba(255, 60, 60, 0.1); color: var(--love-red); border-color: transparent;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"></path></svg>
                    </button>
                ` : `
                    <button class="btn btn-primary btn-sm" onclick="app.addFriend('${user.id}')" style="padding: 6px 18px; border-radius: 20px; font-size: 13px;">Add</button>
                `}
            </div>
        </div>
    `;
}

// ==========================================
// CONTACT SIDEBAR ITEM
// ==========================================
function renderContact(user) {
    return `
        <div class="menu-item" onclick="app.startChatWithUser('${user.id}')">
            <div style="position: relative;">
                <img src="${user.avatar}" class="avatar-small" alt="${user.name}">
                <div style="position: absolute; bottom: 0; right: 0; width: 10px; height: 10px; background-color: var(--status-online); border-radius: 50%; border: 2px solid var(--bg-card);"></div>
            </div>
            <span>${user.name}</span>
        </div>
    `;
}

// ==========================================
// NOTIFICATION ITEM
// ==========================================
function renderNotificationItem(notif) {
    const actor = notif.actorId ? store.getUser(notif.actorId) : { name: "System Admin", avatar: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Check_green_icon.svg/120px-Check_green_icon.svg.png" };
    let iconBadge = '';
    if (notif.type === 'love') iconBadge = '';
    if (notif.type === 'comment') iconBadge = '';
    if (notif.type === 'friend_request') iconBadge = '';
    if (notif.type === 'event_invite') iconBadge = '';

    return `
        <div class="menu-item ${notif.read ? '' : 'unread'}" style="padding: 10px; gap: 12px; position: relative;" onclick="app.handleNotificationClick('${notif.id}', '${notif.type}', '${notif.targetId}')">
            <div style="position: relative;">
                <img src="${actor.avatar || 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Check_green_icon.svg/120px-Check_green_icon.svg.png'}" class="avatar" alt="${actor.name}">
                <span style="position: absolute; bottom: -2px; right: -2px; font-size: 12px;">${iconBadge}</span>
            </div>
            <div style="flex: 1; font-size: 13px;">
                <strong>${actor.name}</strong> ${notif.text}
                <div class="text-secondary" style="font-size: 11px; margin-top: 2px;">${timeAgo(notif.createdAt)}</div>
            </div>
            ${!notif.read ? `<div style="width: 8px; height: 8px; border-radius: 50%; background: var(--accent);"></div>` : ''}
        </div>
    `;
}

// ==========================================
// PROFILE VIEW RENDERER (Mobile-First)
// ==========================================
function renderProfileView(user, currentTab = 'posts') {
    if (user.isBlockedPlaceholder) {
        return `
            <div class="card" style="padding: 0; overflow: hidden; margin-bottom: 16px;">
                <div class="profile-cover-wrapper">
                    <img src="${user.cover || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200'}" class="profile-cover-img" style="filter: grayscale(100%); opacity: 0.5;">
                </div>
                <div class="profile-header-body">
                    <div class="profile-avatar-wrapper">
                        <img src="${user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}" class="profile-avatar-img" onerror="this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'">
                    </div>
                    <h2 class="profile-name">${escapeHtml(user.name || 'User')}</h2>
                    <div class="profile-username-row">@${user.username || 'unknown'}</div>
                    <div class="profile-stats-row" style="opacity: 0.5;">
                        <div class="profile-stat"><span class="profile-stat-number">0</span><span class="profile-stat-label">Posts</span></div>
                        <div class="profile-stat"><span class="profile-stat-number">0</span><span class="profile-stat-label">Friends</span></div>
                        <div class="profile-stat"><span class="profile-stat-number">0</span><span class="profile-stat-label">Photos</span></div>
                    </div>
                </div>
            </div>
            <div class="card" style="text-align: center; padding: 60px 20px;">
                <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;">&#128100;</div>
                <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 8px;">User not found</h2>
                <p style="color: var(--text-secondary);">No posts yet.</p>
            </div>
        `;
    }

    const currentUser = store.getCurrentUser();
    const isMe = currentUser.id === user.id;
    const isFriend = currentUser.friends && currentUser.friends.includes(user.id);
    
    // Privacy check
    const privacy = (user.privacySettings && user.privacySettings.posts) || 'public';
    let isPrivate = false;
    if (!isMe) {
        if (privacy === 'private') isPrivate = true;
        if (privacy === 'friends' && !isFriend) isPrivate = true;
    }

    const userPosts = isPrivate ? [] : store.getPosts().filter(p => p.authorId === user.id);
    const friends = isPrivate ? [] : store.getFriends(user.id);
    const savedPosts = isMe ? store.getPosts().filter(p => store.isPostSaved(p.id)) : [];

    // Collect photos from posts that have media
    const photos = isPrivate ? [] : store.getPosts()
        .filter(p => p.authorId === user.id && p.media && p.media.length > 0)
        .flatMap(p => p.media);

    const userReels = isPrivate ? [] : store.getReels().filter(r => r.authorId === user.id);

    return `
        <!-- Profile Card Header -->
        <div class="card" style="padding: 0; overflow: hidden; margin-bottom: 16px;">
            <!-- Cover Photo -->
            <div class="profile-cover-wrapper">
                <img src="${user.cover || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80'}" 
                     class="profile-cover-img" id="profile-cover-display" alt="Cover Photo"
                     onerror="this.src='https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200'">
            </div>

            <!-- Avatar + Header Info -->
            <div class="profile-header-body">
                <!-- Avatar -->
                <div class="profile-avatar-wrapper" style="position: relative;">
                    ${store.getNoteForUser(user.id) ? `
                        <div style="position: absolute; top: -35px; left: 50%; transform: translateX(-50%); background: var(--bg-card); color: var(--text-primary); padding: 8px 14px; border-radius: 20px; font-size: 13px; font-weight: 500; box-shadow: var(--shadow-md); white-space: nowrap; max-width: 180px; overflow: hidden; text-overflow: ellipsis; border: 1px solid var(--border); z-index: 10;">
                            ${escapeHtml(store.getNoteForUser(user.id).text)}
                            <div style="position: absolute; bottom: -5px; left: 50%; transform: translateX(-50%) rotate(45deg); width: 10px; height: 10px; background: var(--bg-card); border-right: 1px solid var(--border); border-bottom: 1px solid var(--border);"></div>
                        </div>
                    ` : ''}
                    <img src="${user.avatar}" class="profile-avatar-img" id="profile-avatar-display" alt="${user.name}"
                         onerror="this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'">
                </div>

                <!-- Name & Username -->
                <h2 class="profile-name">${escapeHtml(user.name)}</h2>
                <div class="profile-username-row">@${user.username}${user.location ? `   ${user.location}` : ''}</div>

                <!-- Bio -->
                ${user.bio ? `<p class="profile-bio">${escapeHtml(user.bio)}</p>` : (isMe ? `<p class="profile-bio" style="color: var(--text-secondary); font-style: italic;">Add a bio to tell people about yourself</p>` : '')}

                <!-- Stats Row -->
                <div class="profile-stats-row">
                    <div class="profile-stat">
                        <span class="profile-stat-number">${userPosts.length}</span>
                        <span class="profile-stat-label">Posts</span>
                    </div>
                    <div class="profile-stat">
                        <span class="profile-stat-number">${friends.length}</span>
                        <span class="profile-stat-label">Friends</span>
                    </div>
                    <div class="profile-stat">
                        <span class="profile-stat-number">${photos.length}</span>
                        <span class="profile-stat-label">Photos</span>
                    </div>
                </div>

                <!-- Action Buttons -->
                <div class="profile-action-btns">
                    ${isMe ? `
                        <button class="btn btn-primary full-width" onclick="app.openEditProfileModal()">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            Edit Profile
                        </button>
                    ` : `
                        <button class="btn ${isFriend ? 'btn-secondary' : 'btn-primary'}" 
                                onclick="${isFriend ? `app.removeFriend('${user.id}')` : `app.addFriend('${user.id}')`}">
                            ${isFriend ? ' Friends' : '+ Add Friend'}
                        </button>
                        <button class="btn btn-secondary" onclick="app.startChatWithUser('${user.id}')">
                             Message
                        </button>
                        <button class="btn btn-outline btn-sm" onclick="app.toggleFollow('${user.id}')" title="Follow">
                            Follow
                        </button>
                        <button class="btn btn-sm" style="background: var(--bg-secondary); color: var(--danger, #ff4d4d); border: 1px solid var(--border);" onclick="app.blockUser('${user.id}')" title="Block">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
                        </button>
                    `}
                </div>

                <!-- Nav Tabs (scrollable on mobile) -->
                <nav class="profile-nav-tabs">
                    <div class="profile-nav-tab ${currentTab === 'posts' ? 'active' : ''}" onclick="app.switchProfileTab('${user.id}', 'posts')">Posts</div>
                    <div class="profile-nav-tab ${currentTab === 'photos' ? 'active' : ''}" onclick="app.switchProfileTab('${user.id}', 'photos')">Photos (${photos.length})</div>
                    <div class="profile-nav-tab ${currentTab === 'reels' ? 'active' : ''}" onclick="app.switchProfileTab('${user.id}', 'reels')">Reels (${userReels.length})</div>
                    <div class="profile-nav-tab ${currentTab === 'about' ? 'active' : ''}" onclick="app.switchProfileTab('${user.id}', 'about')">About</div>
                    <div class="profile-nav-tab ${currentTab === 'friends' ? 'active' : ''}" onclick="app.switchProfileTab('${user.id}', 'friends')">Friends (${friends.length})</div>
                    ${isMe ? `<div class="profile-nav-tab ${currentTab === 'saved' ? 'active' : ''}" onclick="app.switchProfileTab('${user.id}', 'saved')">Saved (${savedPosts.length})</div>` : ''}
                    ${isMe ? `<div class="profile-nav-tab mobile-only ${currentTab === 'menu' ? 'active' : ''}" onclick="app.switchProfileTab('${user.id}', 'menu')">Menu</div>` : ''}
                </nav>
            </div>
        </div>

        <!-- Tab Contents -->
        <div id="profile-tab-content">
            ${isPrivate ? `
                <div class="card" style="text-align: center; padding: 60px 20px; margin-top: 16px;">
                    <div style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;">??</div>
                    <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 8px;">This account is private</h2>
                    <p style="color: var(--text-secondary);">Follow this user or become friends to see their posts and photos.</p>
                </div>
            ` : ''}

            <!-- POSTS TAB -->
            ${(currentTab === 'posts' && !isPrivate) ? `
                <div class="profile-posts-layout">
                    <!-- Intro card: Desktop only -->
                    <div class="profile-sidebar desktop-only">
                        <div class="card" style="margin-bottom: 16px;">
                            <h3 style="font-size: 16px; font-weight: 700; margin-bottom: 12px;">Intro</h3>
                            <div style="display: flex; flex-direction: column; gap: 10px; font-size: 14px; color: var(--text-secondary);">
                                ${user.work ? `<div style="display: flex; align-items: center; gap: 8px;"> <span>Works at <strong style="color: var(--text-primary);">${escapeHtml(user.work)}</strong></span></div>` : ''}
                                ${user.education ? `<div style="display: flex; align-items: center; gap: 8px;"> <span>Studied at <strong style="color: var(--text-primary);">${escapeHtml(user.education)}</strong></span></div>` : ''}
                                <div style="display: flex; align-items: center; gap: 8px;"> <span>Lives in <strong style="color: var(--text-primary);">${user.location || 'San Francisco, CA'}</strong></span></div>
                                <div style="display: flex; align-items: center; gap: 8px;"> <span><strong style="color: var(--text-primary);">${user.joined || 'Joined 2022'}</strong></span></div>
                                ${isMe ? `<button class="btn btn-secondary btn-sm full-width" style="margin-top: 6px;" onclick="app.openEditProfileModal()"> Edit details</button>` : ''}
                            </div>
                        </div>
                    </div>
                    <div class="profile-feed">
                        ${userPosts.length > 0 
                        ? userPosts.map(p => renderPost(p)).join('') 
                        : `<div class="card" style="text-align:center; padding: 48px 20px;">
                               <div style="font-size: 40px; margin-bottom: 12px;"></div>
                               <p class="text-secondary">No posts yet${isMe ? '. Share something!' : '.'}</p>
                               ${isMe ? `<button class="btn btn-primary" style="margin-top: 12px;" onclick="app.openCreatePostModal()">Create Post</button>` : ''}
                           </div>`}
                    </div>
                </div>
            ` : ''}

            <!-- PHOTOS TAB -->
            ${(currentTab === 'photos' && !isPrivate) ? `
                ${photos.length > 0 ? `
                    <div class="profile-photos-grid">
                        ${photos.map((src, i) => `
                            <div class="profile-photo-item" onclick="app.openPhotoViewer(${i}, '${user.id}')">
                                <img src="${src}" alt="Photo ${i + 1}" loading="lazy" 
                                     onerror="this.parentElement.style.display='none'">
                                <div class="profile-photo-overlay">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <div class="card" style="text-align:center; padding: 60px 20px;">
                        <div style="font-size: 48px; margin-bottom: 12px;"></div>
                        <p class="text-secondary">No photos yet${isMe ? '. Add a post with a photo!' : '.'}</p>
                        ${isMe ? `<button class="btn btn-primary" style="margin-top: 12px;" onclick="app.openCreatePostModal('photo')">Upload Photo</button>` : ''}
                    </div>
                `}
            ` : ''}

            <!-- REELS TAB -->
            ${(currentTab === 'reels' && !isPrivate) ? `
                ${userReels.length > 0 ? `
                    <div class="reels-feed profile-reels-feed" style="max-width: 600px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; align-items: center;">
                        ${userReels.map(r => renderReel(r)).join('')}
                    </div>
                ` : `
                    <div class="card" style="text-align:center; padding: 60px 20px;">
                        <div style="font-size: 48px; margin-bottom: 12px;"></div>
                        <p class="text-secondary">No reels yet${isMe ? '. Upload a reel!' : '.'}</p>
                        ${isMe ? `<button class="btn btn-primary" style="margin-top: 12px;" onclick="app.openCreateReelModal()">Upload Reel</button>` : ''}
                    </div>
                `}
            ` : ''}

            <!-- ABOUT TAB -->
            ${(currentTab === 'about' && !isPrivate) ? `
                <div class="card">
                    <h3 style="font-size: 18px; font-weight: 700; margin-bottom: 20px;">About ${escapeHtml(user.name)}</h3>
                    <div style="display: flex; flex-direction: column; gap: 18px;">
                        <div class="profile-about-item">
                            <div class="profile-about-icon"></div>
                            <div>
                                <div class="profile-about-label">Bio</div>
                                <div class="profile-about-value">${user.bio ? escapeHtml(user.bio) : '<em style="color:var(--text-secondary)">Not set</em>'}</div>
                            </div>
                        </div>
                        <div class="profile-about-item">
                            <div class="profile-about-icon"></div>
                            <div>
                                <div class="profile-about-label">Work</div>
                                <div class="profile-about-value">${user.work ? escapeHtml(user.work) : '<em style="color:var(--text-secondary)">Not set</em>'}</div>
                            </div>
                        </div>
                        <div class="profile-about-item">
                            <div class="profile-about-icon"></div>
                            <div>
                                <div class="profile-about-label">Education</div>
                                <div class="profile-about-value">${user.education ? escapeHtml(user.education) : '<em style="color:var(--text-secondary)">Not set</em>'}</div>
                            </div>
                        </div>
                        <div class="profile-about-item">
                            <div class="profile-about-icon"></div>
                            <div>
                                <div class="profile-about-label">Location</div>
                                <div class="profile-about-value">${user.location ? escapeHtml(user.location) : '<em style="color:var(--text-secondary)">Not set</em>'}</div>
                            </div>
                        </div>
                        <div class="profile-about-item">
                            <div class="profile-about-icon"></div>
                            <div>
                                <div class="profile-about-label">Joined</div>
                                <div class="profile-about-value">${user.joined || 'Joined 2022'}</div>
                            </div>
                        </div>
                        ${isMe ? `
                            <button class="btn btn-secondary full-width" onclick="app.openEditProfileModal()">
                                 Edit About Info
                            </button>
                        ` : ''}
                    </div>
                </div>
            ` : ''}

            <!-- FRIENDS TAB -->
            ${(currentTab === 'friends' && !isPrivate) ? `
                ${friends.length > 0 ? `
                    <div class="friends-grid">
                        ${friends.map(f => renderFriendCard(f, true)).join('')}
                    </div>
                ` : `
                    <div class="card" style="text-align:center; padding: 60px 20px;">
                        <div style="font-size: 48px; margin-bottom: 12px;"></div>
                        <p class="text-secondary">No friends yet.</p>
                        ${isMe ? `<button class="btn btn-primary" style="margin-top: 12px;" onclick="app.switchView('friends')">Find Friends</button>` : ''}
                    </div>
                `}
            ` : ''}

            <!-- SAVED TAB (own profile only) -->
            ${currentTab === 'saved' && isMe ? `
                ${savedPosts.length > 0 ? `
                    <div>
                        <p class="text-secondary" style="font-size: 13px; margin-bottom: 16px;"> ${savedPosts.length} saved item${savedPosts.length !== 1 ? 's' : ''} - only visible to you</p>
                        <div class="saved-posts-grid">
                            ${savedPosts.map(p => {
                                const author = store.getUser(p.authorId) || store.getUser(p.userId);
                                let mediaHtml = '';
                                if (p.media && p.media.length > 0) {
                                    const mediaUrl = p.media[0];
                                    if (mediaUrl.match(/\.(mp4|webm)$/i)) {
                                        mediaHtml = `<video src="${mediaUrl}" style="width: 100%; height: 160px; object-fit: cover; border-bottom: 1px solid var(--border-color);" muted></video>`;
                                    } else {
                                        mediaHtml = `<img src="${mediaUrl}" style="width: 100%; height: 160px; object-fit: cover; border-bottom: 1px solid var(--border-color);">`;
                                    }
                                } else {
                                    mediaHtml = `<div style="width: 100%; height: 160px; background: var(--bg-secondary); display: flex; align-items: center; justify-content: center; border-bottom: 1px solid var(--border-color);"><span style="font-size: 32px; color: var(--text-secondary);"></span></div>`;
                                }

                                return `
                                    <div class="card" style="padding: 0; overflow: hidden; display: flex; flex-direction: column; cursor: pointer; transition: transform 0.2s; position: relative;" onclick="app.viewUserProfile('${author.id}')" onmouseenter="this.style.transform='scale(1.02)'" onmouseleave="this.style.transform='scale(1)'">
                                        ${mediaHtml}
                                        <div style="padding: 12px; flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
                                            <div>
                                                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                                                    <img src="${author.avatar}" style="width: 20px; height: 20px; border-radius: 50%; object-fit: cover;">
                                                    <span style="font-size: 12px; font-weight: 600;">${author.name}</span>
                                                </div>
                                                <p style="font-size: 13px; color: var(--text-primary); margin: 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${escapeHtml(p.text || p.caption || '')}</p>
                                            </div>
                                        </div>
                                        <button class="icon-btn-small" style="position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.6); color: white; border: none; backdrop-filter: blur(4px);" onclick="event.stopPropagation(); app.savePost('${p.id}')">
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                                        </button>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                ` : `
                    <div class="card" style="text-align:center; padding: 60px 20px;">
                        <div style="font-size: 48px; margin-bottom: 12px;"></div>
                        <p class="text-secondary">Nothing saved yet.</p>
                        <p class="text-secondary" style="font-size: 13px; margin-top: 6px;">Tap the bookmark icon on any post to save it here.</p>
                    </div>
                `}
            ` : ''}

            <!-- MENU TAB (mobile only) -->
            ${currentTab === 'menu' && isMe ? `
                <div class="card" style="padding: 16px;">
                    <h3 style="font-size: 20px; font-weight: 700; margin-bottom: 16px;">Menu</h3>
                    <div class="menu-list">
                        <div class="menu-item" onclick="app.switchView('friends')">
                            <div class="menu-item-icon" style="background: var(--bg-tertiary);"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg></div>
                            <span>Friends</span>
                        </div>
                        <div class="menu-item" onclick="app.switchView('reels')">
                            <div class="menu-item-icon" style="background: var(--bg-tertiary);"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="4"></rect><path d="M10 9l5 3-5 3V9z"></path></svg></div>
                            <span>Reels</span>
                        </div>
                        <div class="menu-item" onclick="app.switchView('groups')">
                            <div class="menu-item-icon" style="background: var(--bg-tertiary);"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="7" r="4"></circle><path d="M17 11v2"></path><path d="M15 13h4"></path><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"></path></svg></div>
                            <span>Groups</span>
                        </div>
                        <div class="menu-item" onclick="app.switchView('jobs')">
                            <div class="menu-item-icon" style="background: var(--bg-tertiary);"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg></div>
                            <span>Jobs</span>
                        </div>
                        <div class="menu-item" onclick="app.switchView('watch')">
                            <div class="menu-item-icon" style="background: var(--bg-tertiary);"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg></div>
                            <span>Watch</span>
                        </div>
                        <div class="menu-item" onclick="app.switchView('events')">
                            <div class="menu-item-icon" style="background: var(--bg-tertiary);"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg></div>
                            <span>Events</span>
                        </div>
                        <div class="menu-item" onclick="app.switchProfileTab('${user.id}', 'saved')">
                            <div class="menu-item-icon" style="background: var(--bg-tertiary);"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg></div>
                            <span>Saved Items</span>
                        </div>
                    </div>
                    <div class="sidebar-divider" style="margin: 16px 0;"></div>
                    <div class="menu-list">
                        <div class="menu-item" onclick="app.switchView('settings')">
                            <div class="menu-item-icon" style="background: var(--bg-tertiary);"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg></div>
                            <span>Settings & Privacy</span>
                        </div>
                        <div class="menu-item" onclick="app.logout()">
                            <div class="menu-item-icon" style="background: var(--bg-tertiary);"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg></div>
                            <span>Log Out</span>
                        </div>
                    </div>
                </div>
            ` : ''}

        </div>
    `;
}


function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// ==========================================
// AD COMPONENT
// ==========================================
function renderAd(ad) {
    return `
    <div class="post-card" style="border: 1px solid var(--accent); position: relative; overflow: hidden;">
        <div style="position: absolute; top: 16px; right: 16px; background: rgba(255,107,53,0.15); color: var(--accent); padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid rgba(255,107,53,0.3);">Sponsored</div>
        <div class="post-header">
            <div class="avatar" style="background: var(--accent); color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px;">
                Ad
            </div>
            <div class="post-meta">
                <div class="post-author" style="font-size: 16px;">${escapeHtml(ad.title)}</div>
                <div class="post-time" style="color: var(--accent);">Promoted</div>
            </div>
        </div>
        <div class="post-content" style="padding-top: 4px;">
            <p>${escapeHtml(ad.body)}</p>
        </div>
        ${ad.image ? `<img src="${escapeHtml(ad.image)}" alt="Advertisement" style="width: 100%; max-height: 400px; object-fit: cover; display: block; border-bottom: 1px solid var(--border);">` : ''}
        ${ad.link ? `
        <div style="padding: 16px; text-align: center; border-bottom: 1px solid var(--border);">
            <a href="${escapeHtml(ad.link)}" target="_blank" style="display: inline-block; background: var(--accent); color: white; padding: 10px 24px; border-radius: 8px; font-weight: 600; text-decoration: none; transition: transform 0.2s;">
                Learn More
            </a>
        </div>
        ` : ''}
    </div>
    `;
}

