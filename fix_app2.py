# -*- coding: utf-8 -*-
import io

with io.open("frontend/js/app.js", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace(
    'onclick="event.stopPropagation(); app.closeFloatingChat(\'${convId}\')"></button>',
    'onclick="event.stopPropagation(); app.closeFloatingChat(\'${convId}\')">&times;</button>'
)

content = content.replace(
    'onclick="app.cancelReply(\'${convId}\')" style="background: none; border: none; cursor: pointer; color: var(--text-tertiary);"></button>',
    'onclick="app.cancelReply(\'${convId}\')" style="background: none; border: none; cursor: pointer; color: var(--text-tertiary);">&times;</button>'
)

with io.open("frontend/js/app.js", "w", encoding="utf-8") as f:
    f.write(content)
print("Updated close buttons in app.js")
