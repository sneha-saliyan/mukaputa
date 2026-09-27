from flask import Blueprint, request
from flask_login import login_required, current_user

from ..extensions import db
from ..models import Page, PageFollower, new_id
from ..utils import err, ok

pages_bp = Blueprint("pages", __name__, url_prefix="/api/pages")


@pages_bp.post("")
@login_required
def create_page():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return err("Page name is required.")

    page = Page(
        id=data.get("id") or new_id("pg"),
        name=name,
        category=data.get("category") or "General",
        cover=data.get("cover") or "",
        description=data.get("description") or "",
        created_by=current_user.id,
    )
    if Page.query.get(page.id):
        page.id = new_id("pg")

    db.session.add(page)
    db.session.flush()
    db.session.add(PageFollower(page_id=page.id, user_id=current_user.id))
    db.session.commit()
    return ok({"page": page.to_dict()}, 201)


@pages_bp.post("/<page_id>/follow")
@login_required
def follow_page(page_id):
    if not Page.query.get(page_id):
        return err("Page not found.", 404)
    if not PageFollower.query.filter_by(page_id=page_id, user_id=current_user.id).first():
        db.session.add(PageFollower(page_id=page_id, user_id=current_user.id))
        db.session.commit()
    return ok()


@pages_bp.post("/<page_id>/unfollow")
@login_required
def unfollow_page(page_id):
    PageFollower.query.filter_by(page_id=page_id, user_id=current_user.id).delete()
    db.session.commit()
    return ok()
