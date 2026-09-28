/* =========================================================
   Mukaputa Admin Dashboard — admin.js
   ========================================================= */

// ── Auth guard ──────────────────────────────────────────────
(async () => {
    try {
        const res = await fetch('/api/admin/me', { credentials: 'include' });
        const data = await res.json();
        if (!data.ok) {
            window.location.href = '/admin_login.html';
            return;
        }
        const uname = data.username || 'Admin';
        document.getElementById('admin-username').textContent = uname;
        document.getElementById('admin-avatar-initials').textContent = uname[0].toUpperCase();
    } catch (_) {
        window.location.href = '/admin_login.html';
    }
})();

// ── Utility ─────────────────────────────────────────────────
function toast(msg, type = 'success') {
    const container = document.getElementById('adm-toast-container');
    const el = document.createElement('div');
    el.className = `adm-toast ${type}`;
    el.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            ${type === 'success'
                ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'
                : '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'}
        </svg>
        <span>${msg}</span>`;
    container.appendChild(el);
    setTimeout(() => el.remove(), 4000);
}

function escHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function fmtDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

async function api(method, path, body) {
    const opts = { method, credentials: 'include', headers: {} };
    if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    const res = await fetch('/api/admin' + path, opts);
    return res.json();
}

// ── Navigation ───────────────────────────────────────────────
const PAGE_TITLES = { dashboard: 'Dashboard', users: 'User Management', reports: 'Content Reports', ads: 'Advertisements', tickets: 'Help Tickets' };

function showPage(name, el) {
    document.querySelectorAll('.adm-page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.adm-nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('page-' + name).classList.add('active');
    if (el) el.classList.add('active');
    document.getElementById('topbar-title').textContent = PAGE_TITLES[name] || name;

    // Lazy-load page data
    if (name === 'dashboard') loadStats();
    if (name === 'users') loadUsers(1);
    if (name === 'reports') loadReports(1);
    if (name === 'ads') loadAds();
    if (name === 'tickets') fetchTickets();

    closeSidebar();
}

// ── Sidebar (mobile) ────────────────────────────────────────
function toggleSidebar() {
    document.getElementById('adm-sidebar').classList.toggle('open');
    document.getElementById('adm-overlay').classList.toggle('open');
}
function closeSidebar() {
    document.getElementById('adm-sidebar').classList.remove('open');
    document.getElementById('adm-overlay').classList.remove('open');
}

// ── Logout ───────────────────────────────────────────────────
async function doLogout() {
    await api('POST', '/logout');
    window.location.href = '/admin_login.html';
}

// ── Pagination helper ────────────────────────────────────────
function renderPagination(containerId, currentPage, totalPages, loadFn) {
    const el = document.getElementById(containerId);
    if (!el) return;
    let html = '';
    html += `<button class="adm-page-btn" ${currentPage === 1 ? 'disabled' : ''} onclick="${loadFn}(${currentPage - 1})">‹</button>`;
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);
    for (let i = start; i <= end; i++) {
        html += `<button class="adm-page-btn ${i === currentPage ? 'active' : ''}" onclick="${loadFn}(${i})">${i}</button>`;
    }
    html += `<button class="adm-page-btn" ${currentPage === totalPages ? 'disabled' : ''} onclick="${loadFn}(${currentPage + 1})">›</button>`;
    el.innerHTML = html;
}

// ── DASHBOARD ────────────────────────────────────────────────
async function loadStats() {
    const grid = document.getElementById('stats-grid');
    grid.innerHTML = '<p style="color:var(--adm-text-muted);font-size:13px;">Loading…</p>';
    const data = await api('GET', '/stats');
    if (!data.ok) { grid.innerHTML = '<p style="color:var(--adm-danger);font-size:13px;">Failed to load stats.</p>'; return; }
    const s = data.stats;
    const cards = [
        { label: 'Total Users', value: s.totalUsers, color: '#3b82f6', icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>' },
        { label: 'Active Users', value: s.activeUsers, color: '#22c55e', icon: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>' },
        { label: 'Total Posts', value: s.totalPosts, color: '#ff6b35', icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/>' },
        { label: 'Total Reels', value: s.totalReels, color: '#a855f7', icon: '<circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/>' },
        { label: 'Pending Reports', value: s.pendingReports, color: '#ef4444', icon: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>' },
        { label: 'Active Ads', value: s.activeAds, color: '#f59e0b', icon: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>' },
    ];

    // Update badge
    if (s.pendingReports > 0) {
        const badge = document.getElementById('reports-badge');
        badge.textContent = s.pendingReports;
        badge.style.display = '';
    }

    grid.innerHTML = cards.map(c => `
        <div class="adm-stat-card">
            <div class="adm-stat-card-icon" style="background:${c.color}22;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${c.color}" stroke-width="2">${c.icon}</svg>
            </div>
            <div class="adm-stat-card-value">${c.value.toLocaleString()}</div>
            <div class="adm-stat-card-label">${c.label}</div>
        </div>
    `).join('');
}

// ── USERS ────────────────────────────────────────────────────
let _userPage = 1;
let _userSearchTimer = null;

function debounceUserSearch() {
    clearTimeout(_userSearchTimer);
    _userSearchTimer = setTimeout(() => loadUsers(1), 400);
}

async function loadUsers(page = 1) {
    _userPage = page;
    const tbody = document.getElementById('users-tbody');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--adm-text-muted);">Loading…</td></tr>';
    const q = document.getElementById('user-search').value.trim();
    const params = new URLSearchParams({ page, per_page: 20, ...(q ? { q } : {}) });
    const data = await api('GET', `/users?${params}`);
    if (!data.ok || !data.users.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--adm-text-muted);">No users found.</td></tr>';
        document.getElementById('users-pagination').innerHTML = '';
        return;
    }
    tbody.innerHTML = data.users.map(u => `
        <tr>
            <td>
                <div class="adm-user-cell">
                    ${u.avatar
                        ? `<img class="adm-avatar" src="${escHtml(u.avatar)}" onerror="this.style.display='none'">`
                        : `<div class="adm-avatar" style="display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:var(--adm-accent);">${escHtml((u.name||'?')[0].toUpperCase())}</div>`}
                    <span>${escHtml(u.name)}</span>
                </div>
            </td>
            <td>@${escHtml(u.username)}</td>
            <td>${escHtml(u.email)}</td>
            <td>
                <span class="adm-status ${u.isActive ? 'adm-status-active' : 'adm-status-banned'}">
                    ${u.isActive ? 'Active' : 'Banned'}
                </span>
            </td>
            <td>${fmtDate(u.createdAt)}</td>
            <td>
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                    ${u.isActive
                        ? `<button class="adm-btn adm-btn-warn adm-btn-sm" onclick="banUser('${u.id}','${escHtml(u.username)}')">Ban</button>`
                        : `<button class="adm-btn adm-btn-success adm-btn-sm" onclick="unbanUser('${u.id}','${escHtml(u.username)}')">Unban</button>`}
                    <button class="adm-btn adm-btn-danger adm-btn-sm" onclick="deleteUser('${u.id}','${escHtml(u.username)}')">Delete</button>
                </div>
            </td>
        </tr>
    `).join('');
    renderPagination('users-pagination', page, data.pages, 'loadUsers');
}

async function banUser(id, username) {
    if (!confirm(`Ban user @${username}? They will not be able to log in.`)) return;
    const data = await api('PUT', `/users/${id}/ban`);
    if (data.ok) { toast(`@${username} banned.`, 'success'); loadUsers(_userPage); }
    else toast(data.error || 'Failed.', 'error');
}

async function unbanUser(id, username) {
    const data = await api('PUT', `/users/${id}/unban`);
    if (data.ok) { toast(`@${username} unbanned.`, 'success'); loadUsers(_userPage); }
    else toast(data.error || 'Failed.', 'error');
}

async function deleteUser(id, username) {
    if (!confirm(`Permanently delete @${username} and all their content? This cannot be undone.`)) return;
    const data = await api('DELETE', `/users/${id}`);
    if (data.ok) { toast(`@${username} deleted.`, 'success'); loadUsers(_userPage); }
    else toast(data.error || 'Failed.', 'error');
}

// ── REPORTS ──────────────────────────────────────────────────
let _reportPage = 1;

async function loadReports(page = 1) {
    _reportPage = page;
    const tbody = document.getElementById('reports-tbody');
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--adm-text-muted);">Loading…</td></tr>';
    const status = document.getElementById('report-status-filter').value;
    const params = new URLSearchParams({ page, per_page: 20, status });
    const data = await api('GET', `/reports?${params}`);
    if (!data.ok || !data.reports.length) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--adm-text-muted);">No reports found.</td></tr>';
        document.getElementById('reports-pagination').innerHTML = '';
        return;
    }
    window.currentReports = data.reports;
    tbody.innerHTML = data.reports.map(r => `
        <tr>
            <td>
                <div class="adm-user-cell">
                    <span>${escHtml(r.reporterName)}<br><small style="color:var(--adm-text-muted);">@${escHtml(r.reporterUsername)}</small></span>
                </div>
            </td>
            <td><span style="text-transform:capitalize;">${escHtml(r.contentType)}</span></td>
            <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(r.contentPreview || '—')}</td>
            <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(r.reason)}</td>
            <td><span class="adm-status adm-status-${r.status}">${r.status}</span></td>
            <td>${fmtDate(r.createdAt)}</td>
            <td>
                <div style="display:flex;gap:4px;flex-wrap:wrap;">
                    <button class="adm-btn adm-btn-sm" style="background:var(--adm-info);color:white;" onclick="viewReportContent('${r.id}')">View</button>
                    ${r.status === 'pending' ? `
                    <button class="adm-btn adm-btn-danger adm-btn-sm" onclick="handleReport('${r.id}','remove_content')">Remove</button>
                    <button class="adm-btn adm-btn-warn adm-btn-sm" onclick="handleReport('${r.id}','warn')">Warn</button>
                    <button class="adm-btn adm-btn-sm" style="background:var(--adm-surface2);color:var(--adm-text-muted);" onclick="handleReport('${r.id}','dismiss')">Dismiss</button>
                    ` : '<span style="color:var(--adm-text-muted);font-size:12px;display:flex;align-items:center;">Resolved</span>'}
                </div>
            </td>
        </tr>
    `).join('');
    renderPagination('reports-pagination', page, data.pages, 'loadReports');
}

function viewReportContent(id) {
    const r = window.currentReports.find(x => x.id === id);
    if (!r) return;
    let mediaHtml = '';
    try {
        if (r.contentMedia && r.contentMedia !== '[]') {
            const mediaList = r.contentType === 'post' ? JSON.parse(r.contentMedia) : [{url: r.contentMedia, type: 'video/mp4'}];
            mediaHtml = mediaList.map(m => {
                if (m.type && m.type.startsWith('video')) return `<video src="${m.url}" controls style="max-width:100%; max-height: 400px; margin-bottom: 10px; border-radius:8px;"></video>`;
                return `<img src="${m.url}" style="max-width:100%; max-height: 400px; object-fit:contain; margin-bottom: 10px; border-radius:8px;">`;
            }).join('');
        }
    } catch(e) {}
    
    // Create or reuse modal
    let modal = document.getElementById('report-content-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'report-content-modal';
        modal.className = 'adm-modal-backdrop';
        modal.innerHTML = `
            <div class="adm-modal" style="max-width: 600px;">
                <button class="adm-modal-close" onclick="document.getElementById('report-content-modal').classList.remove('open')">&times;</button>
                <h3 class="adm-modal-title">Reported Content</h3>
                <div id="report-content-body" style="font-size: 15px; line-height: 1.5; color: var(--adm-text);"></div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    document.getElementById('report-content-body').innerHTML = `
        <div style="padding: 10px; background: var(--adm-surface2); border-radius: 8px; margin-bottom: 16px;">
            ${r.contentPreview ? escHtml(r.contentPreview).replace(/\\n/g, '<br>') : '<em>No text</em>'}
        </div>
        ${mediaHtml}
    `;
    modal.classList.add('open');
}

async function handleReport(id, action) {
    const labels = { remove_content: 'remove the reported content', warn: 'mark as reviewed/warned', dismiss: 'dismiss this report' };
    if (!confirm(`Are you sure you want to ${labels[action]}?`)) return;
    const data = await api('PUT', `/reports/${id}`, { action });
    if (data.ok) { toast('Report updated.', 'success'); loadReports(_reportPage); loadStats(); }
    else toast(data.error || 'Failed.', 'error');
}

// ── ADS ──────────────────────────────────────────────────────
async function loadAds() {
    const grid = document.getElementById('ads-grid');
    grid.innerHTML = '<p style="color:var(--adm-text-muted);font-size:13px;">Loading…</p>';
    const data = await api('GET', '/ads');
    if (!data.ok) { grid.innerHTML = '<p style="color:var(--adm-danger);font-size:13px;">Failed to load ads.</p>'; return; }
    if (!data.ads.length) {
        grid.innerHTML = `<div class="adm-empty"><p>No ads yet. Click "New Ad" to create one.</p></div>`;
        return;
    }
    grid.innerHTML = data.ads.map(ad => `
        <div class="adm-ad-card">
            ${ad.image
                ? `<img class="adm-ad-image" src="${escHtml(ad.image)}" alt="${escHtml(ad.title)}" onerror="this.style.display='none'">`
                : `<div class="adm-ad-image-placeholder">No image</div>`}
            <div class="adm-ad-body">
                <div class="adm-ad-title">${escHtml(ad.title)}</div>
                ${ad.body ? `<div class="adm-ad-text">${escHtml(ad.body)}</div>` : ''}
                <div class="adm-ad-meta">
                    <span class="adm-status ${ad.isActive ? 'adm-status-active' : 'adm-status-dismissed'}">${ad.isActive ? 'Active' : 'Inactive'}</span>
                    <span style="font-size:11px;color:var(--adm-text-muted);text-transform:capitalize;">${escHtml(ad.placement)}</span>
                </div>
                <div class="adm-ad-actions">
                    <button class="adm-btn adm-btn-primary adm-btn-sm" onclick="openAdModal(${JSON.stringify(ad).replace(/"/g, '&quot;')})">Edit</button>
                    <button class="adm-btn adm-btn-danger adm-btn-sm" onclick="deleteAd('${ad.id}','${escHtml(ad.title)}')">Delete</button>
                </div>
            </div>
        </div>
    `).join('');
}

function openAdModal(ad) {
    document.getElementById('ad-modal-title').textContent = ad ? 'Edit Advertisement' : 'New Advertisement';
    document.getElementById('ad-modal-id').value = ad ? ad.id : '';
    document.getElementById('ad-title').value = ad ? ad.title : '';
    document.getElementById('ad-body').value = ad ? ad.body : '';
    document.getElementById('ad-image').value = ad ? ad.image : '';
    document.getElementById('ad-link').value = ad ? ad.link : '';
    document.getElementById('ad-placement').value = ad ? ad.placement : 'feed';
    document.getElementById('ad-active').checked = ad ? ad.isActive : true;
    document.getElementById('ad-modal-backdrop').classList.add('open');
    document.getElementById('ad-title').focus();
}

function closeAdModal() {
    document.getElementById('ad-modal-backdrop').classList.remove('open');
}

function closeAdModalOnBackdrop(e) {
    if (e.target === document.getElementById('ad-modal-backdrop')) closeAdModal();
}

async function saveAd() {
    const id = document.getElementById('ad-modal-id').value;
    const title = document.getElementById('ad-title').value.trim();
    if (!title) { toast('Title is required.', 'error'); return; }
    const payload = {
        title,
        body: document.getElementById('ad-body').value.trim(),
        image: document.getElementById('ad-image').value.trim(),
        link: document.getElementById('ad-link').value.trim(),
        placement: document.getElementById('ad-placement').value,
        isActive: document.getElementById('ad-active').checked,
    };
    let data;
    if (id) {
        data = await api('PUT', `/ads/${id}`, payload);
    } else {
        data = await api('POST', '/ads', payload);
    }
    if (data.ok) {
        toast(id ? 'Ad updated.' : 'Ad created.', 'success');
        closeAdModal();
        loadAds();
    } else {
        toast(data.error || 'Failed to save ad.', 'error');
    }
}

async function deleteAd(id, title) {
    if (!confirm(`Delete ad "${title}"?`)) return;
    const data = await api('DELETE', `/ads/${id}`);
    if (data.ok) { toast('Ad deleted.', 'success'); loadAds(); }
    else toast(data.error || 'Failed.', 'error');
}

// ── Init ─────────────────────────────────────────────────────
loadStats();


// ==========================================
// SUPPORT TICKETS
// ==========================================
let allTickets = [];

async function fetchTickets() {
    const res = await api('GET', '/tickets');
    if (res && res.tickets) {
        allTickets = res.tickets;
        renderTickets();
    }
}

function renderTickets() {
    const tbody = document.getElementById('tickets-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    // Update badge
    const openCount = allTickets.filter(t => t.status === 'Open').length;
    const badge = document.getElementById('tickets-badge');
    if (badge) {
        badge.textContent = openCount;
        badge.style.display = openCount > 0 ? 'inline-block' : 'none';
    }

    if (allTickets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No support tickets.</td></tr>';
        return;
    }

    allTickets.forEach(t => {
        const tr = document.createElement('tr');
        const badgeClass = t.status === 'Open' ? 'adm-badge-warn' : 'adm-badge-ok';
        
        tr.innerHTML = `
            <td>${new Date(t.createdAt).toLocaleDateString()}</td>
            <td><strong>${t.userName}</strong></td>
            <td>${t.subject}</td>
            <td><span class="adm-badge ${badgeClass}">${t.status}</span></td>
            <td>
                <button class="adm-btn adm-btn-sm" onclick="openReplyModal('${t.id}')">View & Reply</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function openReplyModal(ticketId) {
    const t = allTickets.find(x => x.id === ticketId);
    if (!t) return;
    
    document.getElementById('reply-ticket-id').value = t.id;
    document.getElementById('ticket-status-select').value = t.status;
    document.getElementById('ticket-reply-text').value = t.reply || '';
    
    document.getElementById('ticket-details').innerHTML = `
        <div style="margin-bottom: 8px;"><strong>User:</strong> ${t.userName}</div>
        <div style="margin-bottom: 8px;"><strong>Subject:</strong> ${t.subject}</div>
        <div style="white-space: pre-wrap;"><strong>Message:</strong><br>${t.message}</div>
    `;
    
    document.getElementById('ticket-modal').style.display = 'flex';
}

async function submitTicketReply() {
    const id = document.getElementById('reply-ticket-id').value;
    const replyText = document.getElementById('ticket-reply-text').value;
    const status = document.getElementById('ticket-status-select').value;
    
    const res = await api('POST', `/tickets/${id}/reply`, {
        reply: replyText,
        status: status
    });
    
    if (res && res.ticket) {
        document.getElementById('ticket-modal').style.display = 'none';
        fetchTickets();
        toast('Ticket updated successfully!', 'success');
    } else {
        toast('Failed to update ticket', 'error');
    }
}


