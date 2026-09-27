import os

from flask import Flask, send_from_directory, jsonify
from flask_login import LoginManager

from .config import Config, FRONTEND_DIR, UPLOAD_DIR
from .extensions import db, login_manager, socketio
from .models import User
from .seed import seed_if_empty


def create_app():
    app = Flask(__name__, static_folder=None)
    app.config.from_object(Config)

    try:
        os.makedirs(UPLOAD_DIR, exist_ok=True)
    except OSError:
        pass # Vercel read-only filesystem

    db.init_app(app)
    login_manager.init_app(app)
    socketio.init_app(app)

    # Registers the @socketio.on(...) call-signaling handlers (see sockets.py).
    from . import sockets  # noqa: F401

    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(user_id)

    @login_manager.unauthorized_handler
    def unauthorized():
        return jsonify({"error": "Authentication required."}), 401

    # ------------------------------------------------------------------
    # API blueprints
    # ------------------------------------------------------------------
    from .routes.auth import auth_bp
    from .routes.bootstrap import bootstrap_bp
    from .routes.uploads import uploads_bp
    from .routes.posts import posts_bp
    from .routes.social import social_bp
    from .routes.content import content_bp
    from .routes.jobs import jobs_bp
    from .routes.pages import pages_bp
    from .routes.messaging import messaging_bp
    from .routes.notifications import notifications_bp
    from .routes.admin import admin_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(bootstrap_bp)
    app.register_blueprint(uploads_bp)
    app.register_blueprint(posts_bp)
    app.register_blueprint(social_bp)
    app.register_blueprint(content_bp)
    app.register_blueprint(jobs_bp)
    app.register_blueprint(pages_bp)
    app.register_blueprint(messaging_bp)
    app.register_blueprint(notifications_bp)
    app.register_blueprint(admin_bp)

    # ------------------------------------------------------------------
    # Uploaded media (avatars, post/story photos, chat images, etc.)
    # ------------------------------------------------------------------
    @app.route("/uploads/<path:filename>")
    def uploaded_file(filename):
        return send_from_directory(UPLOAD_DIR, filename)

    # ------------------------------------------------------------------
    # Frontend (static single-page app)
    # ------------------------------------------------------------------
    @app.route("/")
    def index():
        return send_from_directory(FRONTEND_DIR, "index.html")

    @app.route("/<path:filename>")
    def frontend_files(filename):
        full_path = os.path.join(FRONTEND_DIR, filename)
        if os.path.isfile(full_path):
            return send_from_directory(FRONTEND_DIR, filename)
        # Unknown path -> hand back to the SPA shell instead of a raw 404
        return send_from_directory(FRONTEND_DIR, "index.html")

    @app.errorhandler(413)
    def too_large(e):
        return jsonify({"error": "File is too large. Maximum upload size is 25MB."}), 413

    with app.app_context():
        db.create_all()
        seed_if_empty()

        from .models import AdminUser
        if not AdminUser.query.first():
            admin = AdminUser(username="admin")
            admin.set_password("admin123")
            db.session.add(admin)
            db.session.commit()

    return app
