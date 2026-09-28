# -*- coding: utf-8 -*-
import io

with io.open("frontend/landing_page.html", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace('Launch MukaPuta Web App </a>', 'Launch MukaPuta Web App ??</a>')
content = content.replace('Open App </a>', 'Open App ??</a>')
content = content.replace('class="stars"></div>', 'class="stars">?????</div>')
content = content.replace('<span> <b>482</b></span>', '<span>?? <b>482</b></span>')
content = content.replace('<span> <b>63</b></span>', '<span>?? <b>63</b></span>')
content = content.replace('<span> Share</span>', '<span>?? Share</span>')

with io.open("frontend/landing_page.html", "w", encoding="utf-8") as f:
    f.write(content)
print("Updated landing_page.html")
