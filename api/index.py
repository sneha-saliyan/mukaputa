import os
import sys
import traceback

# Add the parent directory to Python path so backend can be imported
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

class VercelApp:
    def __init__(self):
        self._app = None
        self._error = None

    def initialize(self):
        try:
            from backend.app import create_app
            self._app = create_app()
        except Exception as e:
            self._error = traceback.format_exc().encode('utf-8')

    def __call__(self, environ, start_response):
        if self._app is None and self._error is None:
            self.initialize()
            
        if self._error:
            start_response('500 Internal Server Error', [('Content-Type', 'text/plain')])
            return [self._error]
            
        try:
            return self._app.wsgi_app(environ, start_response)
        except Exception as e:
            start_response('500 Internal Server Error', [('Content-Type', 'text/plain')])
            return [traceback.format_exc().encode('utf-8')]

# Vercel's static analyzer STRICTLY requires this to be at the absolute top-level indentation.
app = VercelApp()
