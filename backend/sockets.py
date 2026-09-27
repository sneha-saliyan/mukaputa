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


def _authed():
    return current_user.is_authenticated


@socketio.on("call:invite")
def handle_call_invite(data):
    if not _authed():
        return
    to_user = data.get("toUserId")
    call_id = data.get("callId")
    video = bool(data.get("video"))

    if not to_user or not call_id:
        return

    if to_user not in online_users:
        emit("call:unavailable", {"callId": call_id, "toUserId": to_user})
        return

    emit("call:incoming", {
        "callId": call_id,
        "fromUserId": current_user.id,
        "fromName": current_user.name,
        "fromAvatar": current_user.avatar,
        "video": video,
    }, room=to_user)


@socketio.on("call:accept")
def handle_call_accept(data):
    if not _authed():
        return
    to_user = data.get("toUserId")
    call_id = data.get("callId")
    if not to_user or not call_id:
        return
    emit("call:accepted", {"callId": call_id, "fromUserId": current_user.id}, room=to_user)


@socketio.on("call:decline")
def handle_call_decline(data):
    if not _authed():
        return
    to_user = data.get("toUserId")
    call_id = data.get("callId")
    if not to_user or not call_id:
        return
    emit("call:declined", {"callId": call_id, "fromUserId": current_user.id}, room=to_user)


@socketio.on("call:cancel")
def handle_call_cancel(data):
    if not _authed():
        return
    to_user = data.get("toUserId")
    call_id = data.get("callId")
    if not to_user or not call_id:
        return
    emit("call:cancelled", {"callId": call_id, "fromUserId": current_user.id}, room=to_user)


@socketio.on("call:end")
def handle_call_end(data):
    if not _authed():
        return
    to_user = data.get("toUserId")
    call_id = data.get("callId")
    if not to_user or not call_id:
        return
    emit("call:ended", {"callId": call_id, "fromUserId": current_user.id}, room=to_user)


@socketio.on("call:signal")
def handle_call_signal(data):
    """Relays WebRTC SDP offers/answers and ICE candidates between the two
    participants. The payload is opaque to the server -- it just forwards
    whatever the browsers hand it to each other."""
    if not _authed():
        return
    to_user = data.get("toUserId")
    call_id = data.get("callId")
    signal = data.get("signal")
    if not to_user or not call_id or signal is None:
        return
    emit("call:signal", {
        "callId": call_id,
        "fromUserId": current_user.id,
        "signal": signal,
    }, room=to_user)

# --- LIVE BROADCAST ---
active_lives = {}

@socketio.on("live:start")
def handle_live_start():
    if not current_user.is_authenticated: return
    active_lives[current_user.id] = current_user.to_public_dict()
    emit("live:started", {"user": current_user.to_public_dict()}, broadcast=True)

@socketio.on("live:end")
def handle_live_end():
    if not current_user.is_authenticated: return
    if current_user.id in active_lives:
        active_lives.pop(current_user.id, None)
        emit("live:ended", {"userId": current_user.id}, broadcast=True)

@socketio.on("live:join_request")
def handle_live_join(data):
    if not current_user.is_authenticated: return
    to_user = data.get("to")
    if to_user: emit("live:join_request", {"viewerId": current_user.id}, room=to_user)

@socketio.on("live:offer")
def handle_live_offer(data):
    if not current_user.is_authenticated: return
    to_user = data.get("to")
    offer = data.get("offer")
    if to_user: emit("live:offer", {"broadcasterId": current_user.id, "offer": offer}, room=to_user)

@socketio.on("live:answer")
def handle_live_answer(data):
    if not current_user.is_authenticated: return
    to_user = data.get("to")
    answer = data.get("answer")
    if to_user: emit("live:answer", {"viewerId": current_user.id, "answer": answer}, room=to_user)

@socketio.on("live:ice_viewer")
def handle_live_ice_viewer(data):
    if not current_user.is_authenticated: return
    to_user = data.get("to")
    if to_user: emit("live:ice_viewer", {"candidate": data.get("candidate")}, room=to_user)

@socketio.on("live:ice_broadcaster")
def handle_live_ice_broadcaster(data):
    if not current_user.is_authenticated: return
    to_user = data.get("to")
    if to_user: emit("live:ice_broadcaster", {"viewerId": current_user.id, "candidate": data.get("candidate")}, room=to_user)

@socketio.on("live:leave")
def handle_live_leave(data):
    if not current_user.is_authenticated: return
    to_user = data.get("to")
    if to_user: emit("live:leave", {"viewerId": current_user.id}, room=to_user)

@socketio.on("live:comment")
def handle_live_comment(data):
    if not current_user.is_authenticated: return
    emit("live:comment", data, broadcast=True)

