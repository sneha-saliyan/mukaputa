from flask import Blueprint
from flask_login import login_required, current_user

from ..extensions import db
from ..models import Notification
from ..utils import err, ok

notifications_bp = Blueprint("notifications", __name__, url_prefix="/api/notifications")


@notifications_bp.get("")
@login_required
def list_notifications():
    notifs = Notification.query.filter_by(user_id=current_user.id) \
        .order_by(Notification.created_at.desc()).all()
    return ok({"notifications": [n.to_dict() for n in notifs]})


@notifications_bp.get("/unread_count")
@login_required
def unread_count():
    count = Notification.query.filter_by(user_id=current_user.id, read=False).count()
    return ok({"count": count})


@notifications_bp.post("/<notif_id>/read")
@login_required
def mark_read(notif_id):
    n = Notification.query.filter_by(id=notif_id, user_id=current_user.id).first()
    if not n:
        return err("Notification not found.", 404)
    n.read = True
    db.session.commit()
    return ok()


@notifications_bp.post("/read_all")
@login_required
def mark_all_read():
    Notification.query.filter_by(user_id=current_user.id, read=False).update({"read": True})
    db.session.commit()
    return ok()
