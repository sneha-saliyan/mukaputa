from urllib.parse import urlencode
try:
    print(urlencode({'client_id': None}))
except Exception as e:
    print("Error:", repr(e))
