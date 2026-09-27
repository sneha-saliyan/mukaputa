import os
from dotenv import load_dotenv

# We load .env to respect the current configuration (Supabase or SQLite)
load_dotenv('.env')

from backend.app import create_app
from backend.extensions import db
from backend.models import (
    User, FriendLink, Follow, SavedItem,
    Post, PostReaction, Comment, CommentReply,
    Story, Reel, ReelLike, ReelComment,
    WatchVideo, Page, PageFollower,
    JobVacancy, JobApplication,
    Conversation, ConversationParticipant, Message,
    Notification,
)
from sqlalchemy import or_

app = create_app()

def remove_dummy_accounts():
    dummy_ids = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7']
    
    with app.app_context():
        print(f"Connecting to database to remove dummy accounts: {dummy_ids}...")
        
        # 1. Delete Notifications
        Notification.query.filter(
            or_(
                Notification.user_id.in_(dummy_ids),
                Notification.actor_id.in_(dummy_ids),
                Notification.target_id.in_(dummy_ids)
            )
        ).delete(synchronize_session=False)

        # 2. Delete Messages and Conversation Participants
        Message.query.filter(Message.sender_id.in_(dummy_ids)).delete(synchronize_session=False)
        ConversationParticipant.query.filter(ConversationParticipant.user_id.in_(dummy_ids)).delete(synchronize_session=False)
        
        # Conversations don't strictly belong to a single user in the model, but the seed script creates conv1 and conv2
        Conversation.query.filter(Conversation.id.in_(["conv1", "conv2"])).delete(synchronize_session=False)
        
        # 3. Delete Job Applications and Vacancies
        JobApplication.query.filter(JobApplication.user_id.in_(dummy_ids)).delete(synchronize_session=False)
        
        vacancies = JobVacancy.query.filter(JobVacancy.posted_by.in_(dummy_ids)).all()
        vacancy_ids = [v.id for v in vacancies]
        if vacancy_ids:
            JobApplication.query.filter(JobApplication.job_id.in_(vacancy_ids)).delete(synchronize_session=False)
            
        JobVacancy.query.filter(JobVacancy.posted_by.in_(dummy_ids)).delete(synchronize_session=False)

        # 4. Delete Pages and Followers
        PageFollower.query.filter(PageFollower.user_id.in_(dummy_ids)).delete(synchronize_session=False)
        
        pages = Page.query.filter(Page.created_by.in_(dummy_ids)).all()
        page_ids = [p.id for p in pages]
        if page_ids:
            PageFollower.query.filter(PageFollower.page_id.in_(page_ids)).delete(synchronize_session=False)
            
        Page.query.filter(Page.created_by.in_(dummy_ids)).delete(synchronize_session=False)

        # 5. Delete Watch Videos
        WatchVideo.query.filter(WatchVideo.author_id.in_(dummy_ids)).delete(synchronize_session=False)

        # 6. Delete Reels, Comments, Likes
        ReelLike.query.filter(ReelLike.user_id.in_(dummy_ids)).delete(synchronize_session=False)
        ReelComment.query.filter(ReelComment.author_id.in_(dummy_ids)).delete(synchronize_session=False)
        
        reels = Reel.query.filter(Reel.author_id.in_(dummy_ids)).all()
        reel_ids = [r.id for r in reels]
        if reel_ids:
            ReelLike.query.filter(ReelLike.reel_id.in_(reel_ids)).delete(synchronize_session=False)
            ReelComment.query.filter(ReelComment.reel_id.in_(reel_ids)).delete(synchronize_session=False)
            
        Reel.query.filter(Reel.author_id.in_(dummy_ids)).delete(synchronize_session=False)

        # 7. Delete Stories
        Story.query.filter(Story.author_id.in_(dummy_ids)).delete(synchronize_session=False)

        # 8. Delete Posts, Comments, Replies, Reactions, Saved Items
        SavedItem.query.filter(SavedItem.user_id.in_(dummy_ids)).delete(synchronize_session=False)
        PostReaction.query.filter(PostReaction.user_id.in_(dummy_ids)).delete(synchronize_session=False)
        CommentReply.query.filter(CommentReply.author_id.in_(dummy_ids)).delete(synchronize_session=False)
        Comment.query.filter(Comment.author_id.in_(dummy_ids)).delete(synchronize_session=False)
        
        posts = Post.query.filter(Post.author_id.in_(dummy_ids)).all()
        post_ids = [p.id for p in posts]
        if post_ids:
            SavedItem.query.filter(SavedItem.item_id.in_(post_ids)).delete(synchronize_session=False)
            PostReaction.query.filter(PostReaction.post_id.in_(post_ids)).delete(synchronize_session=False)
            
            comments = Comment.query.filter(Comment.post_id.in_(post_ids)).all()
            comment_ids = [c.id for c in comments]
            if comment_ids:
                CommentReply.query.filter(CommentReply.comment_id.in_(comment_ids)).delete(synchronize_session=False)
                
            Comment.query.filter(Comment.post_id.in_(post_ids)).delete(synchronize_session=False)
            
        Post.query.filter(Post.author_id.in_(dummy_ids)).delete(synchronize_session=False)

        # 9. Delete Follows and FriendLinks
        Follow.query.filter(
            or_(
                Follow.follower_id.in_(dummy_ids),
                Follow.followee_id.in_(dummy_ids)
            )
        ).delete(synchronize_session=False)
        
        FriendLink.query.filter(
            or_(
                FriendLink.user_id.in_(dummy_ids),
                FriendLink.friend_id.in_(dummy_ids)
            )
        ).delete(synchronize_session=False)

        # 10. Delete the users themselves
        deleted_count = User.query.filter(User.id.in_(dummy_ids)).delete(synchronize_session=False)
        
        db.session.commit()
        print(f"Successfully deleted {deleted_count} dummy accounts and all their related data!")

if __name__ == '__main__':
    try:
        remove_dummy_accounts()
    except Exception as e:
        print("Error connecting to the database or removing accounts:")
        print(str(e))
        print("\nNote: If you are trying to connect to Supabase and seeing a connection error,")
        print("your Supabase database might be paused due to inactivity.")
