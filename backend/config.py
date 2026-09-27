import os

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
DB_PATH = os.path.join(BASE_DIR, "mukaputa.db")


class Config:
    # NOTE: In a real production deployment this should be a long random
    # value pulled from the environment, never committed to source control.
    SECRET_KEY = os.environ.get("MUKAPUTA_SECRET_KEY", "dev-secret-key-change-me-in-production")

    SQLALCHEMY_DATABASE_URI = os.environ.get("MUKAPUTA_DATABASE_URL", f"sqlite:///{DB_PATH}")
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    SUPABASE_URL = os.environ.get("SUPABASE_URL")
    SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

    MAX_CONTENT_LENGTH = 25 * 1024 * 1024  # 25 MB upload limit (covers reel/video uploads)

    UPLOAD_FOLDER = UPLOAD_DIR
    ALLOWED_UPLOAD_EXTENSIONS = {
        "png", "jpg", "jpeg", "gif", "webp", "bmp", "svg",
        "mp4", "webm", "mov", "m4v", "mp3", "wav", "ogg", "m4a",
    }

    # Session cookie behaves like a normal login session (30 days "remember me")
    PERMANENT_SESSION_LIFETIME = 60 * 60 * 24 * 30
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
