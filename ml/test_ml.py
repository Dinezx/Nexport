import requests

url = "http://127.0.0.1:5000/predict"

payload = {
    "distance_km": 8000,
    "transport_mode": 0,   # 0 = Sea, 1 = Road, 2 = Air
    "container_type": 40
}

response = requests.post(url, json=payload)

print("Status Code:", response.status_code)
print("Response:", response.json())
