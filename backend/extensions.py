from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_socketio import SocketIO

db = SQLAlchemy()
login_manager = LoginManager()
login_manager.session_protection = "strong"

# threading async mode + simple-websocket gives real WebSocket upgrades
# without requiring eventlet/gevent -- good enough for a self-hosted app.
socketio = SocketIO(cors_allowed_origins="*", async_mode="threading")
