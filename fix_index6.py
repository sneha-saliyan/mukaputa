# -*- coding: utf-8 -*-
import io
import re

with io.open("frontend/index.html", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace('>Back</button>', '>?? Back</button>')

with io.open("frontend/index.html", "w", encoding="utf-8") as f:
    f.write(content)
print("Updated back buttons in index.html")
