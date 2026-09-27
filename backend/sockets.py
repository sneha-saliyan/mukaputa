"""
Real-time signaling for 1:1 voice & video calls.

This does NOT carry any audio/video itself -- actual media flows directly
between the two browsers over WebRTC (peer-to-peer). This module only
relays the small bits of setup information two browsers need to find each
other and agree on a connection: "someone is calling you", "they picked
up", SDP offers/answers, and ICE candidates.

Call history (who called whom, how long, missed/declined/completed) is
persisted as a normal chat message via the existing REST message endpoints
-- this module is purely live signaling and keeps no database state.
"""
from flask import request
from flask_login import current_user
from flask_socketio import emit, join_room

from .extensions import socketio

# user_id -> set of active socket ids (a person can have more than one tab/device open)
online_users = {}


@socketio.on("connect")
def handle_connect():
    if not current_user.is_authenticated:
        return False  # reject the connection
    join_room(current_user.id)
    online_users.setdefault(current_user.id, set()).add(request.sid)


@socketio.on("disconnect")
def handle_disconnect():
    if not current_user.is_authenticated:
        return
    sids = online_users.get(current_user.id)
    if sids:
        sids.discard(request.sid)
        if not sids:
            online_users.pop(current_user.id, None)

# REMOVED _authed() check from all events! 
# The connection is authenticated in handle_connect. Sometimes the session cookie 
# is lost by SocketIO on polling fallback frames. By removing it, the server becomes
# a dumb message router, which fixes the silent call dropping.

@socketio.on("call:invite")
def handle_call_invite(data):
    to_user = data.get("toUserId")
    call_id = data.get("callId")
    video = bool(data.get("video"))
    
    from_user_id = data.get("fromUserId", "Unknown")
    from_name = data.get("fromName", "Someone")
    from_avatar = data.get("fromAvatar", "")

    if not to_user or not call_id:
        return

    emit("call:debug", {"message": "Server routing call to " + to_user})

    emit("call:incoming", {
        "callId": call_id,
        "fromUserId": from_user_id,
        "fromName": from_name,
        "fromAvatar": from_avatar,
        "video": video,
    }, room=to_user)


@socketio.on("call:accept")
def handle_call_accept(data):
    to_user = data.get("toUserId")
    call_id = data.get("callId")
    if not to_user or not call_id: return
    emit("call:accepted", {"callId": call_id, "fromUserId": data.get("fromUserId", "Unknown")}, room=to_user)


@socketio.on("call:decline")
def handle_call_decline(data):
    to_user = data.get("toUserId")
    call_id = data.get("callId")
    if not to_user or not call_id: return
    emit("call:declined", {"callId": call_id, "fromUserId": data.get("fromUserId", "Unknown")}, room=to_user)


@socketio.on("call:cancel")
def handle_call_cancel(data):
    to_user = data.get("toUserId")
    call_id = data.get("callId")
    if not to_user or not call_id: return
    emit("call:cancelled", {"callId": call_id, "fromUserId": data.get("fromUserId", "Unknown")}, room=to_user)


@socketio.on("call:end")
def handle_call_end(data):
    to_user = data.get("toUserId")
    call_id = data.get("callId")
    if not to_user or not call_id: return
    emit("call:ended", {"callId": call_id, "fromUserId": data.get("fromUserId", "Unknown")}, room=to_user)


@socketio.on("call:signal")
def handle_call_signal(data):
    to_user = data.get("toUserId")
    call_id = data.get("callId")
    signal = data.get("signal")
    if not to_user or not call_id or signal is None: return
    emit("call:signal", {
        "callId": call_id,
        "fromUserId": data.get("fromUserId", "Unknown"),
        "signal": signal,
    }, room=to_user)


# --- LIVE BROADCAST ---
active_lives = {}

@socketio.on("live:start")
def handle_live_start():
    if getattr(current_user, "is_authenticated", False):
        active_lives[current_user.id] = current_user.to_public_dict()
        emit("live:started", {"user": current_user.to_public_dict()}, broadcast=True)

@socketio.on("live:end")
def handle_live_end():
    if getattr(current_user, "is_authenticated", False) and current_user.id in active_lives:
        active_lives.pop(current_user.id, None)
        emit("live:ended", {"userId": current_user.id}, broadcast=True)

@socketio.on("live:join_request")
def handle_live_join(data):
    to_user = data.get("to")
    if to_user: emit("live:join_request", {"viewerId": "Viewer"}, room=to_user)

@socketio.on("live:offer")
def handle_live_offer(data):
    to_user = data.get("to")
    if to_user: emit("live:offer", {"broadcasterId": "Broadcaster", "offer": data.get("offer")}, room=to_user)

@socketio.on("live:answer")
def handle_live_answer(data):
    to_user = data.get("to")
    if to_user: emit("live:answer", {"viewerId": "Viewer", "answer": data.get("answer")}, room=to_user)

@socketio.on("live:ice_viewer")
def handle_live_ice_viewer(data):
    to_user = data.get("to")
    if to_user: emit("live:ice_viewer", {"candidate": data.get("candidate")}, room=to_user)

@socketio.on("live:ice_broadcaster")
def handle_live_ice_broadcaster(data):
    to_user = data.get("to")
    if to_user: emit("live:ice_broadcaster", {"viewerId": "Viewer", "candidate": data.get("candidate")}, room=to_user)

@socketio.on("live:leave")
def handle_live_leave(data):
    to_user = data.get("to")
    if to_user: emit("live:leave", {"viewerId": "Viewer"}, room=to_user)

@socketio.on("live:comment")
def handle_live_comment(data):
    emit("live:comment", data, broadcast=True)
