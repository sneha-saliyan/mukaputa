import io
with io.open('frontend/js/components.js', 'r', encoding='utf-8') as f:
    content = f.read()

target = """    if (user.isBlockedPlaceholder) {
        return `
            <div class="card" style="text-align: center; padding: 60px 20px; margin-top: 20px;">
                <div style="font-size: 48px; margin-bottom: 16px;">??</div>
                <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 8px;">Content Unavailable</h2>
                <p style="color: var(--text-secondary); margin-bottom: 24px;">This account cannot be found or is unavailable.</p>
                <button class="btn btn-primary" onclick="app.switchView('home')">Go to Home</button>
            </div>
        `;
    }"""

replacement = """    if (user.isBlockedPlaceholder) {
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
    }"""

if target in content:
    content = content.replace(target, replacement)
    with io.open('frontend/js/components.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print('Replaced successfully')
else:
    print('Target not found')
