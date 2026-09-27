import os
import uuid

from flask import jsonify, current_app
from werkzeug.utils import secure_filename

from .extensions import db
from .models import Notification


def err(message, status=400):
    return jsonify({"error": message}), status


def ok(data=None, status=200):
    if data is None:
        data = {"success": True}
    return jsonify(data), status


def allowed_file(filename):
    if "." not in filename:
        return False
    ext = filename.rsplit(".", 1)[1].lower()
    return ext in current_app.config["ALLOWED_UPLOAD_EXTENSIONS"]


def save_uploaded_file(file_storage):
    """Saves a werkzeug FileStorage to Supabase Storage (if configured) or local folder."""
    if not file_storage or file_storage.filename == "":
        return None, "No file provided"

    original = secure_filename(file_storage.filename)
    if not original or not allowed_file(original):
        return None, "File type not allowed"

    ext = original.rsplit(".", 1)[1].lower()
    filename = f"{uuid.uuid4().hex}.{ext}"

    # Use Supabase Storage if configured
    if current_app.config.get("SUPABASE_URL") and current_app.config.get("SUPABASE_KEY"):
        try:
            from supabase import create_client
            supabase = create_client(current_app.config["SUPABASE_URL"], current_app.config["SUPABASE_KEY"])
            
            # Create bucket if it doesn't exist (fails silently if it does)
            try:
                supabase.storage.get_bucket("media")
            except Exception:
                try:
                    supabase.storage.create_bucket("media")
                    supabase.storage.update_bucket("media", {"public": True})
                except Exception:
                    pass
                
            content_type = file_storage.mimetype
            
            import requests
            
            url = current_app.config["SUPABASE_URL"]
            key = current_app.config["SUPABASE_KEY"]
            content_type = file_storage.mimetype
            file_bytes = file_storage.read()
            
            endpoint = f"{url}/storage/v1/object/media/{filename}"
            headers = {
                "apikey": key,
                "Authorization": f"Bearer {key}",
                "Content-Type": content_type
            }
            
            # Use requests directly to bypass all httpx/supabase-py binary upload bugs on Windows
            res = requests.post(endpoint, headers=headers, data=file_bytes)
            
            if res.status_code >= 400:
                raise Exception(res.text)
            
            # Get public URL
            public_url = f"{url}/storage/v1/object/public/media/{filename}"
            return public_url, None
        except Exception as e:
            print(f"Supabase upload error: {e}")
            return None, f"Cloud upload failed: {str(e)}"

    # Fallback to local storage
    dest = os.path.join(current_app.config["UPLOAD_FOLDER"], filename)
    file_storage.save(dest)
    return f"/uploads/{filename}", None


def notify(user_id, actor_id, ntype, text, target_id=None):
    """Create a notification for user_id, unless they are notifying themselves."""
    if not user_id or user_id == actor_id:
        return
    n = Notification(user_id=user_id, actor_id=actor_id, type=ntype, text=text, target_id=target_id)
    db.session.add(n)
    return n


def paginate_request_json(request, *keys):
    data = request.get_json(silent=True) or {}
    return [data.get(k) for k in keys]
