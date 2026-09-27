from flask import Blueprint, request
from flask_login import login_required, current_user

from ..extensions import db
from ..models import JobVacancy, JobApplication, Notification, new_id
from ..utils import err, ok

jobs_bp = Blueprint("jobs", __name__, url_prefix="/api/jobs")


@jobs_bp.post("")
@login_required
def create_job():
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "").strip()
    company = (data.get("company") or "").strip()
    if not title or not company:
        return err("Job title and company are required.")

    job = JobVacancy(
        id=data.get("id") or new_id("j"),
        posted_by=current_user.id,
        company=company,
        logo=data.get("logo") or "",
        title=title,
        type=data.get("type") or "Full-Time",
        location=data.get("location") or "Remote",
        remote=data.get("remote") or "Hybrid",
        salary=data.get("salary") or "Competitive",
        category=data.get("category") or "Engineering",
        description=data.get("description") or "",
        requirements=data.get("requirements") or [],
        benefits=data.get("benefits") or [],
    )
    if JobVacancy.query.get(job.id):
        job.id = new_id("j")

    db.session.add(job)
    db.session.commit()
    return ok({"job": job.to_dict(current_user_id=current_user.id)}, 201)


@jobs_bp.post("/<job_id>/apply")
@login_required
def apply_to_job(job_id):
    job = JobVacancy.query.get(job_id)
    if not job:
        return err("Job not found.", 404)

    if JobApplication.query.filter_by(job_id=job_id, user_id=current_user.id).first():
        return err("You already applied to this job.", 409)

    db.session.add(JobApplication(job_id=job_id, user_id=current_user.id))
    db.session.add(Notification(
        user_id=current_user.id,
        actor_id=None,
        type="job",
        text=f"You have successfully applied for the {job.title} role at {job.company}.",
        target_id=job_id,
    ))
    db.session.commit()
    return ok({"job": job.to_dict(current_user_id=current_user.id)})
