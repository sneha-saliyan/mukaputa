# -*- coding: utf-8 -*-
import io
import re

with io.open("frontend/index.html", "r", encoding="utf-8") as f:
    content = f.read()

# Replace empty close buttons with &times;
# Regex explanation: match `<button class="something close-something" onclick="...">` immediately followed by `</button>`
content = re.sub(
    r'(<button[^>]*class="[^"]*(?:close-btn|photo-viewer-close|close-modal)[^"]*"[^>]*>)(\s*)</button>',
    r'\1&times;</button>',
    content
)

with io.open("frontend/index.html", "w", encoding="utf-8") as f:
    f.write(content)
print("Updated close buttons in index.html")
