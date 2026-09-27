import os
import sys

# Add the parent directory to Python path so backend can be imported
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import traceback
from backend.app import create_app

try:
    _raw_app = create_app()
    
    class CatchAllMiddleware:
        def __init__(self, app):
            self.app = app
        def __call__(self, environ, start_response):
            try:
                return self.app(environ, start_response)
            except Exception as e:
                start_response('500 Internal Server Error', [('Content-Type', 'text/plain')])
                return [traceback.format_exc().encode('utf-8')]
                
    _raw_app.wsgi_app = CatchAllMiddleware(_raw_app.wsgi_app)
    app = _raw_app
    
except Exception as e:
    err_msg = traceback.format_exc().encode('utf-8')
    class FallbackApp:
        def __call__(self, environ, start_response):
            start_response('500 Internal Server Error', [('Content-Type', 'text/plain')])
            return [err_msg]
    app = FallbackApp()


# Vercel needs the 'app' variable to route HTTP requests via WSGI.
# Note: Vercel does not support persistent WebSockets natively. 
# SocketIO will automatically fall back to HTTP long-polling.
