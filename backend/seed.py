"""Populates the database with demo content the first time the app is run,
so the product feels like a real, populated social network out of the box.

All seeded accounts share the password: password123
(see README.md for the full list of demo usernames)
"""
from datetime import datetime, timedelta

from .extensions import db
from .models import (
    User, FriendLink, Follow, SavedItem,
    Post, PostReaction, Comment, CommentReply,
    Story, Reel, ReelLike, ReelComment,
    WatchVideo, Page, PageFollower,
    JobVacancy, JobApplication,
    Conversation, ConversationParticipant, Message,
    Notification,
)

DEMO_PASSWORD = "password123"
NOW = None  # set inside seed() so all timestamps share one reference point


def ago(**kwargs):
    return NOW - timedelta(**kwargs)


def seed_if_empty():
    if User.query.first() is not None:
        return  # already seeded (or the user has real data) -- never overwrite

    global NOW
    NOW = datetime.utcnow()

    # -----------------------------------------------------------------
    # USERS
    # -----------------------------------------------------------------
    users_data = [
        dict(id="u1", name="John Doe", username="johndoe",
             avatar="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
             cover="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&auto=format&fit=crop&q=80",
             bio="Lead UI/UX Designer & Frontend Architect \U0001F680 Living life in dark mode.",
             work="Principal Designer at Mukaputa Labs", education="Stanford University",
             location="San Francisco, CA", days=365 * 4),
        dict(id="u2", name="Jane Smith", username="janesmith",
             avatar="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
             cover="https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=1200&auto=format&fit=crop&q=80",
             bio="Coffee enthusiast \u2615\uFE0F Digital creator & photographer.",
             work="Creative Director at Studio V", education="NYU",
             location="New York, NY", days=365 * 5),
        dict(id="u3", name="Michael Johnson", username="mikej",
             avatar="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
             cover="https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&auto=format&fit=crop&q=80",
             bio="Exploring the world one mountain at a time \U0001F3D4\uFE0F",
             work="Adventure Photographer", education="UC Berkeley",
             location="Denver, CO", days=365 * 6),
        dict(id="u4", name="Sarah Connor", username="sarahc",
             avatar="https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80",
             cover="https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1200&auto=format&fit=crop&q=80",
             bio="Tech enthusiast, AI researcher & cybersecurity advocate \U0001F6E1\uFE0F",
             work="AI Ethics Specialist", education="MIT",
             location="Austin, TX", days=365 * 4),
        dict(id="u5", name="Alex Turing", username="alext",
             avatar="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
             cover="https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1200&auto=format&fit=crop&q=80",
             bio="Full Stack Engineer & Open Source contributor.",
             work="Software Engineer", education="Cambridge University",
             location="Seattle, WA", days=365 * 3),
        dict(id="u6", name="Priya Patel", username="priyap",
             avatar="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
             cover="https://images.unsplash.com/photo-1513151233558-d860c5398176?w=1200&auto=format&fit=crop&q=80",
             bio="Culinary artist & food blogger \U0001F35C Sharing delicious recipes.",
             work="Head Chef & Writer", education="Culinary Institute",
             location="Chicago, IL", days=365 * 5),
        dict(id="u7", name="David Kim", username="davidk",
             avatar="https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80",
             cover="https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200&auto=format&fit=crop&q=80",
             bio="Indie Game Developer \U0001F3AE Building virtual worlds.",
             work="Founder at PixelForge", education="UCLA",
             location="Los Angeles, CA", days=365 * 3),
    ]

    users = {}
    for u in users_data:
        user = User(
            id=u["id"], name=u["name"], username=u["username"],
            email=f'{u["username"]}@mukaputa.demo',
            avatar=u["avatar"], cover=u["cover"], bio=u["bio"],
            work=u["work"], education=u["education"], location=u["location"],
            created_at=ago(days=u["days"]),
        )
        user.set_password(DEMO_PASSWORD)
        db.session.add(user)
        users[u["id"]] = user
    db.session.flush()

    # -----------------------------------------------------------------
    # FRIENDSHIPS (mirrors the original demo social graph)
    # -----------------------------------------------------------------
    friend_pairs = [("u1", "u2"), ("u1", "u3"), ("u1", "u4"), ("u1", "u5"), ("u2", "u3"), ("u2", "u6")]
    for a, b in friend_pairs:
        db.session.add(FriendLink(user_id=a, friend_id=b))
        db.session.add(FriendLink(user_id=b, friend_id=a))

    # -----------------------------------------------------------------
    # POSTS
    # -----------------------------------------------------------------
    p1 = Post(id="p1", author_id="u2",
              text="Just launched our brand new design system! Clean orange accents and deep navy vibes. "
                   "What do you all think? \U0001F3A8\u2728",
              media=["https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800&auto=format&fit=crop&q=80"],
              feeling="feeling excited", created_at=ago(hours=2))
    db.session.add(p1)
    for utype, uids in [("like", ["u1", "u3"]), ("love", ["u4", "u5"]), ("wow", ["u6"])]:
        for uid in uids:
            db.session.add(PostReaction(post_id="p1", user_id=uid, type=utype))

    c1 = Comment(id="c1", post_id="p1", author_id="u3",
                 text="This looks phenomenal Jane! The contrast and micro-interactions are so crisp.",
                 created_at=ago(hours=1))
    db.session.add(c1)
    db.session.add(CommentReply(id="cr1", comment_id="c1", author_id="u2",
                                 text="Thanks Mike! Really appreciate the feedback!", created_at=NOW))
    c2 = Comment(id="c2", post_id="p1", author_id="u1",
                 text="Absolutely top tier work. Can't wait to test it on production!",
                 created_at=ago(minutes=30))
    db.session.add(c2)

    p2 = Post(id="p2", author_id="u3",
              text="Sunset over the Rocky Mountains after an 8-mile hike. Nature is the best therapy. \U0001F304\U0001F332",
              media=["https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&auto=format&fit=crop&q=80"],
              feeling="feeling peaceful", created_at=ago(hours=5))
    db.session.add(p2)
    for utype, uids in [("like", ["u2", "u4"]), ("love", ["u1", "u6"]), ("wow", ["u5"])]:
        for uid in uids:
            db.session.add(PostReaction(post_id="p2", user_id=uid, type=utype))
    db.session.add(Comment(id="c3", post_id="p2", author_id="u4",
                            text="Breathtaking view Mike! Take me next time!", created_at=NOW))

    p3 = Post(id="p3", author_id="u4",
              text="Reading through recent developments in distributed agentic architectures. The future of "
                   "autonomous AI pairs is accelerating fast. \U0001F916\u26A1\uFE0F",
              media=[], feeling="feeling curious", created_at=ago(days=1))
    db.session.add(p3)
    for utype, uids in [("like", ["u1", "u5"]), ("wow", ["u2"])]:
        for uid in uids:
            db.session.add(PostReaction(post_id="p3", user_id=uid, type=utype))

    p4 = Post(id="p4", author_id="u6",
              text="Fresh handmade pasta with slow-roasted cherry tomatoes and fresh basil from the garden! "
                   "Recipe dropping soon \U0001F35D\U0001F33F",
              media=["https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&auto=format&fit=crop&q=80"],
              created_at=ago(days=2))
    db.session.add(p4)
    for utype, uids in [("like", ["u3"]), ("love", ["u1", "u2", "u4"])]:
        for uid in uids:
            db.session.add(PostReaction(post_id="p4", user_id=uid, type=utype))

    p_memory = Post(id="p_memory", author_id="u1",
                     text="2 years ago today, we started building Mukaputa. Time flies when you are having fun "
                          "with great people! \U0001F389",
                     media=["https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop&q=80"],
                     created_at=ago(days=365 * 2))
    db.session.add(p_memory)
    for utype, uids in [("like", ["u4", "u5"]), ("love", ["u2", "u3"])]:
        for uid in uids:
            db.session.add(PostReaction(post_id="p_memory", user_id=uid, type=utype))

    db.session.add(SavedItem(user_id="u1", item_id="p1"))

    # -----------------------------------------------------------------
    # STORIES
    # -----------------------------------------------------------------
    stories = [
        ("s1", "u2", "https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=500&auto=format&fit=crop&q=80",
         "Morning coffee & sketch session \u2615\uFE0F"),
        ("s2", "u3", "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=500&auto=format&fit=crop&q=80",
         "Summit reached! \U0001F3D4\uFE0F"),
        ("s3", "u4", "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=500&auto=format&fit=crop&q=80",
         "Late night hackathon vibes \U0001F4BB"),
        ("s4", "u6", "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=500&auto=format&fit=crop&q=80",
         "Dinner is served! \U0001F37D\uFE0F"),
    ]
    for sid, author, media, caption in stories:
        db.session.add(Story(id=sid, author_id=author, media=media, caption=caption, created_at=NOW))

    # -----------------------------------------------------------------
    # REELS
    # -----------------------------------------------------------------
    r1 = Reel(id="r1", author_id="u3",
              media="https://assets.mixkit.co/videos/preview/mixkit-forest-stream-in-the-sunlight-529-large.mp4",
              caption="Found this hidden paradise deep in the Cascades \U0001F332\u2728 #nature #hiking",
              created_at=ago(hours=6))
    db.session.add(r1)
    for uid in ["u1", "u2", "u4"]:
        db.session.add(ReelLike(reel_id="r1", user_id=uid))
    db.session.add(ReelComment(id="rc1", reel_id="r1", author_id="u2", text="Incredible sound! So serene.",
                                created_at=ago(hours=5)))

    r2 = Reel(id="r2", author_id="u6",
              media="https://assets.mixkit.co/videos/preview/mixkit-cutting-vegetables-on-a-wooden-board-41228-large.mp4",
              caption="Mastering knife skills! Cooking tip #101 \U0001F52A\U0001F9C5 #cooking #chef",
              created_at=ago(hours=10))
    db.session.add(r2)
    for uid in ["u1", "u3", "u2"]:
        db.session.add(ReelLike(reel_id="r2", user_id=uid))

    r3 = Reel(id="r3", author_id="u2",
              media="https://assets.mixkit.co/videos/preview/mixkit-hands-of-a-potter-working-on-a-pottery-wheel-41249-large.mp4",
              caption="Mindfulness through ceramics \U0001FFFA #art #pottery", created_at=ago(days=1, hours=3))
    db.session.add(r3)
    for uid in ["u1", "u4", "u3", "u5"]:
        db.session.add(ReelLike(reel_id="r3", user_id=uid))

    # -----------------------------------------------------------------
    # WATCH VIDEOS (curated education/IT catalogue)
    # -----------------------------------------------------------------
    watch_videos = [
        dict(id="v1", author="u2", title="Harvard CS50: Full Introduction to Computer Science & Programming",
             media="https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=800&auto=format&fit=crop&q=80",
             category="Education", subcategory="Computer Science", platform="YouTube",
             url="https://www.youtube.com/watch?v=8mAITcNt710", source="Harvard University",
             desc="World-renowned introductory course covering algorithmic thinking, data structures, C, Python, "
                  "SQL, and web technologies.", views="2.8M views", duration="2:27:14"),
        dict(id="v2", author="u5", title="Google IT Support Professional Certificate \u2014 Training & Career Roadmap",
             media="https://images.unsplash.com/photo-1573164713988-8665fc963095?w=800&auto=format&fit=crop&q=80",
             category="IT Field", subcategory="IT Certification", platform="Google",
             url="https://grow.google/certificates/it-support/", source="Grow with Google",
             desc="Launch an in-demand IT support career. Learn hardware, operating systems, Linux, computer "
                  "networking, and system security.", views="890K views", duration="45:10"),
        dict(id="v3", author="u1",
             title="Full Stack Web Developer Bootcamp \u2014 HTML, CSS, JavaScript, Node.js & APIs",
             media="https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=80",
             category="IT Field", subcategory="Software Development", platform="YouTube",
             url="https://www.youtube.com/watch?v=nu_pCVPKzTk", source="freeCodeCamp.org",
             desc="Complete modern web programming guide from frontend layout to backend architectures, "
                  "databases, and production deployments.", views="1.9M views", duration="3:15:00"),
        dict(id="v4", author="u4", title="Google Cloud Tech: Enterprise Cloud Architecture & Kubernetes Essentials",
             media="https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&auto=format&fit=crop&q=80",
             category="IT Field", subcategory="Cloud Computing", platform="Google",
             url="https://cloud.google.com/training", source="Google Cloud Tech",
             desc="Official Google training on designing reliable, scalable infrastructure, microservices, "
                  "DevOps pipelines, and cloud computing.", views="640K views", duration="38:40"),
        dict(id="v5", author="u3", title="MIT 6.0001: Introduction to Computer Science and Programming in Python",
             media="https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80",
             category="Education", subcategory="Programming & Algorithms", platform="YouTube",
             url="https://www.youtube.com/playlist?list=PLUl4u3cNGP63WbdFxL8giv4yhGDMGaZXV",
             source="MIT OpenCourseWare",
             desc="MIT's core computational curriculum covering problem solving, algorithmic complexity, Python "
                  "syntax, and software foundations.", views="3.2M views", duration="52:18"),
        dict(id="v6", author="u7", title="Google for Education: Applied Digital Skills & Tech Career Pathways",
             media="https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800&auto=format&fit=crop&q=80",
             category="Education", subcategory="Digital Skills", platform="Google",
             url="https://edu.google.com/", source="Google for Education",
             desc="Free, project-based video curricula designed to teach real-world computer skills, data "
                  "management, and digital collaboration.", views="450K views", duration="24:35"),
        dict(id="v7", author="u6", title="Cybersecurity & IT Networking Career Masterclass: From Beginner to Pro",
             media="https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&auto=format&fit=crop&q=80",
             category="IT Field", subcategory="Cybersecurity", platform="YouTube",
             url="https://www.youtube.com/watch?v=inWWhr5tnEA", source="NetworkChuck",
             desc="Master IP addressing, subnets, routers, firewalls, threat analysis, and ethical hacking "
                  "essentials for the IT industry.", views="1.3M views", duration="1:08:22"),
        dict(id="v8", author="u2", title="Google Data Analytics & Python Specialization \u2014 Career Certificate",
             media="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80",
             category="Education", subcategory="Data Science & Analytics", platform="Google",
             url="https://grow.google/certificates/data-analytics/", source="Google Career Certificates",
             desc="Learn how to analyze data, build dashboards, and harness SQL and R/Python to drive intelligent "
                  "tech decisions.", views="780K views", duration="34:12"),
    ]
    for v in watch_videos:
        db.session.add(WatchVideo(id=v["id"], author_id=v["author"], title=v["title"], media=v["media"],
                                   category=v["category"], subcategory=v["subcategory"], platform=v["platform"],
                                   url=v["url"], source_name=v["source"], description=v["desc"],
                                   views=v["views"], duration=v["duration"], created_at=NOW))

    # -----------------------------------------------------------------
    # PAGES
    # -----------------------------------------------------------------
    pg1 = Page(id="pg1", name="Mukaputa Official", category="Software & Technology",
               cover="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80",
               description="The home of Mukaputa \u2014 fast, responsive, modern social connectivity.",
               created_by="u1")
    db.session.add(pg1)
    for uid in users:
        db.session.add(PageFollower(page_id="pg1", user_id=uid))

    pg2 = Page(id="pg2", name="Daily Visual Inspiration", category="Design & Arts",
               cover="https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800&auto=format&fit=crop&q=80",
               description="Curated typography, 3D renders, and award-winning web aesthetics.", created_by="u2")
    db.session.add(pg2)
    for uid in ["u1", "u2", "u3"]:
        db.session.add(PageFollower(page_id="pg2", user_id=uid))

    # -----------------------------------------------------------------
    # JOB VACANCIES
    # -----------------------------------------------------------------
    jobs = [
        dict(id="j1", posted_by="u4", company="Google DeepMind",
             logo="https://images.unsplash.com/photo-1573804633927-bfcbcd909acd?w=200&auto=format&fit=crop&q=80",
             title="Senior Frontend Engineer", type="Full-Time", location="San Francisco, CA", remote="Hybrid",
             salary="$160,000 \u2013 $220,000/yr", category="Engineering",
             description="Join our team building next-generation AI-powered interfaces. You'll own the UI "
                          "architecture for flagship ML products used by millions worldwide.",
             requirements=["5+ years React/Vue/Angular", "TypeScript expert", "Experience with WebGL or Three.js",
                           "Strong system design skills"],
             benefits=["Health & Dental", "Remote flexibility", "401k match", "Annual learning budget $5,000"],
             days=2),
        dict(id="j2", posted_by="u5", company="Stripe",
             logo="https://images.unsplash.com/photo-1611162616475-46b635cb6868?w=200&auto=format&fit=crop&q=80",
             title="Backend Engineer \u2013 Payments Infrastructure", type="Full-Time", location="New York, NY",
             remote="Remote", salary="$180,000 \u2013 $240,000/yr", category="Engineering",
             description="Design and scale the backbone of global payments. Work with distributed systems "
                          "processing billions of dollars in transactions with five-nines reliability.",
             requirements=["Go or Rust experience", "Distributed systems", "PostgreSQL at scale",
                           "Strong CS fundamentals"],
             benefits=["Equity package", "Unlimited PTO", "World-class team", "Global offices"], days=3),
        dict(id="j3", posted_by="u6", company="Figma",
             logo="https://images.unsplash.com/photo-1558655146-d09347e92766?w=200&auto=format&fit=crop&q=80",
             title="Product Designer \u2013 Core Editor", type="Full-Time", location="San Francisco, CA",
             remote="Hybrid", salary="$130,000 \u2013 $175,000/yr", category="Design",
             description="Shape the future of collaborative design tools. You'll define how millions of "
                          "designers across the world create, prototype, and ship products.",
             requirements=["5+ years product design", "Figma power user", "User research experience",
                           "Strong prototyping skills"],
             benefits=["Design stipend", "Wellness program", "Stock options", "Flexible hours"], days=1),
        dict(id="j4", posted_by="u3", company="Anthropic",
             logo="https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=200&auto=format&fit=crop&q=80",
             title="Machine Learning Research Scientist", type="Full-Time", location="San Francisco, CA",
             remote="On-site", salary="$200,000 \u2013 $300,000/yr", category="AI / ML",
             description="Push the frontier of AI safety and capability research. Work alongside world-class "
                          "scientists on alignment, interpretability, and responsible AI deployment.",
             requirements=["PhD in ML/CS or equivalent", "PyTorch expertise", "Published research papers",
                           "Experience with LLMs"],
             benefits=["Equity compensation", "Research budget", "Conference sponsorship",
                       "Cutting-edge hardware"], days=4),
        dict(id="j5", posted_by="u7", company="Notion",
             logo="https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=200&auto=format&fit=crop&q=80",
             title="Full-Stack Developer (React + Node)", type="Full-Time", location="Remote", remote="Remote",
             salary="$120,000 \u2013 $160,000/yr", category="Engineering",
             description="Build the world's most flexible productivity tool. Help us craft seamless real-time "
                          "collaboration features and delightful product experiences.",
             requirements=["React + TypeScript", "Node.js / Express", "PostgreSQL or MongoDB",
                           "REST & GraphQL APIs"],
             benefits=["Fully remote", "Home office stipend", "Team retreats", "Health insurance"], days=5),
        dict(id="j6", posted_by="u2", company="Vercel",
             logo="https://images.unsplash.com/photo-1618477388954-7852f32655ec?w=200&auto=format&fit=crop&q=80",
             title="DevOps / Platform Engineer", type="Full-Time", location="Remote", remote="Remote",
             salary="$140,000 \u2013 $195,000/yr", category="DevOps",
             description="Own the infrastructure powering over 1 million developer deployments per day. Work on "
                          "Kubernetes, edge functions, CI/CD pipelines, and globally distributed systems.",
             requirements=["Kubernetes & Docker", "CI/CD pipelines (GitHub Actions)", "Cloud (AWS/GCP/Azure)",
                           "Infrastructure as Code (Terraform)"],
             benefits=["100% remote", "Competitive equity", "Annual bonus", "Equipment budget"], days=6),
    ]
    for j in jobs:
        db.session.add(JobVacancy(
            id=j["id"], posted_by=j["posted_by"], company=j["company"], logo=j["logo"], title=j["title"],
            type=j["type"], location=j["location"], remote=j["remote"], salary=j["salary"],
            category=j["category"], description=j["description"], requirements=j["requirements"],
            benefits=j["benefits"], posted_at=ago(days=j["days"]),
        ))
    # A little light social proof -- a few of the demo cast have already applied
    db.session.add(JobApplication(job_id="j1", user_id="u2"))
    db.session.add(JobApplication(job_id="j1", user_id="u6"))
    db.session.add(JobApplication(job_id="j3", user_id="u5"))
    db.session.add(JobApplication(job_id="j5", user_id="u3"))

    # -----------------------------------------------------------------
    # CONVERSATIONS & MESSAGES
    # -----------------------------------------------------------------
    conv1 = Conversation(id="conv1", created_at=ago(hours=3))
    db.session.add(conv1)
    db.session.add(ConversationParticipant(conversation_id="conv1", user_id="u1"))
    db.session.add(ConversationParticipant(conversation_id="conv1", user_id="u2"))
    db.session.add(Message(id="m1", conversation_id="conv1", sender_id="u2",
                            text="Hey John! How are the new interface components coming along?",
                            created_at=ago(hours=3), is_read=True))
    db.session.add(Message(id="m2", conversation_id="conv1", sender_id="u1",
                            text="Hey Jane! Just wrapped up the stories viewer and live broadcast studio! "
                                 "Looks super smooth.",
                            created_at=ago(hours=2), is_read=True))
    db.session.add(Message(id="m3", conversation_id="conv1", sender_id="u2",
                            text="Awesome! Let's review it this afternoon \U0001F680",
                            created_at=ago(hours=1), is_read=False))

    conv2 = Conversation(id="conv2", created_at=ago(days=1))
    db.session.add(conv2)
    db.session.add(ConversationParticipant(conversation_id="conv2", user_id="u1"))
    db.session.add(ConversationParticipant(conversation_id="conv2", user_id="u3"))
    db.session.add(Message(id="m4", conversation_id="conv2", sender_id="u3",
                            text="Yo John, are you coming to the trail walk this Saturday?",
                            created_at=ago(days=1), is_read=True))
    db.session.add(Message(id="m5", conversation_id="conv2", sender_id="u1",
                            text="Yes! Already RSVPed Going on the events tab.",
                            created_at=ago(hours=12), is_read=False))

    # -----------------------------------------------------------------
    # NOTIFICATIONS (welcome state for the John Doe demo account)
    # -----------------------------------------------------------------
    db.session.add(Notification(id="n1", user_id="u1", actor_id="u2", type="love",
                                 text="Jane Smith loved your post about Mukaputa.", target_id="p1",
                                 read=False, created_at=ago(minutes=15)))
    db.session.add(Notification(id="n2", user_id="u1", actor_id="u3", type="comment",
                                 text="Michael Johnson commented on your photo: \u2018Breathtaking view!\u2019",
                                 target_id="p2", read=False, created_at=ago(hours=1)))
    db.session.add(Notification(id="n3", user_id="u1", actor_id="u7", type="friend_request",
                                 text="David Kim added you as a friend.", target_id="u7",
                                 read=False, created_at=ago(hours=2)))
    db.session.add(FriendLink(user_id="u1", friend_id="u7"))
    db.session.add(FriendLink(user_id="u7", friend_id="u1"))

    db.session.commit()
