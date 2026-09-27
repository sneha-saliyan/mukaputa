// ============================================================================
// Calls -- real, working 1:1 voice & video calling.
//
// Media (audio/video) flows directly between the two browsers via WebRTC.
// The server only relays a handful of small signaling messages over a
// WebSocket (Socket.IO) so each side can find the other: "ring", "I picked
// up", and the SDP/ICE handshake info WebRTC needs to connect.
//
// Note: this uses public STUN servers only (no TURN relay is bundled), so
// it works great on most home/office networks. Very restrictive networks
// (some corporate firewalls, certain mobile carriers) may need a TURN
// server to connect -- see the README for details.
// ============================================================================
const Calls = {
    socket: null,
    pc: null,
    localStream: null,
    remoteStream: null,
    pendingCandidates: [],
    currentCall: null,     // { callId, otherUserId, otherName, otherAvatar, video, isCaller, status }
    ringInterval: null,
    ringCtx: null,
    timerInterval: null,
    callStartedAt: null,
    ringTimeout: null,
    muted: false,
    cameraOff: false,

    ICE_SERVERS: [
        {
            urls: "stun:stun.relay.metered.ca:80",
        },
        {
            urls: "turn:in.relay.metered.ca:80",
            username: "8acfb7cd2189a63d00758a79",
            credential: "vHE5l9sYtVDMotP9",
        },
        {
            urls: "turn:in.relay.metered.ca:80?transport=tcp",
            username: "8acfb7cd2189a63d00758a79",
            credential: "vHE5l9sYtVDMotP9",
        },
        {
            urls: "turn:in.relay.metered.ca:443",
            username: "8acfb7cd2189a63d00758a79",
            credential: "vHE5l9sYtVDMotP9",
        },
        {
            urls: "turns:in.relay.metered.ca:443?transport=tcp",
            username: "8acfb7cd2189a63d00758a79",
            credential: "vHE5l9sYtVDMotP9",
        },
    ],
    RING_TIMEOUT_MS: 35000,
    libAvailable: true,

    init() {
        if (typeof io === 'undefined') {
            this.libAvailable = false;
            console.error('Socket.IO client failed to load -- calling and live signaling will be unavailable.');
            // Visible (not just console-only) so this isn't a silent, confusing dead end.
            if (typeof app !== 'undefined' && app.showToast) {
                app.showToast('Calling is unavailable: the real-time connection script failed to load. Try reloading the page.', 'danger');
            }
            return;
        }

        this.socket = io({
            withCredentials: true,
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000
        });

        this.socket.on('connect', () => {
            console.log('[Calls] connected to real-time server');
            if (typeof app !== 'undefined' && app.showToast) app.showToast('Call Server Connected!', 'success');
        });
        this.socket.on('disconnect', (reason) => {
            console.warn('[Calls] disconnected:', reason);
            if (typeof app !== 'undefined' && app.showToast) app.showToast('Call Server Disconnected: ' + reason, 'danger');
        });
        this.socket.on('connect_error', (err) => {
            console.error('[Calls] connection error:', err && err.message);
            if (typeof app !== 'undefined' && app.showToast) app.showToast('Call Server Error: ' + err.message, 'danger');
        });

        this.socket.on('call:incoming', (data) => this.onIncoming(data));
        this.socket.on('call:accepted', (data) => this.onAccepted(data));
        this.socket.on('call:declined', (data) => this.onDeclined(data));
        this.socket.on('call:cancelled', (data) => this.onCancelled(data));
        this.socket.on('call:ended', (data) => this.onRemoteEnded(data));
        this.socket.on('call:unavailable', (data) => this.onUnavailable(data));
        this.socket.on('call:signal', (data) => this.onSignal(data));
        this.socket.on('call:debug', (data) => {
            if (typeof app !== 'undefined' && app.showToast) app.showToast(data.message, 'info');
        });
    },

    // Resolves true once the socket is actually connected, waiting briefly
    // for an in-flight connection attempt instead of failing immediately
    // (the socket is still connecting for a moment right after page load).
    waitForConnection(timeoutMs = 4000) {
        return new Promise((resolve) => {
            if (this.socket && this.socket.connected) { resolve(true); return; }
            if (!this.socket) { resolve(false); return; }

            let settled = false;
            const onConnect = () => { if (!settled) { settled = true; cleanup(); resolve(true); } };
            const timer = setTimeout(() => { if (!settled) { settled = true; cleanup(); resolve(false); } }, timeoutMs);
            const cleanup = () => { clearTimeout(timer); this.socket.off('connect', onConnect); };

            this.socket.once('connect', onConnect);
            if (!this.socket.connected) this.socket.connect();
        });
    },

    // ------------------------------------------------------------------
    // Starting / receiving calls
    // ------------------------------------------------------------------
    async start(otherUserId, type = 'audio') {
        if (this.currentCall) {
            app.showToast("You're already in a call.", 'danger');
            return;
        }
        if (!this.libAvailable) {
            app.showToast('Calling is unavailable: the real-time connection script failed to load. Try reloading the page.', 'danger');
            return;
        }
        const isConnected = await this.waitForConnection();
        if (!isConnected) {
            app.showToast('Could not reach the server for calling. Check your connection and try again.', 'danger');
            return;
        }

        const video = type === 'video';
        const other = store.getUser(otherUserId);
        const callId = 'call_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error("SecureContextRequired");
            }
            this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: video });
        } catch (e) {
            if (e.message === "SecureContextRequired") {
                app.showToast('Calling requires HTTPS or localhost. Try using chrome://flags to bypass for local testing.', 'danger', 5000);
            } else {
                app.showToast(video ? 'Could not access your camera/microphone.' : 'Could not access your microphone.', 'danger');
            }
            return;
        }

        this.currentCall = { callId, otherUserId, otherName: other.name, otherAvatar: other.avatar, video, isCaller: true, status: 'calling' };
        this.showOutgoingUI();
        this.socket.emit('call:invite', { 
            toUserId: otherUserId, 
            callId, 
            video,
            fromUserId: store.getCurrentUser().id,
            fromName: store.getCurrentUser().name,
            fromAvatar: store.getCurrentUser().avatar
        });

        this.ringTimeout = setTimeout(() => {
            if (this.currentCall && this.currentCall.status === 'calling') {
                app.showToast('No answer.', 'info');
                this.socket.emit('call:cancel', { toUserId: otherUserId, callId });
                this.logCall('missed');
                this.cleanup();
            }
        }, this.RING_TIMEOUT_MS);
    },

    onIncoming(data) {
        console.log('[Calls] Incoming call signal received!', data);
        if (typeof app !== 'undefined' && app.showToast) app.showToast('Call signal received!', 'info');

        if (this.currentCall) {
            this.socket.emit('call:decline', { toUserId: data.fromUserId, callId: data.callId });
            return;
        }
        this.currentCall = {
            callId: data.callId, otherUserId: data.fromUserId,
            otherName: data.fromName, otherAvatar: data.fromAvatar,
            video: !!data.video, isCaller: false, status: 'ringing'
        };
        this.playRingtone();
        this.showIncomingUI();

        this.ringTimeout = setTimeout(() => {
            if (this.currentCall && this.currentCall.status === 'ringing') {
                this.decline();
            }
        }, this.RING_TIMEOUT_MS);
    },

    async accept() {
        if (!this.currentCall) return;
        clearTimeout(this.ringTimeout);
        this.stopRingtone();

        const { video, otherUserId, callId } = this.currentCall;
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error("SecureContextRequired");
            }
            this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: video });
        } catch (e) {
            if (e.message === "SecureContextRequired") {
                app.showToast('Browser blocked camera access due to insecure HTTP IP connection.', 'danger', 5000);
            } else {
                app.showToast(video ? 'Could not access your camera/microphone.' : 'Could not access your microphone.', 'danger');
            }
            this.socket.emit('call:decline', { toUserId: otherUserId, callId });
            this.cleanup();
            return;
        }

        this.currentCall.status = 'connecting';
        this.setupPeerConnection();
        this.addLocalTracks();
        this.showActiveUI();
        this.socket.emit('call:accept', { toUserId: otherUserId, callId });
        // The caller creates the SDP offer once they see call:accepted, and
        // sends it to us via call:signal (handled in onSignal below).
    },

    decline() {
        clearTimeout(this.ringTimeout);
        this.stopRingtone();
        if (this.currentCall) {
            this.socket.emit('call:decline', { toUserId: this.currentCall.otherUserId, callId: this.currentCall.callId });
            this.logCall('declined');
        }
        this.cleanup();
    },

    cancelOutgoing() {
        clearTimeout(this.ringTimeout);
        if (this.currentCall) {
            this.socket.emit('call:cancel', { toUserId: this.currentCall.otherUserId, callId: this.currentCall.callId });
            this.logCall('cancelled');
        }
        this.cleanup();
    },

    end() {
        if (this.currentCall) {
            this.socket.emit('call:end', { toUserId: this.currentCall.otherUserId, callId: this.currentCall.callId });
            this.logCall('completed');
        }
        this.cleanup();
    },

    // ------------------------------------------------------------------
    // Remote-triggered events (the other side did something)
    // ------------------------------------------------------------------
    async onAccepted(data) {
        if (!this.currentCall || data.callId !== this.currentCall.callId) return;
        clearTimeout(this.ringTimeout);
        this.currentCall.status = 'connecting';
        this.setupPeerConnection();
        this.addLocalTracks();
        this.showActiveUI();

        const offer = await this.pc.createOffer();
        await this.pc.setLocalDescription(offer);
        this.socket.emit('call:signal', {
            toUserId: this.currentCall.otherUserId, callId: this.currentCall.callId,
            signal: { kind: 'offer', sdp: offer.sdp }
        });
    },

    onDeclined(data) {
        if (!this.currentCall || data.callId !== this.currentCall.callId) return;
        app.showToast(`${this.currentCall.otherName} declined the call.`, 'info');
        this.cleanup();
    },

    onCancelled(data) {
        if (!this.currentCall || data.callId !== this.currentCall.callId) return;
        this.stopRingtone();
        app.showToast('The call was cancelled.', 'info');
        this.cleanup();
    },

    onUnavailable(data) {
        if (!this.currentCall || data.callId !== this.currentCall.callId) return;
        app.showToast(`${this.currentCall.otherName} isn't available right now.`, 'danger');
        this.cleanup();
    },

    onRemoteEnded(data) {
        if (!this.currentCall || data.callId !== this.currentCall.callId) return;
        app.showToast('Call ended', 'info');
        this.cleanup();
    },

    async onSignal(data) {
        if (!this.currentCall || data.callId !== this.currentCall.callId || !this.pc) return;
        const signal = data.signal;
        try {
            if (signal.kind === 'offer') {
                await this.pc.setRemoteDescription({ type: 'offer', sdp: signal.sdp });
                await this.flushPendingCandidates();
                const answer = await this.pc.createAnswer();
                await this.pc.setLocalDescription(answer);
                this.socket.emit('call:signal', {
                    toUserId: this.currentCall.otherUserId, callId: this.currentCall.callId,
                    signal: { kind: 'answer', sdp: answer.sdp }
                });
            } else if (signal.kind === 'answer') {
                await this.pc.setRemoteDescription({ type: 'answer', sdp: signal.sdp });
                await this.flushPendingCandidates();
            } else if (signal.kind === 'ice' && signal.candidate) {
                // Trickle ICE candidates can legitimately arrive before the
                // offer/answer exchange finishes on this side -- queue them
                // instead of risking an InvalidStateError from addIceCandidate.
                if (this.pc.remoteDescription && this.pc.remoteDescription.type) {
                    await this.pc.addIceCandidate(signal.candidate);
                } else {
                    this.pendingCandidates.push(signal.candidate);
                }
            }
        } catch (e) {
            console.error('WebRTC signal error:', e);
        }
    },

    // ------------------------------------------------------------------
    // WebRTC plumbing
    // ------------------------------------------------------------------
    setupPeerConnection() {
        this.pc = new RTCPeerConnection({ iceServers: this.ICE_SERVERS });
        this.remoteStream = new MediaStream();
        this.pendingCandidates = [];

        const remoteVideoEl = document.getElementById('call-remote-video');
        const remoteAudioEl = document.getElementById('call-remote-audio');
        if (remoteVideoEl) remoteVideoEl.srcObject = this.remoteStream;
        if (remoteAudioEl) remoteAudioEl.srcObject = this.remoteStream;

        this.pc.ontrack = (event) => {
            event.streams[0].getTracks().forEach(track => this.remoteStream.addTrack(track));
        };

        this.pc.onicecandidate = (event) => {
            if (event.candidate && this.currentCall) {
                this.socket.emit('call:signal', {
                    toUserId: this.currentCall.otherUserId, callId: this.currentCall.callId,
                    signal: { kind: 'ice', candidate: event.candidate.toJSON() }
                });
            }
        };

        this.pc.onconnectionstatechange = () => {
            if (!this.pc) return;
            if (this.pc.connectionState === 'connected' && this.currentCall && this.currentCall.status !== 'active') {
                this.currentCall.status = 'active';
                this.startTimer();
            } else if (['failed', 'disconnected'].includes(this.pc.connectionState) && this.currentCall) {
                app.showToast('Call connection lost.', 'danger');
                this.end();
            }
        };
    },

    async flushPendingCandidates() {
        if (!this.pc || this.pendingCandidates.length === 0) return;
        const queued = this.pendingCandidates.splice(0);
        for (const candidate of queued) {
            try { await this.pc.addIceCandidate(candidate); } catch (e) { console.error('Failed to add queued ICE candidate:', e); }
        }
    },

    addLocalTracks() {
        this.localStream.getTracks().forEach(track => this.pc.addTrack(track, this.localStream));
        const localVideoEl = document.getElementById('call-local-video');
        if (localVideoEl && this.currentCall.video) {
            localVideoEl.srcObject = this.localStream;
        }
    },

    toggleMute() {
        if (!this.localStream) return;
        this.muted = !this.muted;
        this.localStream.getAudioTracks().forEach(t => t.enabled = !this.muted);
        const btn = document.getElementById('call-mute-btn');
        if (btn) btn.classList.toggle('active-state', this.muted);
    },

    toggleCamera() {
        if (!this.localStream) return;
        this.cameraOff = !this.cameraOff;
        this.localStream.getVideoTracks().forEach(t => t.enabled = !this.cameraOff);
        const btn = document.getElementById('call-camera-btn');
        if (btn) btn.classList.toggle('active-state', this.cameraOff);
    },

    async toggleScreenShare() {
        if (!this.localStream || !this.pc) return;
        try {
            if (!this.isScreenSharing) {
                this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                const screenTrack = this.screenStream.getVideoTracks()[0];
                const sender = this.pc.getSenders().find(s => s.track && s.track.kind === 'video');
                if (sender) await sender.replaceTrack(screenTrack);
                const localVideo = document.getElementById('call-local-video');
                if (localVideo) localVideo.srcObject = new MediaStream([screenTrack]);
                
                this.isScreenSharing = true;
                const btn = document.getElementById('call-screen-btn');
                if (btn) btn.classList.add('active-state');

                screenTrack.onended = () => { if (this.isScreenSharing) this.toggleScreenShare(); };
            } else {
                const cameraTrack = this.localStream.getVideoTracks()[0];
                const sender = this.pc.getSenders().find(s => s.track && s.track.kind === 'video');
                if (sender) await sender.replaceTrack(cameraTrack);
                const localVideo = document.getElementById('call-local-video');
                if (localVideo) localVideo.srcObject = this.localStream;
                
                if (this.screenStream) {
                    this.screenStream.getTracks().forEach(t => t.stop());
                    this.screenStream = null;
                }
                this.isScreenSharing = false;
                const btn = document.getElementById('call-screen-btn');
                if (btn) btn.classList.remove('active-state');
            }
        } catch (e) { console.error('Screen sharing error:', e); }
    },

    // ------------------------------------------------------------------
    // UI
    // ------------------------------------------------------------------
    showOutgoingUI() {
        document.getElementById('call-overlay').classList.remove('hidden');
        document.getElementById('call-video-stage').classList.add('hidden');
        document.getElementById('call-avatar').src = this.currentCall.otherAvatar;
        document.getElementById('call-name').textContent = this.currentCall.otherName;
        document.getElementById('call-status').textContent = this.currentCall.video ? 'Video calling…' : 'Calling…';
        document.getElementById('call-controls-incoming').classList.add('hidden');
        document.getElementById('call-controls-active').classList.add('hidden');
        document.getElementById('call-controls-outgoing').classList.remove('hidden');
    },

    showIncomingUI() {
        document.getElementById('call-overlay').classList.remove('hidden');
        document.getElementById('call-video-stage').classList.add('hidden');
        document.getElementById('call-avatar').src = this.currentCall.otherAvatar;
        document.getElementById('call-name').textContent = this.currentCall.otherName;
        document.getElementById('call-status').textContent = this.currentCall.video ? 'Incoming video call…' : 'Incoming call…';
        document.getElementById('call-controls-outgoing').classList.add('hidden');
        document.getElementById('call-controls-active').classList.add('hidden');
        document.getElementById('call-controls-incoming').classList.remove('hidden');
    },

    showActiveUI() {
        document.getElementById('call-overlay').classList.remove('hidden');
        document.getElementById('call-status').textContent = 'Connecting…';
        document.getElementById('call-controls-incoming').classList.add('hidden');
        document.getElementById('call-controls-outgoing').classList.add('hidden');
        document.getElementById('call-controls-active').classList.remove('hidden');
        document.getElementById('call-camera-btn').classList.toggle('hidden', !this.currentCall.video);
        document.getElementById('call-video-stage').classList.toggle('hidden', !this.currentCall.video);

        // Show screen share only if video call AND desktop browser
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const screenBtn = document.getElementById('call-screen-btn');
        if (screenBtn) screenBtn.classList.toggle('hidden', !this.currentCall.video || isMobile);
    },

    hideUI() {
        const overlay = document.getElementById('call-overlay');
        if (overlay) overlay.classList.add('hidden');
        const remoteVideoEl = document.getElementById('call-remote-video');
        const localVideoEl = document.getElementById('call-local-video');
        const remoteAudioEl = document.getElementById('call-remote-audio');
        if (remoteVideoEl) remoteVideoEl.srcObject = null;
        if (localVideoEl) localVideoEl.srcObject = null;
        if (remoteAudioEl) remoteAudioEl.srcObject = null;
    },

    startTimer() {
        this.callStartedAt = Date.now();
        const statusEl = document.getElementById('call-status');
        this.timerInterval = setInterval(() => {
            const secs = Math.floor((Date.now() - this.callStartedAt) / 1000);
            const mm = String(Math.floor(secs / 60)).padStart(2, '0');
            const ss = String(secs % 60).padStart(2, '0');
            if (statusEl) statusEl.textContent = `${mm}:${ss}`;
        }, 1000);
    },

    stopTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = null;
    },

    // Small, dependency-free ringtone generated with the Web Audio API
    // (no external audio asset needed).
    playRingtone() {
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            this.ringCtx = new Ctx();
            const beep = () => {
                if (!this.ringCtx) return;
                [0, 0.22].forEach(delay => {
                    const osc = this.ringCtx.createOscillator();
                    const gain = this.ringCtx.createGain();
                    osc.frequency.value = 880;
                    osc.type = 'sine';
                    osc.connect(gain);
                    gain.connect(this.ringCtx.destination);
                    const t = this.ringCtx.currentTime + delay;
                    gain.gain.setValueAtTime(0.001, t);
                    gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
                    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
                    osc.start(t);
                    osc.stop(t + 0.2);
                });
            };
            beep();
            this.ringInterval = setInterval(beep, 1600);
        } catch (e) { /* audio not available -- fail silently, UI still rings visually */ }
    },

    stopRingtone() {
        if (this.ringInterval) clearInterval(this.ringInterval);
        this.ringInterval = null;
        if (this.ringCtx) {
            try { this.ringCtx.close(); } catch (e) {}
            this.ringCtx = null;
        }
    },

    // ------------------------------------------------------------------
    // Call history -- logged as a normal chat message so both people see
    // "Voice call · 2:15" / "Missed call" in their conversation history.
    // ------------------------------------------------------------------
    async logCall(status) {
        if (!this.currentCall) return;
        const { otherUserId, video } = this.currentCall;
        let duration = 0;
        if (this.callStartedAt) duration = Math.floor((Date.now() - this.callStartedAt) / 1000);

        try {
            const conv = await store.getConversationWithUser(otherUserId);
            const payload = JSON.stringify({ kind: video ? 'video' : 'audio', status, duration });
            store.sendMessage(conv.id, payload, store.db.currentUserId, 'call');
            if (app._activeConvId === conv.id) app.renderChatMessages(conv.id);
        } catch (e) { console.error('Failed to log call:', e); }
    },

    cleanup() {
        this.stopRingtone();
        this.stopTimer();
        clearTimeout(this.ringTimeout);
        this.ringTimeout = null;

        if (this.pc) {
            try { this.pc.close(); } catch (e) {}
            this.pc = null;
        }
        if (this.localStream) {
            this.localStream.getTracks().forEach(t => t.stop());
            this.localStream = null;
        }
        this.remoteStream = null;
        this.pendingCandidates = [];
        this.muted = false;
        this.cameraOff = false;
        this.callStartedAt = null;
        this.currentCall = null;
        this.hideUI();
    }
};

window.addEventListener('beforeunload', () => {
    if (Calls.currentCall && Calls.socket) {
        Calls.socket.emit('call:end', { toUserId: Calls.currentCall.otherUserId, callId: Calls.currentCall.callId });
    }
});
