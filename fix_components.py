import io
import re

with io.open("frontend/js/components.js", "r", encoding="utf-8") as f:
    content = f.read()

# Fix getReactionEmoji
content = re.sub(
    r"function getReactionEmoji\(type\) \{.*?\}",
    """function getReactionEmoji(type) {
    switch (type) {
        case 'like': return '??';
        case 'love': return '??';
        case 'haha': return '??';
        case 'wow': return '??';
        case 'sad': return '??';
        case 'angry': return '??';
        default: return '??';
    }
}""",
    content,
    flags=re.DOTALL
)

# Fix profile about tab icons
content = content.replace(
    """<div style="display: flex; flex-direction: column; gap: 10px; font-size: 14px; color: var(--text-secondary);">
                                ${user.work ? `<div style="display: flex; align-items: center; gap: 8px;"> <span>Works at <strong style="color: var(--text-primary);">${escapeHtml(user.work)}</strong></span></div>` : ''}
                                ${user.education ? `<div style="display: flex; align-items: center; gap: 8px;"> <span>Studied at <strong style="color: var(--text-primary);">${escapeHtml(user.education)}</strong></span></div>` : ''}
                                <div style="display: flex; align-items: center; gap: 8px;"> <span>Lives in <strong style="color: var(--text-primary);">${user.location || 'San Francisco, CA'}</strong></span></div>
                                <div style="display: flex; align-items: center; gap: 8px;"> <span><strong style="color: var(--text-primary);">${user.joined || 'Joined 2022'}</strong></span></div>
                                ${isMe ? `<button class="btn btn-secondary btn-sm full-width" style="margin-top: 6px;" onclick="app.openEditProfileModal()"> Edit details</button>` : ''}
                            </div>""",
    """<div style="display: flex; flex-direction: column; gap: 10px; font-size: 14px; color: var(--text-secondary);">
                                ${user.work ? `<div style="display: flex; align-items: center; gap: 8px;">?? <span>Works at <strong style="color: var(--text-primary);">${escapeHtml(user.work)}</strong></span></div>` : ''}
                                ${user.education ? `<div style="display: flex; align-items: center; gap: 8px;">?? <span>Studied at <strong style="color: var(--text-primary);">${escapeHtml(user.education)}</strong></span></div>` : ''}
                                <div style="display: flex; align-items: center; gap: 8px;">?? <span>Lives in <strong style="color: var(--text-primary);">${user.location || 'San Francisco, CA'}</strong></span></div>
                                <div style="display: flex; align-items: center; gap: 8px;">??? <span><strong style="color: var(--text-primary);">${user.joined || 'Joined 2022'}</strong></span></div>
                                ${isMe ? `<button class="btn btn-secondary btn-sm full-width" style="margin-top: 6px;" onclick="app.openEditProfileModal()">?? Edit details</button>` : ''}
                            </div>"""
)

content = content.replace(
    """<div class="profile-about-item">
                            <div class="profile-about-icon"></div>
                            <div>
                                <div class="profile-about-title">Work</div>
                                <div class="profile-about-desc">${escapeHtml(user.work || 'Add your workplace')}</div>
                            </div>
                        </div>""",
    """<div class="profile-about-item">
                            <div class="profile-about-icon">??</div>
                            <div>
                                <div class="profile-about-title">Work</div>
                                <div class="profile-about-desc">${escapeHtml(user.work || 'Add your workplace')}</div>
                            </div>
                        </div>"""
)
content = content.replace(
    """<div class="profile-about-item">
                            <div class="profile-about-icon"></div>
                            <div>
                                <div class="profile-about-title">Education</div>
                                <div class="profile-about-desc">${escapeHtml(user.education || 'Add your school/university')}</div>
                            </div>
                        </div>""",
    """<div class="profile-about-item">
                            <div class="profile-about-icon">??</div>
                            <div>
                                <div class="profile-about-title">Education</div>
                                <div class="profile-about-desc">${escapeHtml(user.education || 'Add your school/university')}</div>
                            </div>
                        </div>"""
)
content = content.replace(
    """<div class="profile-about-item">
                            <div class="profile-about-icon"></div>
                            <div>
                                <div class="profile-about-title">Places lived</div>
                                <div class="profile-about-desc">${escapeHtml(user.location || 'Add your current city')}</div>
                            </div>
                        </div>""",
    """<div class="profile-about-item">
                            <div class="profile-about-icon">??</div>
                            <div>
                                <div class="profile-about-title">Places lived</div>
                                <div class="profile-about-desc">${escapeHtml(user.location || 'Add your current city')}</div>
                            </div>
                        </div>"""
)
content = content.replace(
    """<div class="profile-about-item">
                            <div class="profile-about-icon"></div>
                            <div>
                                <div class="profile-about-title">Joined</div>
                                <div class="profile-about-desc">${user.joined || '2022'}</div>
                            </div>
                        </div>""",
    """<div class="profile-about-item">
                            <div class="profile-about-icon">???</div>
                            <div>
                                <div class="profile-about-title">Joined</div>
                                <div class="profile-about-desc">${user.joined || '2022'}</div>
                            </div>
                        </div>"""
)

# Saved tab lock icon
content = content.replace(
    """<p class="text-secondary" style="font-size: 13px; margin-bottom: 16px;"> ${savedPosts.length} saved item${savedPosts.length !== 1 ? 's' : ''} - only visible to you</p>""",
    """<p class="text-secondary" style="font-size: 13px; margin-bottom: 16px;">?? ${savedPosts.length} saved item${savedPosts.length !== 1 ? 's' : ''} - only visible to you</p>"""
)

# Profile User icon
content = content.replace(
    """<div style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></div>
                <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 8px;">User not found</h2>""",
    """<div style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;">??</div>
                <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 8px;">User not found</h2>"""
)

# Empty Feed User icon
content = content.replace(
    """<div class="card" style="text-align:center; padding: 48px 20px;">
                               <div style="font-size: 40px; margin-bottom: 12px;"></div>
                               <p class="text-secondary">No posts yet${isMe ? '. Share something!' : '.'}</p>""",
    """<div class="card" style="text-align:center; padding: 48px 20px;">
                               <div style="font-size: 40px; margin-bottom: 12px;">??</div>
                               <p class="text-secondary">No posts yet${isMe ? '. Share something!' : '.'}</p>"""
)

# Post Feeling emoji rendering
content = content.replace(
    """const feelingHtml = post.feeling 
        ? `<span style="font-weight: normal; color: var(--text-secondary);"> is ${post.feeling}</span>` 
        : '';""",
    """const feelingHtml = post.feeling 
        ? `<span style="font-weight: normal; color: var(--text-secondary);"> is ?? ${post.feeling}</span>` 
        : '';"""
)

with io.open("frontend/js/components.js", "w", encoding="utf-8") as f:
    f.write(content)
print("Updated components.js")
