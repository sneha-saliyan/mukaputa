from flask import Blueprint, request
from flask_login import login_required

from ..utils import err, ok, save_uploaded_file

uploads_bp = Blueprint("uploads", __name__, url_prefix="/api")


@uploads_bp.post("/upload")
@login_required
def upload_file():
    file = request.files.get("file")
    url, error = save_uploaded_file(file)
    if error:
        return err(error)
    return ok({"url": url})
