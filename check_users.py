import os
from dotenv import load_dotenv
load_dotenv('.env')

from backend.app import create_app
from backend.extensions import db
from backend.models import User, Post

app = create_app()

with app.app_context():
    users = User.query.all()
    for u in users:
        post_count = Post.query.filter_by(author_id=u.id).count()
        print(f"User: {u.username} (ID: {u.id}) - Posts: {post_count}")
