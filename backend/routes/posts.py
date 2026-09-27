from flask import Blueprint, request
from flask_login import login_required, current_user

from ..extensions import db
from ..models import Post, PostReaction, Comment, CommentReply, new_id
from ..utils import err, ok, notify

posts_bp = Blueprint("posts", __name__, url_prefix="/api/posts")

VALID_REACTIONS = {"like", "love", "haha", "wow", "sad", "angry"}
REACTION_VERBS = {
    "like": "liked your post.",
    "love": "loved your post.",
    "haha": "laughed at your post.",
    "wow": "was amazed by your post.",
    "sad": "reacted sad to your post.",
    "angry": "reacted angry to your post.",
}


@posts_bp.post("")
@login_required
def create_post():
    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    media = data.get("media") or []
    feeling = data.get("feeling") or ""

    if not text and not media:
        return err("A post needs text or media.")

    post = Post(
        id=data.get("id") or new_id("p"),
        author_id=current_user.id,
        text=text,
        media=media,
        feeling=feeling,
    )
    if Post.query.get(post.id):
        post.id = new_id("p")

    db.session.add(post)
    db.session.commit()
    return ok({"post": post.to_dict()}, 201)


@posts_bp.put("/<post_id>")
@login_required
def edit_post(post_id):
    post = Post.query.get(post_id)
    if not post:
        return err("Post not found.", 404)
    if post.author_id != current_user.id:
        return err("You can only edit your own posts.", 403)

    data = request.get_json(silent=True) or {}
    text = data.get("text")
    if text is not None:
        post.text = text.strip()
    db.session.commit()
    return ok({"post": post.to_dict()})


@posts_bp.delete("/<post_id>")
@login_required
def delete_post(post_id):
    post = Post.query.get(post_id)
    if not post:
        return err("Post not found.", 404)
    if post.author_id != current_user.id:
        return err("You can only delete your own posts.", 403)

    db.session.delete(post)
    db.session.commit()
    return ok()


@posts_bp.post("/<post_id>/react")
@login_required
def react_to_post(post_id):
    post = Post.query.get(post_id)
    if not post:
        return err("Post not found.", 404)

    data = request.get_json(silent=True) or {}
    reaction_type = data.get("type")

    existing = PostReaction.query.filter_by(post_id=post_id, user_id=current_user.id).first()
    prev_type = existing.type if existing else None

    if existing:
        db.session.delete(existing)

    added_type = None
    if reaction_type and reaction_type in VALID_REACTIONS and reaction_type != prev_type:
        db.session.add(PostReaction(post_id=post_id, user_id=current_user.id, type=reaction_type))
        added_type = reaction_type

    if added_type:
        notify(post.author_id, current_user.id, added_type,
               f"{current_user.name} " + REACTION_VERBS[added_type], post_id)

    db.session.commit()
    return ok({"post": post.to_dict()})


@posts_bp.post("/<post_id>/comments")
@login_required
def add_comment(post_id):
    post = Post.query.get(post_id)
    if not post:
        return err("Post not found.", 404)

    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    if not text:
        return err("Comment text is required.")

    comment = Comment(id=data.get("id") or new_id("c"), post_id=post_id,
                       author_id=current_user.id, text=text)
    if Comment.query.get(comment.id):
        comment.id = new_id("c")
    db.session.add(comment)

    notify(post.author_id, current_user.id, "comment",
           f"{current_user.name} commented on your post: \u201c{text[:60]}\u201d", post_id)

    db.session.commit()
    return ok({"comment": comment.to_dict()}, 201)

@posts_bp.put("/<post_id>/comments/<comment_id>")
@login_required
def edit_comment(post_id, comment_id):
    comment = Comment.query.filter_by(id=comment_id, post_id=post_id).first()
    if not comment:
        return err("Comment not found.", 404)
    if comment.author_id != current_user.id:
        return err("You can only edit your own comments.", 403)

    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    if not text:
        return err("Comment text is required.")

    comment.text = text
    db.session.commit()
    return ok({"comment": comment.to_dict()})

@posts_bp.delete("/<post_id>/comments/<comment_id>")
@login_required
def delete_comment(post_id, comment_id):
    comment = Comment.query.filter_by(id=comment_id, post_id=post_id).first()
    if not comment:
        return err("Comment not found.", 404)
    
    post = Post.query.get(post_id)
    if comment.author_id != current_user.id and (not post or post.author_id != current_user.id):
        return err("Not authorized to delete this comment.", 403)

    db.session.delete(comment)
    db.session.commit()
    return ok()


@posts_bp.post("/<post_id>/comments/<comment_id>/replies")
@login_required
def add_reply(post_id, comment_id):
    comment = Comment.query.filter_by(id=comment_id, post_id=post_id).first()
    if not comment:
        return err("Comment not found.", 404)

    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    if not text:
        return err("Reply text is required.")

    reply = CommentReply(id=data.get("id") or new_id("cr"), comment_id=comment_id,
                          author_id=current_user.id, text=text)
    if CommentReply.query.get(reply.id):
        reply.id = new_id("cr")
    db.session.add(reply)

    notify(comment.author_id, current_user.id, "comment",
           f"{current_user.name} replied to your comment: \u201c{text[:60]}\u201d", post_id)

    db.session.commit()
    return ok({"reply": reply.to_dict()}, 201)


@posts_bp.post("/report")
@login_required
def submit_report():
    from ..models import Report
    data = request.get_json(silent=True) or {}
    content_type = data.get("contentType")
    content_id = data.get("contentId")
    reason = (data.get("reason") or "").strip()
    if not content_type or not content_id or not reason:
        return err("contentType, contentId and reason are required.", 400)
    if content_type not in ("post", "reel"):
        return err("contentType must be 'post' or 'reel'.", 400)
    existing = Report.query.filter_by(
        reporter_id=current_user.id,
        content_type=content_type,
        content_id=content_id
    ).first()
    if existing:
        return err("You have already reported this content.", 409)
    report = Report(
        reporter_id=current_user.id,
        content_type=content_type,
        content_id=content_id,
        reason=reason,
    )
    db.session.add(report)
    db.session.commit()
    return ok({"message": "Report submitted. Thank you."})
