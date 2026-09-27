import os
from dotenv import load_dotenv

load_dotenv('.env')

from backend.app import create_app
from backend.extensions import db
from backend.models import User

app = create_app()

def fix_avatars():
    old_avatar = "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80"
    new_avatar = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ccc'%3E%3Cpath d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z'/%3E%3C/svg%3E"
    
    with app.app_context():
        users = User.query.filter_by(avatar=old_avatar).all()
        for u in users:
            u.avatar = new_avatar
        db.session.commit()
        print(f"Updated {len(users)} avatars to the new generic placeholder.")

if __name__ == '__main__':
    fix_avatars()
