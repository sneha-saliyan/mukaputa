# -*- coding: utf-8 -*-
import io
import re

with io.open("frontend/index.html", "r", encoding="utf-8") as f:
    content = f.read()

# Left Sidebar
content = content.replace("<span>Posts</span>", "<span>?? Posts</span>")
content = content.replace("<span>Jobs</span>", "<span>?? Jobs</span>")
content = content.replace("<span>Watch</span>", "<span>?? Watch</span>")
content = content.replace("<span>Saved</span>", "<span>?? Saved</span>")
content = content.replace("<span>Groups</span>", "<span>?? Groups</span>")
content = content.replace("<span>Marketplace</span>", "<span>?? Marketplace</span>")

# Buttons
content = content.replace("Post a Job</button>", "?? Post a Job</button>")
content = content.replace("Create Story</div>", "?? Create Story</div>")
content = content.replace("Create Reel</button>", "?? Create Reel</button>")
content = content.replace("Create Post</button>", "?? Create Post</button>")
content = content.replace("Photo/Video</div>", "??? Photo/Video</div>")
content = content.replace("Feeling/Activity</div>", "?? Feeling/Activity</div>")

# Privacy options
content = content.replace("Public - Anyone can see", "?? Public - Anyone can see")
content = content.replace("Friends - Only friends", "?? Friends - Only friends")
content = content.replace("Only Me - Private", "?? Only Me - Private")
content = content.replace("Everyone (Public)", "?? Everyone (Public)")
content = content.replace("Friends of Friends", "?? Friends of Friends")

# Post feeling
content = content.replace("Happy</div>", "?? Happy</div>")
content = content.replace("Excited</div>", "?? Excited</div>")
content = content.replace("Loved</div>", "?? Loved</div>")
content = content.replace("Sad</div>", "?? Sad</div>")
content = content.replace("Angry</div>", "?? Angry</div>")

with io.open("frontend/index.html", "w", encoding="utf-8") as f:
    f.write(content)
print("Updated index.html")
