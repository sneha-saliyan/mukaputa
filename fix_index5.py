# -*- coding: utf-8 -*-
import io

with io.open("frontend/index.html", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace('title="Delete Story"></button>', 'title="Delete Story">???</button>')
content = content.replace('title="Story Settings"></button>', 'title="Story Settings">??</button>')
content = content.replace('onclick="app.prevStory()"></button>', 'onclick="app.prevStory()">?</button>')
content = content.replace('onclick="app.nextStory()"></button>', 'onclick="app.nextStory()">?</button>')
content = content.replace('onclick="app.prevPhoto()"></button>', 'onclick="app.prevPhoto()">?</button>')
content = content.replace('onclick="app.nextPhoto()"></button>', 'onclick="app.nextPhoto()">?</button>')

with io.open("frontend/index.html", "w", encoding="utf-8") as f:
    f.write(content)
print("Updated nav buttons in index.html")
