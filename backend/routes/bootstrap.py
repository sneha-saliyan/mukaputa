from flask import Blueprint, current_app
from flask_login import login_required, current_user
import concurrent.futures

from ..models import (
    User, Post, Story, Reel, WatchVideo, Page, JobVacancy,
    Conversation, ConversationParticipant, Notification, SavedItem, JobApplication
)
from ..utils import ok

bootstrap_bp = Blueprint("bootstrap", __name__, url_prefix="/api")

@bootstrap_bp.get("/bootstrap")
@login_required
def bootstrap():
    uid = current_user.id
    app = current_app._get_current_object()

    with app.app_context():
        # Limit the number of records fetched to drastically improve dashboard load times
        users = [u.to_public_dict() for u in User.query.limit(200).all()]
        posts = [p.to_dict() for p in Post.query.order_by(Post.created_at.desc()).limit(50).all()]
        stories = [s.to_dict() for s in Story.query.order_by(Story.created_at.desc()).limit(50).all()]
        reels = [r.to_dict() for r in Reel.query.order_by(Reel.created_at.desc()).limit(50).all()]
        watch_videos = [v.to_dict() for v in WatchVideo.query.order_by(WatchVideo.created_at.desc()).limit(50).all()]
        pages = [p.to_dict() for p in Page.query.limit(50).all()]
        
        my_saved = {s.item_id for s in SavedItem.query.filter_by(user_id=uid).all()}
        my_applied = {a.job_id for a in JobApplication.query.filter_by(user_id=uid).all()}
        jobs = []
        for j in JobVacancy.query.order_by(JobVacancy.posted_at.desc()).limit(50).all():
            d = j.to_dict(current_user_id=None)
            d["saved"] = j.id in my_saved
            d["appliedBy"] = [uid] if j.id in my_applied else []
            jobs.append(d)
            
        my_conv_ids = [cp.conversation_id for cp in ConversationParticipant.query.filter_by(user_id=uid).all()]
        conversations = [c.to_dict() for c in Conversation.query.filter(Conversation.id.in_(my_conv_ids)).all()] if my_conv_ids else []
        
        notifications = [n.to_dict() for n in Notification.query.filter_by(user_id=uid).order_by(Notification.created_at.desc()).limit(50).all()]

    contacts = [u["id"] for u in users if u["id"] != uid]

    return ok({
        "currentUserId": uid,
        "users": users,
        "posts": posts,
        "stories": stories,
        "reels": reels,
        "watchVideos": watch_videos,
        "pages": pages,
        "jobVacancies": jobs,
        "conversations": conversations,
        "notifications": notifications,
        "contacts": contacts,
    })
