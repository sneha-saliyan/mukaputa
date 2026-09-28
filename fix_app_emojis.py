# -*- coding: utf-8 -*-
import io

with io.open("frontend/js/app.js", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("showToast(`Connected with ${user.name}! `,", "showToast(`Connected with ${user.name}! ??`,")
content = content.replace("showToast('Post created! ',", "showToast('Post created! ?',")
content = content.replace("showToast('Comment posted! ',", "showToast('Comment posted! ??',")
content = content.replace("showToast('Profile updated successfully ',", "showToast('Profile updated successfully ?',")
content = content.replace("showToast('Reel uploaded! ',", "showToast('Reel uploaded! ??',")
content = content.replace("showToast('Story added! ',", "showToast('Story added! ??',")

with io.open("frontend/js/app.js", "w", encoding="utf-8") as f:
    f.write(content)
print("Updated app.js")
