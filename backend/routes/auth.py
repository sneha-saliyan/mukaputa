import smtplib
import os
from email.message import EmailMessage
import random
from datetime import datetime, timedelta
import re
import uuid

from flask import Blueprint, request, session
from flask_login import login_user, logout_user, login_required, current_user

from ..extensions import db
from ..models import User, Conversation, ConversationParticipant, Message, Post, Comment, \
    CommentReply, PostReaction, Story, Reel, ReelLike, ReelComment, FriendLink, Follow, \
    BlockedUser, SavedItem, Notification, JobApplication, EmailOTP
from ..utils import err, ok

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

USERNAME_RE = re.compile(r"^[a-z0-9_.]{3,30}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

DEFAULT_AVATAR = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ccc'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z'/%3E%3C/svg%3E"
DEFAULT_COVER = "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1200&auto=format&fit=crop&q=80"


def slugify_username(name):
    base = re.sub(r"[^a-z0-9]+", "", name.lower()) or "user"
    base = base[:20]
    candidate = base
    i = 0
    while User.query.filter_by(username=candidate).first() is not None:
        i += 1
        candidate = f"{base}{i}"
    return candidate



@auth_bp.post("/send_otp")
def send_otp():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    if not email or not EMAIL_RE.match(email):
        return err("Valid email is required.", 400)
        
    if User.query.filter_by(email=email).first():
        return err("Email already registered.", 400)
        
    # Generate 6 digit code
    code = f"{random.randint(0, 999999):06d}"
    
    # Save to db
    otp = EmailOTP.query.filter_by(email=email).first()
    if not otp:
        otp = EmailOTP(email=email)
        db.session.add(otp)
    
    otp.code = code
    otp.expires_at = datetime.utcnow() + timedelta(minutes=10)
    db.session.commit()
    
    # Send email
    sender_email = os.environ.get("SMTP_EMAIL", "")
    sender_password = os.environ.get("SMTP_PASSWORD", "")
    
    if sender_email and sender_password:
        try:
            msg = EmailMessage()
            msg.set_content(f"Your Mukaputa verification code is: {code}\n\nThis code expires in 10 minutes.")
            msg['Subject'] = f"{code} is your Mukaputa verification code"
            msg['From'] = sender_email
            msg['To'] = email
            
            s = smtplib.SMTP('smtp.gmail.com', 587)
            s.starttls()
            s.login(sender_email, sender_password)
            s.send_message(msg)
            s.quit()
        except Exception as e:
            print("Failed to send email:", e)
            return err("Failed to send OTP email. Please try again later.", 500)
    else:
        print(f"\n[MOCK EMAIL] OTP for {email} is {code}\n")
        
    return ok({"message": "OTP sent successfully"})


@auth_bp.post("/register")
def register():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    username = (data.get("username") or "").strip().lower()
    password = data.get("password") or ""
    otp_code = (data.get("otp") or "").strip()

    if not name or not email or not username or not password or not otp_code:
        return err("All fields including OTP are required.", 400)
        
    if not EMAIL_RE.match(email):
        return err("Invalid email format.", 400)
    if not USERNAME_RE.match(username):
        return err("Username must be 3-30 characters (letters, numbers, underscores, dots).", 400)

    # Verify OTP
    otp_record = EmailOTP.query.filter_by(email=email).first()
    if not otp_record or otp_record.code != otp_code:
        return err("Invalid or expired OTP code.", 400)
        
    if datetime.utcnow() > otp_record.expires_at:
        db.session.delete(otp_record)
        db.session.commit()
        return err("OTP has expired. Please request a new one.", 400)

    if User.query.filter_by(email=email).first():
        return err("Email already registered.", 409)
    if User.query.filter_by(username=username).first():
        return err("Username taken.", 409)
        
    # Delete used OTP
    db.session.delete(otp_record)

    user = User(name=name, email=email, username=username)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    session.permanent = True
    login_user(user)
    return ok({"user": user.to_public_dict()}, 201)


@auth_bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    identifier = (data.get("identifier") or data.get("username") or data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not identifier or not password:
        return err("Please enter your username/email and password.")

    user = User.query.filter(
        (User.username == identifier) | (User.email == identifier)
    ).first()

    if not user or not user.check_password(password):
        return err("Incorrect username/email or password.", 401)

    if getattr(user, 'is_banned', False):
        return err("This account has been banned.", 403)

    session.permanent = True
    login_user(user, remember=True, force=True)
    
    if not getattr(user, 'is_active', True):
        user.is_active = True
        db.session.commit()
        
    return ok({"user": user.to_public_dict()})


@auth_bp.post("/logout")
@login_required
def logout():
    logout_user()
    session.clear()
    return ok()


@auth_bp.get("/me")
def me():
    if not current_user.is_authenticated:
        return err("Not authenticated", 401)
    return ok({"user": current_user.to_public_dict()})


@auth_bp.put("/password")
@login_required
def change_password():
    data = request.get_json(silent=True) or {}
    current_pw = data.get("currentPassword") or ""
    new_pw = data.get("newPassword") or ""

    if not current_user.check_password(current_pw):
        return err("Current password is incorrect.", 401)
    if len(new_pw) < 6:
        return err("New password must be at least 6 characters long.")

    current_user.set_password(new_pw)
    db.session.commit()
    return ok({"message": "Password updated."})


@auth_bp.post("/deactivate")
@login_required
def deactivate_account():
    current_user.is_active = False
    db.session.commit()
    logout_user()
    session.clear()
    return ok({"message": "Account deactivated."})

@auth_bp.delete("/account")
@login_required
def delete_account():
    uid = current_user.id

    # Clean up everything owned by / referencing this user.
    PostReaction.query.filter_by(user_id=uid).delete()
    CommentReply.query.filter_by(author_id=uid).delete()
    Comment.query.filter_by(author_id=uid).delete()
    for p in Post.query.filter_by(author_id=uid).all():
        db.session.delete(p)
    ReelLike.query.filter_by(user_id=uid).delete()
    ReelComment.query.filter_by(author_id=uid).delete()
    for r in Reel.query.filter_by(author_id=uid).all():
        db.session.delete(r)
    Story.query.filter_by(author_id=uid).delete()
    FriendLink.query.filter((FriendLink.user_id == uid) | (FriendLink.friend_id == uid)).delete()
    Follow.query.filter((Follow.follower_id == uid) | (Follow.followee_id == uid)).delete()
    BlockedUser.query.filter((BlockedUser.user_id == uid) | (BlockedUser.blocked_id == uid)).delete()
    SavedItem.query.filter_by(user_id=uid).delete()
    Notification.query.filter((Notification.user_id == uid) | (Notification.actor_id == uid)).delete()
    JobApplication.query.filter_by(user_id=uid).delete()

    my_conv_ids = [cp.conversation_id for cp in ConversationParticipant.query.filter_by(user_id=uid).all()]
    for cid in my_conv_ids:
        conv = Conversation.query.get(cid)
        if conv:
            db.session.delete(conv)

    user = User.query.get(uid)
    logout_user()
    session.clear()
    if user:
        db.session.delete(user)
    db.session.commit()
    return ok({"message": "Account deleted."})

import os
import requests
from urllib.parse import urlencode
from flask import redirect

GOOGLE_DISCOVERY_URL = "https://accounts.google.com/.well-known/openid-configuration"

@auth_bp.get("/google/login")
def google_login():
    client_id = os.environ.get("GOOGLE_CLIENT_ID")
    redirect_uri = request.host_url.rstrip("/") + "/api/auth/google/callback"
    if "localhost" not in redirect_uri and "127.0.0.1" not in redirect_uri:
        redirect_uri = redirect_uri.replace("http://", "https://")
    
    provider_cfg = requests.get(GOOGLE_DISCOVERY_URL).json()
    authorization_endpoint = provider_cfg["authorization_endpoint"]
    
    params = {
        "client_id": client_id,
        "response_type": "code",
        "redirect_uri": redirect_uri,
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "consent"
    }
    url = f"{authorization_endpoint}?{urlencode(params)}"
    return redirect(url)

@auth_bp.get("/google/callback")
def google_callback():
    code = request.args.get("code")
    client_id = os.environ.get("GOOGLE_CLIENT_ID")
    client_secret = os.environ.get("GOOGLE_CLIENT_SECRET")
    redirect_uri = request.host_url.rstrip("/") + "/api/auth/google/callback"
    if "localhost" not in redirect_uri and "127.0.0.1" not in redirect_uri:
        redirect_uri = redirect_uri.replace("http://", "https://")
    
    provider_cfg = requests.get(GOOGLE_DISCOVERY_URL).json()
    token_endpoint = provider_cfg["token_endpoint"]
    
    token_data = {
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code"
    }
    token_res = requests.post(token_endpoint, data=token_data).json()
    
    if "access_token" not in token_res:
        return f"Failed to get token from Google.", 400
        
    userinfo_endpoint = provider_cfg["userinfo_endpoint"]
    userinfo = requests.get(userinfo_endpoint, headers={"Authorization": f"Bearer {token_res['access_token']}"}).json()
    
    email = userinfo.get("email")
    name = userinfo.get("name")
    avatar = userinfo.get("picture", DEFAULT_AVATAR)
    
    if not email:
        return "Email not provided by Google.", 400
        
    user = User.query.filter_by(email=email).first()
    if not user:
        username = slugify_username(name)
        user = User(
            id=f"u_{uuid.uuid4().hex[:12]}",
            name=name,
            username=username,
            email=email,
            avatar=avatar,
            cover=DEFAULT_COVER,
            bio="",
        )
        user.set_password(uuid.uuid4().hex)
        db.session.add(user)
        db.session.commit()
    else:
        if getattr(user, 'is_banned', False):
            return "This account has been banned.", 403
        
    session.permanent = True
    login_user(user, remember=True, force=True)
    
    if not getattr(user, 'is_active', True):
        user.is_active = True
        db.session.commit()
        
    return redirect("/")

