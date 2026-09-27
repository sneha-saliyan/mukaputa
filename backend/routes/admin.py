from functools import wraps
from flask import Blueprint, request, session, jsonify
from ..extensions import db
from ..models import AdminUser, Report, Ad, User, Post, Reel

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("admin_id"):
            return jsonify({"error": "Admin authentication required."}), 401
        return f(*args, **kwargs)
    return decorated

def ok(data=None, code=200):
    return jsonify({"ok": True, **(data or {})}), code

def err(msg, code=400):
    return jsonify({"ok": False, "error": msg}), code

@admin_bp.post("/login")
def admin_login():
    data = request.get_json(silent=True) or {}
    username = data.get("username", "").strip()
    password = data.get("password", "")
    if not username or not password:
        return err("Username and password required.", 400)
    admin = AdminUser.query.filter_by(username=username).first()
    if not admin or not admin.check_password(password):
        return err("Invalid credentials.", 401)
    session["admin_id"] = admin.id
    session.permanent = True
    return ok({"message": "Logged in."})

@admin_bp.post("/logout")
def admin_logout():
    session.pop("admin_id", None)
    return ok({"message": "Logged out."})

@admin_bp.get("/me")
def admin_me():
    if not session.get("admin_id"):
        return err("Not authenticated.", 401)
    admin = AdminUser.query.get(session["admin_id"])
    if not admin:
        return err("Not found.", 404)
    return ok({"username": admin.username})

@admin_bp.get("/stats")
@admin_required
def get_stats():
    total_users = User.query.count()
    active_users = User.query.filter_by(is_active=True).count()
    total_posts = Post.query.count()
    total_reels = Reel.query.count()
    pending_reports = Report.query.filter_by(status="pending").count()
    total_ads = Ad.query.filter_by(is_active=True).count()
    return ok({"stats": {
        "totalUsers": total_users,
        "activeUsers": active_users,
        "totalPosts": total_posts,
        "totalReels": total_reels,
        "pendingReports": pending_reports,
        "activeAds": total_ads,
    }})

@admin_bp.get("/users")
@admin_required
def list_users():
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 20))
    q = request.args.get("q", "").strip()
    query = User.query
    if q:
        query = query.filter(User.name.ilike(f"%{q}%") | User.username.ilike(f"%{q}%") | User.email.ilike(f"%{q}%"))
    paginated = query.order_by(User.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)
    users = [{
        "id": u.id, "name": u.name, "username": u.username,
        "email": u.email, "avatar": u.avatar, "isActive": u.is_active,
        "createdAt": u.created_at.isoformat() + "Z"
    } for u in paginated.items]
    return ok({"users": users, "total": paginated.total, "pages": paginated.pages})

@admin_bp.put("/users/<user_id>/ban")
@admin_required
def ban_user(user_id):
    user = User.query.get(user_id)
    if not user:
        return err("User not found.", 404)
    user.is_active = False
    user.is_banned = True
    db.session.commit()
    return ok({"message": f"User {user.username} banned."})

@admin_bp.put("/users/<user_id>/unban")
@admin_required
def unban_user(user_id):
    user = User.query.get(user_id)
    if not user:
        return err("User not found.", 404)
    user.is_active = True
    user.is_banned = False
    db.session.commit()
    return ok({"message": f"User {user.username} unbanned."})

@admin_bp.delete("/users/<user_id>")
@admin_required
def delete_user(user_id):
    user = User.query.get(user_id)
    if not user:
        return err("User not found.", 404)
    from ..models import Story, Comment, CommentReply, PostReaction, ReelLike, ReelComment, Follow, FriendLink, BlockedUser, SavedItem, JobApplication, PageFollower
    from sqlalchemy import or_
    PostReaction.query.filter_by(user_id=user_id).delete()
    ReelLike.query.filter_by(user_id=user_id).delete()
    ReelComment.query.filter_by(author_id=user_id).delete()
    CommentReply.query.filter_by(author_id=user_id).delete()
    Comment.query.filter_by(author_id=user_id).delete()
    Post.query.filter_by(author_id=user_id).delete()
    Reel.query.filter_by(author_id=user_id).delete()
    Story.query.filter_by(author_id=user_id).delete()
    Follow.query.filter(or_(Follow.follower_id==user_id, Follow.followee_id==user_id)).delete()
    FriendLink.query.filter(or_(FriendLink.user_id==user_id, FriendLink.friend_id==user_id)).delete()
    BlockedUser.query.filter(or_(BlockedUser.user_id==user_id, BlockedUser.blocked_id==user_id)).delete()
    SavedItem.query.filter_by(user_id=user_id).delete()
    JobApplication.query.filter_by(user_id=user_id).delete()
    PageFollower.query.filter_by(user_id=user_id).delete()
    Report.query.filter_by(reporter_id=user_id).delete()
    db.session.delete(user)
    db.session.commit()
    return ok({"message": "User deleted."})

@admin_bp.get("/reports")
@admin_required
def list_reports():
    status = request.args.get("status", "pending")
    page = int(request.args.get("page", 1))
    per_page = int(request.args.get("per_page", 20))
    query = Report.query
    if status != "all":
        query = query.filter_by(status=status)
    paginated = query.order_by(Report.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)
    reports = []
    for r in paginated.items:
        d = r.to_dict()
        reporter = User.query.get(r.reporter_id)
        d["reporterName"] = reporter.name if reporter else "Unknown"
        d["reporterUsername"] = reporter.username if reporter else ""
        if r.content_type == "post":
            post = Post.query.get(r.content_id)
            d["contentPreview"] = post.text if post else "[Deleted]"
            d["contentMedia"] = post.media if post else "[]"
        elif r.content_type == "reel":
            reel = Reel.query.get(r.content_id)
            d["contentPreview"] = reel.caption if reel else "[Deleted]"
            d["contentMedia"] = reel.media if reel else ""
        else:
            d["contentPreview"] = ""
            d["contentMedia"] = ""
        reports.append(d)
    return ok({"reports": reports, "total": paginated.total, "pages": paginated.pages})

@admin_bp.put("/reports/<report_id>")
@admin_required
def update_report(report_id):
    from ..models import Notification
    from ..extensions import socketio

    report = Report.query.get(report_id)
    if not report:
        return err("Report not found.", 404)
    data = request.get_json(silent=True) or {}
    action = data.get("action")
    
    author_id = None
    if report.content_type == "post":
        post = Post.query.get(report.content_id)
        if post: author_id = post.author_id
    elif report.content_type == "reel":
        reel = Reel.query.get(report.content_id)
        if reel: author_id = reel.author_id

    if action == "remove_content":
        if report.content_type == "post":
            post = Post.query.get(report.content_id)
            if post: db.session.delete(post)
        elif report.content_type == "reel":
            reel = Reel.query.get(report.content_id)
            if reel: db.session.delete(reel)
        report.status = "removed"
        
        if author_id:
            notif = Notification(
                user_id=author_id,
                actor_id=None,
                type="admin_warning",
                target_id=report.content_id,
                text=f"Admin removed your {report.content_type} due to reports."
            )
            db.session.add(notif)

    elif action == "dismiss":
        report.status = "dismissed"
    elif action == "warn":
        report.status = "reviewed"
        if author_id:
            notif = Notification(
                user_id=author_id,
                actor_id=None,
                type="admin_warning",
                target_id=report.content_id,
                text=f"Admin warning: Your {report.content_type} has been reported. Please ensure it follows guidelines."
            )
            db.session.add(notif)
    else:
        return err("Invalid action.", 400)
    db.session.commit()
    return ok({"message": "Report updated.", "status": report.status})

@admin_bp.get("/ads")
@admin_required
def list_ads():
    ads = Ad.query.order_by(Ad.created_at.desc()).all()
    return ok({"ads": [a.to_dict() for a in ads]})

@admin_bp.post("/ads")
@admin_required
def create_ad():
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "").strip()
    if not title:
        return err("Title is required.", 400)
    ad = Ad(
        title=title,
        body=(data.get("body") or "").strip(),
        image=(data.get("image") or "").strip(),
        link=(data.get("link") or "").strip(),
        placement=data.get("placement", "feed"),
        is_active=bool(data.get("isActive", True)),
    )
    db.session.add(ad)
    db.session.commit()
    return ok({"ad": ad.to_dict()}, 201)

@admin_bp.put("/ads/<ad_id>")
@admin_required
def update_ad(ad_id):
    ad = Ad.query.get(ad_id)
    if not ad:
        return err("Ad not found.", 404)
    data = request.get_json(silent=True) or {}
    for field in ["title", "body", "image", "link", "placement"]:
        if field in data:
            setattr(ad, field, (data[field] or "").strip())
    if "isActive" in data:
        ad.is_active = bool(data["isActive"])
    db.session.commit()
    return ok({"ad": ad.to_dict()})

@admin_bp.delete("/ads/<ad_id>")
@admin_required
def delete_ad(ad_id):
    ad = Ad.query.get(ad_id)
    if not ad:
        return err("Ad not found.", 404)
    db.session.delete(ad)
    db.session.commit()
    return ok({"message": "Ad deleted."})

@admin_bp.get("/ads/active")
def get_active_ads():
    placement = request.args.get("placement", "feed")
    ads = Ad.query.filter_by(is_active=True, placement=placement).all()
    return ok({"ads": [a.to_dict() for a in ads]})

@admin_bp.get("/debug_sockets")
def debug_sockets():
    from ..sockets import online_users
    from ..extensions import socketio
    
    rooms = {}
    try:
        # Access the raw internal rooms dictionary for the '/' namespace
        raw_rooms = socketio.server.manager.rooms.get("/", {})
        for room_name, room_sids in raw_rooms.items():
            rooms[room_name] = list(room_sids.keys()) if isinstance(room_sids, dict) else list(room_sids)
    except Exception as e:
        rooms = {"error": str(e)}

    return ok({
        "online_users_dict": {k: list(v) for k, v in online_users.items()},
        "engine_rooms": rooms
    })
