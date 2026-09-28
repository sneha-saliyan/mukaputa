# -*- coding: utf-8 -*-
import io

with io.open("frontend/js/components.js", "r", encoding="utf-8") as f:
    content = f.read()

# Fix the double closing brace
content = content.replace("    }\n}\n\n}\n\n\n\nfunction getReactionColorClass", "    }\n}\n\n\nfunction getReactionColorClass")

with io.open("frontend/js/components.js", "w", encoding="utf-8") as f:
    f.write(content)
print("Fixed syntax")
