import base64
import json

payload = "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtcnpteGJpaGJ1ZmpkZ2J0cXllIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDQyOTkzNiwiZXhwIjoyMTA2MDA1OTM2fQ=="
decoded = base64.b64decode(payload).decode('utf-8')
print(decoded)
