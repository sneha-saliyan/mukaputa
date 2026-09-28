import uuid
from datetime import datetime

from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash

from .extensions import db


def new_id(prefix):
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


# ---------------------------------------------------------------------------
# USERS
# ---------------------------------------------------------------------------
class User(UserMixin, db.Model):
    __tablename__ = "users"

    id = db.Column(db.String(64), primary_key=True, default=lambda: new_id("u"))
    name = db.Column(db.String(120), nullable=False)
    username = db.Column(db.String(60), unique=True, nullable=False, index=True)
    email = db.Column(db.String(160), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)

    avatar = db.Column(db.Text, default="")
    cover = db.Column(db.Text, default="")
    bio = db.Column(db.Text, default="")
    work = db.Column(db.String(200), default="")
    education = db.Column(db.String(200), default="")
    location = db.Column(db.String(200), default="")

    privacy_posts = db.Column(db.String(20), default="public")
    privacy_requests = db.Column(db.String(20), default="everyone")

    is_active = db.Column(db.Boolean, default=True)
    is_banned = db.Column(db.Boolean, default=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def set_password(self, raw):
        self.password_hash = generate_password_hash(raw)

    def check_password(self, raw):
        return check_password_hash(self.password_hash, raw)

    def joined_label(self):
        return "Joined " + self.created_at.strftime("%B %Y")

    friend_links = db.relationship("FriendLink", foreign_keys="[FriendLink.user_id]", lazy="selectin", viewonly=True)
    follows = db.relationship("Follow", foreign_keys="[Follow.follower_id]", lazy="selectin", viewonly=True)
    saved_items = db.relationship("SavedItem", lazy="selectin", viewonly=True)
    blocked_links = db.relationship("BlockedUser", foreign_keys="[BlockedUser.user_id]", lazy="selectin", viewonly=True)

    def to_public_dict(self, current_user_id=None):
        friend_ids = [f.friend_id for f in self.friend_links]
        following_ids = [f.followee_id for f in self.follows]
        saved_ids = [s.item_id for s in self.saved_items]
        blocked_ids = [b.blocked_id for b in self.blocked_links]

        # Fetch blocked user details (could still be a few queries, but rare)
        import urllib.parse
        encoded_seed = urllib.parse.quote(self.username or self.name or "user")
        
        avatar_url = self.avatar
        if not avatar_url:
            avatar_url = f"https://api.dicebear.com/9.x/notionists/svg?seed={encoded_seed}&backgroundColor=c0aede,b6e3f4,d1d4f9,ffdfbf"
            
        cover_url = self.cover
        if not cover_url:
            cover_url = f"https://api.dicebear.com/9.x/shapes/svg?seed={encoded_seed}cover&backgroundColor=0a0a0a,1a1a1a&shape1Color=c0aede,b6e3f4,d1d4f9"

        blocked_users = []
        if blocked_ids:
            for bu in User.query.filter(User.id.in_(blocked_ids)).all():
                bu_seed = urllib.parse.quote(bu.username or bu.name or "user")
                bu_avatar = bu.avatar or f"https://api.dicebear.com/9.x/notionists/svg?seed={bu_seed}&backgroundColor=c0aede,b6e3f4,d1d4f9,ffdfbf"
                blocked_users.append({"id": bu.id, "name": bu.name, "avatar": bu_avatar})

        data = {
            "id": self.id,
            "name": self.name,
            "username": self.username,
            "avatar": avatar_url,
            "cover": cover_url,
            "bio": self.bio,
            "work": self.work,
            "education": self.education,
            "location": self.location,
            "joined": self.joined_label(),
            "friends": friend_ids,
            "following": following_ids,
            "savedItems": saved_ids,
            "blockedUsers": blocked_users,
            "privacySettings": {"posts": self.privacy_posts, "requests": self.privacy_requests},
        }
        return data


class FriendLink(db.Model):
    """Directional row; add_friend() inserts both directions so lookups are O(1)."""
    __tablename__ = "friend_links"
    user_id = db.Column(db.String(64), db.ForeignKey("users.id"), primary_key=True)
    friend_id = db.Column(db.String(64), db.ForeignKey("users.id"), primary_key=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class Follow(db.Model):
    __tablename__ = "follows"
    follower_id = db.Column(db.String(64), db.ForeignKey("users.id"), primary_key=True)
    followee_id = db.Column(db.String(64), db.ForeignKey("users.id"), primary_key=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class BlockedUser(db.Model):
    __tablename__ = "blocked_users"
    user_id = db.Column(db.String(64), db.ForeignKey("users.id"), primary_key=True)
    blocked_id = db.Column(db.String(64), db.ForeignKey("users.id"), primary_key=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class SavedItem(db.Model):
    """Generic bookmark table -- covers both saved posts and saved reels,
    mirroring the original frontend's single `savedItems` array per user."""
    __tablename__ = "saved_items"
    user_id = db.Column(db.String(64), db.ForeignKey("users.id"), primary_key=True)
    item_id = db.Column(db.String(64), primary_key=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


# ---------------------------------------------------------------------------
# POSTS
# ---------------------------------------------------------------------------
class Post(db.Model):
    __tablename__ = "posts"
    id = db.Column(db.String(64), primary_key=True, default=lambda: new_id("p"))
    author_id = db.Column(db.String(64), db.ForeignKey("users.id"), nullable=False)
    text = db.Column(db.Text, default="")
    media = db.Column(db.JSON, default=list)
    feeling = db.Column(db.String(80), default="")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    comments = db.relationship("Comment", backref="post", cascade="all, delete-orphan",
                                order_by="Comment.created_at", lazy="selectin")
    reactions = db.relationship("PostReaction", backref="post", cascade="all, delete-orphan", lazy="selectin")

    def to_dict(self):
        reactions = {"like": [], "love": [], "haha": [], "wow": [], "sad": [], "angry": []}
        for r in self.reactions:
            reactions.setdefault(r.type, [])
            reactions[r.type].append(r.user_id)
        return {
            "id": self.id,
            "authorId": self.author_id,
            "text": self.text,
            "media": self.media or [],
            "feeling": self.feeling or "",
            "createdAt": self.created_at.isoformat() + "Z",
            "reactions": reactions,
            "comments": [c.to_dict() for c in self.comments],
        }


class PostReaction(db.Model):
    __tablename__ = "post_reactions"
    post_id = db.Column(db.String(64), db.ForeignKey("posts.id"), primary_key=True)
    user_id = db.Column(db.String(64), db.ForeignKey("users.id"), primary_key=True)
    type = db.Column(db.String(20), nullable=False)


class Comment(db.Model):
    __tablename__ = "comments"
    id = db.Column(db.String(64), primary_key=True, default=lambda: new_id("c"))
    post_id = db.Column(db.String(64), db.ForeignKey("posts.id"), nullable=False)
    author_id = db.Column(db.String(64), db.ForeignKey("users.id"), nullable=False)
    text = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    replies = db.relationship("CommentReply", backref="comment", cascade="all, delete-orphan",
                               order_by="CommentReply.created_at", lazy="selectin")

    def to_dict(self):
        return {
            "id": self.id,
            "authorId": self.author_id,
            "text": self.text,
            "createdAt": self.created_at.isoformat() + "Z",
            "reactions": {},
            "replies": [r.to_dict() for r in self.replies],
        }


class CommentReply(db.Model):
    __tablename__ = "comment_replies"
    id = db.Column(db.String(64), primary_key=True, default=lambda: new_id("cr"))
    comment_id = db.Column(db.String(64), db.ForeignKey("comments.id"), nullable=False)
    author_id = db.Column(db.String(64), db.ForeignKey("users.id"), nullable=False)
    text = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "authorId": self.author_id,
            "text": self.text,
            "createdAt": self.created_at.isoformat() + "Z",
        }


# ---------------------------------------------------------------------------
# STORIES
# ---------------------------------------------------------------------------
class Story(db.Model):
    __tablename__ = "stories"
    id = db.Column(db.String(64), primary_key=True, default=lambda: new_id("s"))
    author_id = db.Column(db.String(64), db.ForeignKey("users.id"), nullable=False)
    media = db.Column(db.Text, nullable=False)
    caption = db.Column(db.Text, default="")
    viewers = db.Column(db.JSON, default=list)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "authorId": self.author_id,
            "media": self.media,
            "caption": self.caption or "",
            "viewers": self.viewers or [],
            "createdAt": self.created_at.isoformat() + "Z",
        }

class Note(db.Model):
    __tablename__ = "notes"
    id = db.Column(db.String(64), primary_key=True, default=lambda: new_id("n"))
    user_id = db.Column(db.String(64), db.ForeignKey("users.id"), nullable=False)
    text = db.Column(db.String(60), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "userId": self.user_id,
            "text": self.text,
            "createdAt": self.created_at.isoformat() + "Z",
        }


# ---------------------------------------------------------------------------
# REELS
# ---------------------------------------------------------------------------
class Reel(db.Model):
    __tablename__ = "reels"
    id = db.Column(db.String(64), primary_key=True, default=lambda: new_id("r"))
    author_id = db.Column(db.String(64), db.ForeignKey("users.id"), nullable=False)
    media = db.Column(db.Text, nullable=False)
    caption = db.Column(db.Text, default="")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    comments = db.relationship("ReelComment", backref="reel", cascade="all, delete-orphan",
                                order_by="ReelComment.created_at", lazy="selectin")
    likes = db.relationship("ReelLike", backref="reel", cascade="all, delete-orphan", lazy="selectin")

    def to_dict(self):
        return {
            "id": self.id,
            "authorId": self.author_id,
            "media": self.media,
            "caption": self.caption or "",
            "createdAt": self.created_at.isoformat() + "Z",
            "reactions": {"like": [l.user_id for l in self.likes]},
            "comments": [c.to_dict() for c in self.comments],
        }


class ReelLike(db.Model):
    __tablename__ = "reel_likes"
    reel_id = db.Column(db.String(64), db.ForeignKey("reels.id"), primary_key=True)
    user_id = db.Column(db.String(64), db.ForeignKey("users.id"), primary_key=True)


class ReelComment(db.Model):
    __tablename__ = "reel_comments"
    id = db.Column(db.String(64), primary_key=True, default=lambda: new_id("rc"))
    reel_id = db.Column(db.String(64), db.ForeignKey("reels.id"), nullable=False)
    author_id = db.Column(db.String(64), db.ForeignKey("users.id"), nullable=False)
    text = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {"id": self.id, "authorId": self.author_id, "text": self.text,
                "createdAt": self.created_at.isoformat() + "Z"}


# ---------------------------------------------------------------------------
# WATCH VIDEOS (curated/read-only content)
# ---------------------------------------------------------------------------
class WatchVideo(db.Model):
    __tablename__ = "watch_videos"
    id = db.Column(db.String(64), primary_key=True, default=lambda: new_id("v"))
    author_id = db.Column(db.String(64), db.ForeignKey("users.id"), nullable=True)
    title = db.Column(db.String(300), nullable=False)
    media = db.Column(db.Text, default="")
    category = db.Column(db.String(80), default="")
    subcategory = db.Column(db.String(120), default="")
    platform = db.Column(db.String(40), default="")
    url = db.Column(db.Text, default="")
    source_name = db.Column(db.String(160), default="")
    description = db.Column(db.Text, default="")
    views = db.Column(db.String(40), default="")
    duration = db.Column(db.String(20), default="")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "authorId": self.author_id,
            "title": self.title,
            "media": self.media,
            "category": self.category,
            "subcategory": self.subcategory,
            "platform": self.platform,
            "url": self.url,
            "sourceName": self.source_name,
            "description": self.description,
            "views": self.views,
            "duration": self.duration,
            "reactions": {"like": []},
            "comments": [],
        }


# ---------------------------------------------------------------------------
# PAGES
# ---------------------------------------------------------------------------
class Page(db.Model):
    __tablename__ = "pages"
    id = db.Column(db.String(64), primary_key=True, default=lambda: new_id("pg"))
    name = db.Column(db.String(160), nullable=False)
    category = db.Column(db.String(120), default="General")
    cover = db.Column(db.Text, default="")
    description = db.Column(db.Text, default="")
    created_by = db.Column(db.String(64), db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    followers = db.relationship("PageFollower", backref="page", cascade="all, delete-orphan", lazy="selectin")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "category": self.category,
            "cover": self.cover,
            "description": self.description,
            "followerIds": [f.user_id for f in self.followers],
        }


class PageFollower(db.Model):
    __tablename__ = "page_followers"
    page_id = db.Column(db.String(64), db.ForeignKey("pages.id"), primary_key=True)
    user_id = db.Column(db.String(64), db.ForeignKey("users.id"), primary_key=True)


# ---------------------------------------------------------------------------
# JOB VACANCIES
# ---------------------------------------------------------------------------
class JobVacancy(db.Model):
    __tablename__ = "job_vacancies"
    id = db.Column(db.String(64), primary_key=True, default=lambda: new_id("j"))
    posted_by = db.Column(db.String(64), db.ForeignKey("users.id"), nullable=True)
    company = db.Column(db.String(160), nullable=False)
    logo = db.Column(db.Text, default="")
    title = db.Column(db.String(200), nullable=False)
    type = db.Column(db.String(60), default="Full-Time")
    location = db.Column(db.String(160), default="Remote")
    remote = db.Column(db.String(40), default="Remote")
    salary = db.Column(db.String(80), default="Competitive")
    category = db.Column(db.String(80), default="Engineering")
    description = db.Column(db.Text, default="")
    requirements = db.Column(db.JSON, default=list)
    benefits = db.Column(db.JSON, default=list)
    posted_at = db.Column(db.DateTime, default=datetime.utcnow)

    applications = db.relationship("JobApplication", backref="job", cascade="all, delete-orphan", lazy="selectin")

    def to_dict(self, current_user_id=None):
        saved = False
        applied = False
        if current_user_id:
            saved = SavedItem.query.filter_by(user_id=current_user_id, item_id=self.id).first() is not None
            applied = JobApplication.query.filter_by(job_id=self.id, user_id=current_user_id).first() is not None
        return {
            "id": self.id,
            "postedBy": self.posted_by,
            "company": self.company,
            "logo": self.logo,
            "title": self.title,
            "type": self.type,
            "location": self.location,
            "remote": self.remote,
            "salary": self.salary,
            "category": self.category,
            "description": self.description,
            "requirements": self.requirements or [],
            "benefits": self.benefits or [],
            "applicants": len(self.applications),
            "postedAt": self.posted_at.isoformat() + "Z",
            "saved": saved,
            "appliedBy": [current_user_id] if applied else [],
        }


class JobApplication(db.Model):
    __tablename__ = "job_applications"
    job_id = db.Column(db.String(64), db.ForeignKey("job_vacancies.id"), primary_key=True)
    user_id = db.Column(db.String(64), db.ForeignKey("users.id"), primary_key=True)
    applied_at = db.Column(db.DateTime, default=datetime.utcnow)


# ---------------------------------------------------------------------------
# MESSAGING
# ---------------------------------------------------------------------------
class Conversation(db.Model):
    __tablename__ = "conversations"
    id = db.Column(db.String(64), primary_key=True, default=lambda: new_id("conv"))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    participants = db.relationship("ConversationParticipant", backref="conversation",
                                    cascade="all, delete-orphan", lazy="selectin")
    messages = db.relationship("Message", backref="conversation", cascade="all, delete-orphan",
                                order_by="Message.created_at", lazy="selectin")

    def to_dict(self):
        return {
            "id": self.id,
            "participantIds": [p.user_id for p in self.participants],
            "messages": [m.to_dict() for m in self.messages],
        }


class ConversationParticipant(db.Model):
    __tablename__ = "conversation_participants"
    conversation_id = db.Column(db.String(64), db.ForeignKey("conversations.id"), primary_key=True)
    user_id = db.Column(db.String(64), db.ForeignKey("users.id"), primary_key=True)


class Message(db.Model):
    __tablename__ = "messages"
    id = db.Column(db.String(64), primary_key=True, default=lambda: new_id("m"))
    conversation_id = db.Column(db.String(64), db.ForeignKey("conversations.id"), nullable=False)
    sender_id = db.Column(db.String(64), db.ForeignKey("users.id"), nullable=False)
    text = db.Column(db.Text, default="")
    type = db.Column(db.String(20), default="text")  # text | image | audio
    reply_to = db.Column(db.String(64), default=None)
    reaction = db.Column(db.String(10), default=None)
    is_edited = db.Column(db.Boolean, default=False)
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "senderId": self.sender_id,
            "text": self.text,
            "type": self.type,
            "replyTo": self.reply_to,
            "reaction": self.reaction,
            "isEdited": self.is_edited,
            "isRead": self.is_read,
            "createdAt": self.created_at.isoformat() + "Z",
        }


# ---------------------------------------------------------------------------
# NOTIFICATIONS
# ---------------------------------------------------------------------------
class Notification(db.Model):
    __tablename__ = "notifications"
    id = db.Column(db.String(64), primary_key=True, default=lambda: new_id("n"))
    user_id = db.Column(db.String(64), db.ForeignKey("users.id"), nullable=False)  # recipient
    actor_id = db.Column(db.String(64), db.ForeignKey("users.id"), nullable=True)
    type = db.Column(db.String(40), default="info")
    text = db.Column(db.Text, default="")
    target_id = db.Column(db.String(64), default=None)
    read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "userId": self.user_id,
            "actorId": self.actor_id,
            "type": self.type,
            "text": self.text,
            "targetId": self.target_id,
            "read": self.read,
            "createdAt": self.created_at.isoformat() + "Z",
        }


# ---------------------------------------------------------------------------
# OTP VERIFICATION
# ---------------------------------------------------------------------------
class EmailOTP(db.Model):
    __tablename__ = "email_otps"
    id = db.Column(db.String(64), primary_key=True, default=lambda: new_id("otp"))
    email = db.Column(db.String(120), nullable=False, index=True)
    code = db.Column(db.String(6), nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)


# ---------------------------------------------------------------------------
# ADMIN
# ---------------------------------------------------------------------------
class AdminUser(db.Model):
    __tablename__ = "admin_users"
    id = db.Column(db.String(64), primary_key=True, default=lambda: new_id("adm"))
    username = db.Column(db.String(60), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def set_password(self, raw):
        self.password_hash = generate_password_hash(raw)

    def check_password(self, raw):
        return check_password_hash(self.password_hash, raw)


class Report(db.Model):
    __tablename__ = "reports"
    id = db.Column(db.String(64), primary_key=True, default=lambda: new_id("rep"))
    reporter_id = db.Column(db.String(64), db.ForeignKey("users.id"), nullable=False)
    content_type = db.Column(db.String(20), nullable=False)
    content_id = db.Column(db.String(64), nullable=False)
    reason = db.Column(db.String(200), nullable=False)
    status = db.Column(db.String(20), default="pending")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "reporterId": self.reporter_id,
            "contentType": self.content_type,
            "contentId": self.content_id,
            "reason": self.reason,
            "status": self.status,
            "createdAt": self.created_at.isoformat() + "Z",
        }


class Ad(db.Model):
    __tablename__ = "ads"
    id = db.Column(db.String(64), primary_key=True, default=lambda: new_id("ad"))
    title = db.Column(db.String(200), nullable=False)
    body = db.Column(db.Text, default="")
    image = db.Column(db.Text, default="")
    link = db.Column(db.Text, default="")
    placement = db.Column(db.String(40), default="feed")
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "body": self.body,
            "image": self.image,
            "link": self.link,
            "placement": self.placement,
            "isActive": self.is_active,
            "createdAt": self.created_at.isoformat() + "Z",
        }
