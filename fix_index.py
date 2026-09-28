import io
import re

with io.open("frontend/index.html", "r", encoding="utf-8") as f:
    content = f.read()

# Replace empty tags with icons
content = content.replace("> Posts</div>", "> ?? Posts</div>")
content = content.replace("> Jobs</div>", "> ?? Jobs</div>")
content = content.replace("> Network</div>", "> ?? Network</div>")
content = content.replace("> Saved</div>", "> ?? Saved</div>")

# Post a job button
content = content.replace("Post a Job</button>", "?? Post a Job</button>")
content = content.replace("Create Story</button>", "?? Create Story</button>")

# Privacy options
content = content.replace("Public - Anyone can see", "?? Public - Anyone can see")
content = content.replace("Friends - Only friends", "?? Friends - Only friends")
content = content.replace("Only Me - Private", "?? Only Me - Private")
content = content.replace("Everyone (Public)", "?? Everyone (Public)")
content = content.replace("Friends of Friends", "?? Friends of Friends")

# Toast
content = content.replace("> Connected with ", "> ?? Connected with ")

# Post feeling
content = content.replace("Happy</div>", "?? Happy</div>")
content = content.replace("Excited</div>", "?? Excited</div>")
content = content.replace("Loved</div>", "?? Loved</div>")
content = content.replace("Sad</div>", "?? Sad</div>")
content = content.replace("Angry</div>", "?? Angry</div>")

# Title
content = content.replace("<title>Mukaputa  Next-Gen Social Connection</title>", "<title>Mukaputa — Next-Gen Social Connection</title>")


with io.open("frontend/index.html", "w", encoding="utf-8") as f:
    f.write(content)
print("Updated index.html")
