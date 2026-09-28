from flask import Blueprint, request
from flask_login import login_required, current_user

from ..extensions import db
from ..models import Story, Reel, ReelLike, ReelComment, Note, new_id
from ..utils import err, ok, notify

content_bp = Blueprint("content", __name__, url_prefix="/api")


@content_bp.post("/stories")
@login_required
def create_story():
    data = request.get_json(silent=True) or {}
    media = data.get("media")
    if not media:
        return err("Story media is required.")

    story = Story(id=data.get("id") or new_id("s"), author_id=current_user.id,
                  media=media, caption=data.get("caption") or "")
    if Story.query.get(story.id):
        story.id = new_id("s")

    db.session.add(story)
    db.session.commit()
    return ok({"story": story.to_dict()}, 201)


@content_bp.delete("/stories/<story_id>")
@login_required
def delete_story(story_id):
    story = Story.query.get(story_id)
    if not story:
        return err("Story not found.", 404)
    if story.author_id != current_user.id:
        return err("You can only delete your own stories.", 403)
    db.session.delete(story)
    db.session.commit()
    return ok()

@content_bp.post("/stories/<story_id>/view")
@login_required
def view_story(story_id):
    story = Story.query.get(story_id)
    if not story:
        return err("Story not found.", 404)
    
    viewers = story.viewers or []
    if current_user.id not in viewers and current_user.id != story.author_id:
        viewers.append(current_user.id)
        # SQLAlchemy JSON columns sometimes need reassignment to register changes
        story.viewers = list(viewers) 
        db.session.commit()
    
    return ok({"viewers": story.viewers})


@content_bp.post("/reels")
@login_required
def create_reel():
    data = request.get_json(silent=True) or {}
    media = data.get("media")
    if not media:
        return err("Please attach a video to your reel.")

    reel = Reel(id=data.get("id") or new_id("r"), author_id=current_user.id,
                media=media, caption=data.get("caption") or "")
    if Reel.query.get(reel.id):
        reel.id = new_id("r")

    db.session.add(reel)
    db.session.commit()
    return ok({"reel": reel.to_dict()}, 201)


@content_bp.delete("/reels/<reel_id>")
@login_required
def delete_reel(reel_id):
    reel = Reel.query.get(reel_id)
    if not reel:
        return err("Reel not found.", 404)
    if reel.author_id != current_user.id:
        return err("You can only delete your own reels.", 403)
    db.session.delete(reel)
    db.session.commit()
    return ok()


@content_bp.post("/reels/<reel_id>/like")
@login_required
def toggle_reel_like(reel_id):
    reel = Reel.query.get(reel_id)
    if not reel:
        return err("Reel not found.", 404)

    existing = ReelLike.query.filter_by(reel_id=reel_id, user_id=current_user.id).first()
    if existing:
        db.session.delete(existing)
        liked = False
    else:
        db.session.add(ReelLike(reel_id=reel_id, user_id=current_user.id))
        liked = True
        notify(reel.author_id, current_user.id, "like", f"{current_user.name} liked your reel.", reel_id)

    db.session.commit()
    return ok({"liked": liked})


@content_bp.post("/reels/<reel_id>/comments")
@login_required
def add_reel_comment(reel_id):
    reel = Reel.query.get(reel_id)
    if not reel:
        return err("Reel not found.", 404)

    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    if not text:
        return err("Comment text is required.")

    comment = ReelComment(id=data.get("id") or new_id("rc"), reel_id=reel_id,
                           author_id=current_user.id, text=text)
    if ReelComment.query.get(comment.id):
        comment.id = new_id("rc")
    db.session.add(comment)

    notify(reel.author_id, current_user.id, "comment", f"{current_user.name} commented on your reel.", reel_id)

    db.session.commit()
    return ok({"comment": comment.to_dict()}, 201)


@content_bp.put("/reels/<reel_id>/comments/<comment_id>")
@login_required
def edit_reel_comment(reel_id, comment_id):
    comment = ReelComment.query.filter_by(id=comment_id, reel_id=reel_id).first()
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


@content_bp.delete("/reels/<reel_id>/comments/<comment_id>")
@login_required
def delete_reel_comment(reel_id, comment_id):
    comment = ReelComment.query.filter_by(id=comment_id, reel_id=reel_id).first()
    if not comment:
        return err("Comment not found.", 404)
    
    # Allow the comment author OR the reel author to delete the comment
    reel = Reel.query.get(reel_id)
    if comment.author_id != current_user.id and (not reel or reel.author_id != current_user.id):
        return err("Not authorized to delete this comment.", 403)

    db.session.delete(comment)
    db.session.commit()
    return ok()

@content_bp.post("/notes")
@login_required
def create_note():
    data = request.get_json(silent=True) or {}
    text = data.get("text", "").strip()
    if not text:
        return err("Note text is required.")
    if len(text) > 60:
        return err("Note cannot exceed 60 characters.")

    # Delete existing active notes for this user
    Note.query.filter_by(user_id=current_user.id).delete()
    
    note = Note(id=data.get("id") or new_id("n"), user_id=current_user.id, text=text)
    db.session.add(note)
    db.session.commit()
    return ok(note.to_dict())

@content_bp.delete("/notes")
@login_required
def delete_note():
    Note.query.filter_by(user_id=current_user.id).delete()
    db.session.commit()
    return ok({"success": True})
