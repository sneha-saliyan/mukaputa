import os
import sys

# Add the parent directory to Python path so backend can be imported
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.app import create_app
from backend.extensions import socketio

app = create_app()

# Vercel needs the 'app' variable to route HTTP requests via WSGI.
# Note: Vercel does not support persistent WebSockets natively. 
# SocketIO will automatically fall back to HTTP long-polling.
