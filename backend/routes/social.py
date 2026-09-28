from flask import Blueprint, request
from flask_login import login_required, current_user

from ..extensions import db
from ..models import User, FriendLink, Follow, BlockedUser, SavedItem
from ..utils import err, ok, notify

social_bp = Blueprint("social", __name__, url_prefix="/api")

PROFILE_FIELDS = ["name", "bio", "work", "education", "location", "avatar", "cover"]

@social_bp.get("/users/<user_id>")
@login_required
def get_user(user_id):
    user = User.query.get(user_id)
    if not user:
        return err("User not found.", 404)
    return ok({"user": user.to_public_dict()})

import re
USERNAME_RE = re.compile(r"^[a-z0-9_.]{3,30}$")

@social_bp.put("/profile")
@login_required
def update_profile():
    data = request.get_json(silent=True) or {}

    if "username" in data:
        new_un = str(data["username"]).strip().lower()
        if new_un != current_user.username:
            if not USERNAME_RE.match(new_un):
                return err("Username must be 3-30 characters: lowercase letters, numbers, '.' or '_'.", 400)
            if User.query.filter_by(username=new_un).first():
                return err("That username is already taken.", 409)
            current_user.username = new_un

    for field in PROFILE_FIELDS:
        if field in data and data[field] is not None:
            setattr(current_user, field, (data[field] or "").strip() if isinstance(data[field], str) else data[field])

    if "privacySettings" in data and isinstance(data["privacySettings"], dict):
        ps = data["privacySettings"]
        if "posts" in ps:
            current_user.privacy_posts = ps["posts"]
        if "requests" in ps:
            current_user.privacy_requests = ps["requests"]

    db.session.commit()
    return ok({"user": current_user.to_public_dict()})


@social_bp.post("/friends/<user_id>")
@login_required
def add_friend(user_id):
    if user_id == current_user.id:
        return err("You can't friend yourself.")
    target = User.query.get(user_id)
    if not target:
        return err("User not found.", 404)

    if not FriendLink.query.filter_by(user_id=current_user.id, friend_id=user_id).first():
        db.session.add(FriendLink(user_id=current_user.id, friend_id=user_id))
    if not FriendLink.query.filter_by(user_id=user_id, friend_id=current_user.id).first():
        db.session.add(FriendLink(user_id=user_id, friend_id=current_user.id))

    notify(user_id, current_user.id, "friend_request", f"{current_user.name} added you as a friend.", current_user.id)

    db.session.commit()
    return ok()


@social_bp.delete("/friends/<user_id>")
@login_required
def remove_friend(user_id):
    FriendLink.query.filter_by(user_id=current_user.id, friend_id=user_id).delete()
    FriendLink.query.filter_by(user_id=user_id, friend_id=current_user.id).delete()
    db.session.commit()
    return ok()


@social_bp.post("/follow/<user_id>")
@login_required
def toggle_follow(user_id):
    if user_id == current_user.id:
        return err("You can't follow yourself.")

    existing = Follow.query.filter_by(follower_id=current_user.id, followee_id=user_id).first()
    if existing:
        db.session.delete(existing)
        following = False
    else:
        db.session.add(Follow(follower_id=current_user.id, followee_id=user_id))
        following = True
        notify(user_id, current_user.id, "follow", f"{current_user.name} started following you.", current_user.id)

    db.session.commit()
    return ok({"following": following})


@social_bp.delete("/block/<user_id>")
@login_required
def unblock_user(user_id):
    BlockedUser.query.filter_by(user_id=current_user.id, blocked_id=user_id).delete()
    db.session.commit()
    return ok()


@social_bp.post("/block/<user_id>")
@login_required
def block_user(user_id):
    if user_id == current_user.id:
        return err("You can't block yourself.")
    if not BlockedUser.query.filter_by(user_id=current_user.id, blocked_id=user_id).first():
        db.session.add(BlockedUser(user_id=current_user.id, blocked_id=user_id))
        db.session.commit()
    return ok()


@social_bp.post("/save/<item_id>")
@login_required
def toggle_save(item_id):
    existing = SavedItem.query.filter_by(user_id=current_user.id, item_id=item_id).first()
    if existing:
        db.session.delete(existing)
        saved = False
    else:
        db.session.add(SavedItem(user_id=current_user.id, item_id=item_id))
        saved = True
    db.session.commit()
    return ok({"saved": saved})


@social_bp.post("/tickets")
@login_required
def create_ticket():
    from ..models import SupportTicket
    data = request.get_json(silent=True) or {}
    subject = (data.get("subject") or "").strip()
    message = (data.get("message") or "").strip()
    if not subject or not message:
        return err("Subject and message are required.")
    
    t = SupportTicket(user_id=current_user.id, subject=subject, message=message)
    db.session.add(t)
    db.session.commit()
    return ok({"ticket": t.to_dict()})

@social_bp.get("/tickets")
@login_required
def get_my_tickets():
    from ..models import SupportTicket
    tickets = SupportTicket.query.filter_by(user_id=current_user.id).order_by(SupportTicket.created_at.desc()).all()
    return ok({"tickets": [t.to_dict() for t in tickets]})
