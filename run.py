"""
Mukaputa - entry point.

Usage:
    pip install -r requirements.txt
    python run.py

Then open http://localhost:5000 in your browser.
"""
import os
from dotenv import load_dotenv

load_dotenv()

from backend.app import create_app
from backend.extensions import socketio

app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("MUKAPUTA_DEBUG", "1") == "1"
    print(f"\n  Mukaputa is running -> http://localhost:{port}\n")
    socketio.run(app, host="0.0.0.0", port=port, debug=debug)
