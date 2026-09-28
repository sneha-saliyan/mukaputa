# -*- coding: utf-8 -*-
import io

with io.open("frontend/index.html", "r", encoding="utf-8") as f:
    content = f.read()

# Top bar icons
content = content.replace('class="icon-btn" onclick="app.togglePanel(\'chat\')"', 'class="icon-btn" onclick="app.togglePanel(\'chat\')">??<span')
content = content.replace('class="icon-btn" onclick="app.togglePanel(\'notifications\')"', 'class="icon-btn" onclick="app.togglePanel(\'notifications\')">??<span')

# Clean up any bad replacements
content = content.replace('??<span class="badge" id="chat-badge"', '??<span class="badge" id="chat-badge"')
content = content.replace('??<span class="badge" id="notif-badge"', '??<span class="badge" id="notif-badge"')

# Only if it was replaced poorly earlier:
# I need to be careful. The HTML was: 
# <button class="icon-btn" onclick="app.togglePanel('chat')"><span class="badge" id="chat-badge" style="display: none;">0</span></button>
# If I just replace as above, I might get duplicates. I will use regex.
import re

content = re.sub(
    r'<button class="icon-btn" onclick="app\.togglePanel\(\'chat\'\)">.*?<span class="badge" id="chat-badge"',
    '<button class="icon-btn" onclick="app.togglePanel(\'chat\')">??<span class="badge" id="chat-badge"',
    content
)

content = re.sub(
    r'<button class="icon-btn" onclick="app\.togglePanel\(\'notifications\'\)">.*?<span class="badge" id="notif-badge"',
    '<button class="icon-btn" onclick="app.togglePanel(\'notifications\')">??<span class="badge" id="notif-badge"',
    content
)

with io.open("frontend/index.html", "w", encoding="utf-8") as f:
    f.write(content)
print("Updated topbar icons in index.html")
