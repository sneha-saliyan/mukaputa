import requests
import json
res = requests.get('http://localhost:5000/api/bootstrap')
print(json.dumps(res.json(), indent=2)[:500])
