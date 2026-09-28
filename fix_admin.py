# -*- coding: utf-8 -*-
import io
import re

with io.open("frontend/admin.html", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace(
    '<button class="adm-modal-close" onclick="closeAdModal()"></button>',
    '<button class="adm-modal-close" onclick="closeAdModal()">&times;</button>'
)

with io.open("frontend/admin.html", "w", encoding="utf-8") as f:
    f.write(content)
print("Updated close buttons in admin.html")
