import requests

url = "http://127.0.0.1:5000/predict"

# Test 1: Sea freight — Chennai to Singapore (real data)
print("=" * 60)
print("Test 1: Sea — Chennai Port → Singapore Port")
payload = {
    "distance_km": 3180,
    "transport_mode": 0,
    "container_size": 40,
    "booking_mode": 0,
    "cbm": 67,
    "origin_congestion": 6,
    "dest_congestion": 3,
    "customs_export_days": 2.5,
    "customs_import_days": 1.0,
    "weather_factor": 1.0,
    "port_handling_origin": 2.2,
    "port_handling_dest": 1.6,
    "sea_route_multiplier": 1.15,
}
response = requests.post(url, json=payload)
print(f"Status: {response.status_code}")
print(f"Response: {response.json()}")
print(f"Expected: ~8 days\n")

# Test 2: Road — Delhi ICD to Mumbai Port
print("Test 2: Road — Delhi ICD → Mumbai Port")
payload = {
    "distance_km": 1830,
    "transport_mode": 1,
    "container_size": 20,
    "booking_mode": 0,
    "cbm": 33,
    "origin_congestion": 7,
    "dest_congestion": 8,
    "customs_export_days": 2.5,
    "customs_import_days": 2.5,
    "weather_factor": 1.0,
    "port_handling_origin": 2.05,
    "port_handling_dest": 2.6,
    "sea_route_multiplier": 1.0,
}
response = requests.post(url, json=payload)
print(f"Status: {response.status_code}")
print(f"Response: {response.json()}")
print(f"Expected: ~4 days\n")

# Test 3: Air — Delhi to Dubai
print("Test 3: Air — Delhi Airport → Dubai Airport")
payload = {
    "distance_km": 2200,
    "transport_mode": 2,
    "container_size": 20,
    "booking_mode": 1,
    "cbm": 10,
    "origin_congestion": 8,
    "dest_congestion": 7,
    "customs_export_days": 2.5,
    "customs_import_days": 2.0,
    "weather_factor": 1.0,
    "port_handling_origin": 1.3,
    "port_handling_dest": 1.2,
    "sea_route_multiplier": 1.0,
}
response = requests.post(url, json=payload)
print(f"Status: {response.status_code}")
print(f"Response: {response.json()}")
print(f"Expected: ~2 days\n")

# Test 4: Sea freight — Mumbai to Durban (long haul, monsoon)
print("Test 4: Sea — Mumbai Port → Durban Port (monsoon)")
payload = {
    "distance_km": 8400,
    "transport_mode": 0,
    "container_size": 40,
    "booking_mode": 1,
    "cbm": 18,
    "origin_congestion": 8,
    "dest_congestion": 6,
    "customs_export_days": 2.5,
    "customs_import_days": 3.0,
    "weather_factor": 1.2,
    "port_handling_origin": 2.6,
    "port_handling_dest": 2.2,
    "sea_route_multiplier": 1.45,
}
response = requests.post(url, json=payload)
print(f"Status: {response.status_code}")
print(f"Response: {response.json()}")
print(f"Expected: ~22 days")
