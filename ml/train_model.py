import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, r2_score
import joblib
import json
import math

# ─── Real-world location coordinates ─────────────────────────────────────────

LOCATIONS = {
    # India - Ports
    "Chennai Port": (13.0827, 80.2707, "port", "India", 6),
    "Mumbai Port": (18.9388, 72.8354, "port", "India", 8),
    "Tuticorin Port": (8.7642, 78.1348, "port", "India", 4),
    "Cochin Port": (9.9312, 76.2673, "port", "India", 5),
    "Kolkata Port": (22.5726, 88.3639, "port", "India", 7),
    "Delhi ICD": (28.6139, 77.2090, "icd", "India", 7),
    "Bangalore ICD": (12.9716, 77.5946, "icd", "India", 5),
    "Hyderabad ICD": (17.3850, 78.4867, "icd", "India", 5),
    # SE & East Asia
    "Singapore Port": (1.2644, 103.822, "port", "Singapore", 3),
    "Shanghai Port": (31.2304, 121.474, "port", "China", 9),
    "Shenzhen Port": (22.5431, 114.058, "port", "China", 8),
    "Hong Kong Port": (22.3193, 114.170, "port", "Hong Kong", 7),
    "Busan Port": (35.1028, 129.036, "port", "South Korea", 5),
    "Tokyo Port": (35.6530, 139.790, "port", "Japan", 6),
    "Manila Port": (14.5832, 120.970, "port", "Philippines", 7),
    "Jakarta Port": (-6.1089, 106.880, "port", "Indonesia", 7),
    "Bangkok Port": (13.7070, 100.601, "port", "Thailand", 6),
    "Ho Chi Minh Port": (10.7769, 106.701, "port", "Vietnam", 6),
    "Colombo Port": (6.9497, 79.8428, "port", "Sri Lanka", 5),
    "KL Port": (2.9975, 101.385, "port", "Malaysia", 5),
    # Middle East
    "Dubai Port": (25.2697, 55.3095, "port", "UAE", 6),
    "Jebel Ali Port": (24.9857, 55.0272, "port", "UAE", 7),
    "Jeddah Port": (21.5169, 39.2192, "port", "Saudi Arabia", 6),
    "Dammam Port": (26.4207, 50.0888, "port", "Saudi Arabia", 5),
    "Salalah Port": (16.9400, 54.0000, "port", "Oman", 3),
    "Karachi Port": (24.8465, 66.9706, "port", "Pakistan", 7),
    # Africa
    "Durban Port": (-29.867, 31.0292, "port", "South Africa", 6),
    "Cape Town Port": (-33.918, 18.4233, "port", "South Africa", 5),
    "Mombasa Port": (-4.0435, 39.6682, "port", "Kenya", 6),
    "Lagos Port": (6.4541, 3.3947, "port", "Nigeria", 8),
    "Dar es Salaam Port": (-6.7924, 39.2083, "port", "Tanzania", 6),
    "Alexandria Port": (31.2156, 29.9553, "port", "Egypt", 6),
    "Djibouti Port": (11.5880, 43.1450, "port", "Djibouti", 4),
    # Airports
    "Chennai Airport": (12.9941, 80.1709, "airport", "India", 5),
    "Mumbai Airport": (19.0896, 72.8656, "airport", "India", 7),
    "Delhi Airport": (28.5562, 77.1000, "airport", "India", 8),
    "Singapore Airport": (1.3644, 103.991, "airport", "Singapore", 3),
    "Dubai Airport": (25.2532, 55.3657, "airport", "UAE", 7),
    "Hong Kong Airport": (22.3080, 113.915, "airport", "Hong Kong", 6),
    "Shanghai Airport": (31.1443, 121.805, "airport", "China", 8),
    "Tokyo Airport": (35.7720, 140.393, "airport", "Japan", 6),
    "Seoul Airport": (37.4602, 126.441, "airport", "South Korea", 5),
    "Nairobi Airport": (-1.3192, 36.9278, "airport", "Kenya", 5),
    "Johannesburg Airport": (-26.139, 28.2460, "airport", "South Africa", 5),
    "Cairo Airport": (30.1219, 31.4056, "airport", "Egypt", 6),
    "Lagos Airport": (6.5774, 3.3212, "airport", "Nigeria", 7),
}

# Customs clearance days by country (export, import)
CUSTOMS_DAYS = {
    "India": (2.5, 3.5), "Singapore": (0.5, 1.0), "China": (2.0, 3.0),
    "Hong Kong": (0.5, 1.0), "Japan": (1.5, 2.0), "South Korea": (1.5, 2.0),
    "Philippines": (3.0, 4.0), "Indonesia": (3.0, 4.5), "Thailand": (2.0, 2.5),
    "Vietnam": (2.5, 3.0), "Malaysia": (1.5, 2.0), "Sri Lanka": (2.5, 3.0),
    "Pakistan": (4.0, 5.0), "UAE": (1.0, 2.0), "Saudi Arabia": (2.5, 3.0),
    "Oman": (2.0, 2.5), "South Africa": (2.5, 3.0), "Kenya": (3.5, 4.0),
    "Tanzania": (4.0, 5.0), "Nigeria": (5.0, 6.0), "Egypt": (3.0, 4.0),
    "Djibouti": (2.5, 3.0), "Morocco": (2.5, 3.0),
}

# Transport speeds (km/day)
SPEEDS = {"sea": 580, "road": 350, "air": 8000}

# Historical known routes (origin, dest, transport, avg_days, min_days, max_days)
HISTORICAL = [
    ("Chennai Port", "Singapore Port", "sea", 8, 6, 11),
    ("Chennai Port", "Colombo Port", "sea", 3, 2, 5),
    ("Chennai Port", "Dubai Port", "sea", 10, 8, 14),
    ("Chennai Port", "Shanghai Port", "sea", 16, 13, 20),
    ("Mumbai Port", "Jebel Ali Port", "sea", 5, 3, 7),
    ("Mumbai Port", "Singapore Port", "sea", 10, 8, 13),
    ("Mumbai Port", "Durban Port", "sea", 22, 18, 28),
    ("Mumbai Port", "Mombasa Port", "sea", 14, 10, 18),
    ("Cochin Port", "Singapore Port", "sea", 9, 7, 12),
    ("Cochin Port", "Colombo Port", "sea", 2, 1, 3),
    ("Cochin Port", "Dubai Port", "sea", 8, 6, 11),
    ("Kolkata Port", "Singapore Port", "sea", 12, 9, 15),
    ("Kolkata Port", "Bangkok Port", "sea", 10, 7, 13),
    ("Singapore Port", "Shanghai Port", "sea", 7, 5, 9),
    ("Singapore Port", "Hong Kong Port", "sea", 5, 4, 7),
    ("Singapore Port", "Tokyo Port", "sea", 10, 8, 13),
    ("Shanghai Port", "Busan Port", "sea", 3, 2, 4),
    ("Shanghai Port", "Tokyo Port", "sea", 4, 3, 6),
    ("Dubai Port", "Mombasa Port", "sea", 10, 7, 13),
    ("Dubai Port", "Mumbai Port", "sea", 5, 3, 7),
    ("Durban Port", "Mombasa Port", "sea", 12, 9, 16),
    ("Delhi ICD", "Mumbai Port", "road", 4, 3, 6),
    ("Delhi ICD", "Chennai Port", "road", 5, 4, 7),
    ("Delhi ICD", "Kolkata Port", "road", 4, 3, 5),
    ("Bangalore ICD", "Chennai Port", "road", 2, 1, 3),
    ("Bangalore ICD", "Cochin Port", "road", 2, 1, 3),
    ("Hyderabad ICD", "Chennai Port", "road", 2, 1, 3),
    ("Hyderabad ICD", "Mumbai Port", "road", 3, 2, 4),
    ("Chennai Airport", "Singapore Airport", "air", 2, 1, 3),
    ("Chennai Airport", "Dubai Airport", "air", 2, 1, 3),
    ("Delhi Airport", "Dubai Airport", "air", 2, 1, 3),
    ("Delhi Airport", "Singapore Airport", "air", 2, 1, 3),
    ("Mumbai Airport", "Dubai Airport", "air", 2, 1, 3),
    ("Singapore Airport", "Hong Kong Airport", "air", 2, 1, 2),
    ("Singapore Airport", "Tokyo Airport", "air", 2, 1, 3),
    ("Dubai Airport", "Nairobi Airport", "air", 2, 1, 3),
]


def haversine(lat1, lng1, lat2, lng2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def sea_route_multiplier(origin, dest):
    """Sea routes are longer than great-circle distance."""
    o, d = origin.lower(), dest.lower()
    if ("india" in o or "singapore" in o) and ("egypt" in d or "morocco" in d):
        return 1.25
    if ("india" in o or "china" in o) and ("nigeria" in d or "south africa" in d):
        return 1.45
    if ("india" in o or "sri lanka" in o) and ("singapore" in d or "malaysia" in d):
        return 1.15
    if "india" in o and "india" in d:
        return 1.3
    return 1.35


def weather_factor(month, transport):
    """Seasonal weather impact on transit time."""
    if transport == "sea":
        if 5 <= month <= 8: return 1.2   # Monsoon
        if 6 <= month <= 10: return 1.15  # Typhoon
        if month in (11, 0, 1): return 1.1  # Winter storms
    if transport == "road":
        if 5 <= month <= 8: return 1.25   # Flooding
        if month >= 10 or month <= 0: return 1.15  # Fog
    if transport == "air":
        if 5 <= month <= 8: return 1.05
    return 1.0


def port_handling(congestion, loc_type):
    """Port/terminal handling time in days."""
    if loc_type == "airport": return 0.5 + (congestion / 10) * 1.0
    if loc_type == "icd": return 1.0 + (congestion / 10) * 1.5
    return 1.0 + (congestion / 10) * 2.0


# ─── Generate real-world training dataset ─────────────────────────────────────

np.random.seed(42)

data_size = 5000
location_keys = list(LOCATIONS.keys())

records = []

# Phase 1: Generate from historical routes (~60% of data)
for orig, dest, transport, avg_d, min_d, max_d in HISTORICAL:
    o = LOCATIONS[orig]
    d = LOCATIONS[dest]
    dist = haversine(o[0], o[1], d[0], d[1])
    samples = min(80, data_size // len(HISTORICAL))

    for _ in range(samples):
        month = np.random.randint(0, 12)
        cont_size = np.random.choice([20, 40])
        booking_mode = 1 if np.random.random() > 0.7 else 0  # 30% LCL
        cbm = np.random.randint(3, 26) if booking_mode == 1 else (33 if cont_size == 20 else 67)
        wf = weather_factor(month, transport)
        sm = sea_route_multiplier(orig, dest) if transport == "sea" else 1.0
        oh = port_handling(o[4], o[2])
        dh = port_handling(d[4], d[2])
        ce = CUSTOMS_DAYS.get(o[3], (2, 3))[0]
        ci = CUSTOMS_DAYS.get(d[3], (2, 3))[1]

        variance = (np.random.random() - 0.5) * (max_d - min_d)
        delivery = max(1, round(avg_d + variance))

        t_mode = 0 if transport == "sea" else (1 if transport == "road" else 2)
        eff_dist = round(dist * sm)

        records.append({
            "distance_km": eff_dist,
            "transport_mode": t_mode,
            "container_size": cont_size,
            "booking_mode": booking_mode,
            "cbm": cbm,
            "origin_congestion": o[4],
            "dest_congestion": d[4],
            "customs_export_days": ce,
            "customs_import_days": ci,
            "weather_factor": round(wf, 2),
            "port_handling_origin": round(oh, 1),
            "port_handling_dest": round(dh, 1),
            "sea_route_multiplier": round(sm, 2),
            "delivery_days": delivery,
        })

# Phase 2: Fill remaining with computed routes between all locations
while len(records) < data_size:
    oi = np.random.randint(0, len(location_keys))
    di = np.random.randint(0, len(location_keys))
    if oi == di:
        continue

    ok, dk = location_keys[oi], location_keys[di]
    o, d = LOCATIONS[ok], LOCATIONS[dk]
    dist = haversine(o[0], o[1], d[0], d[1])

    # Pick transport mode based on location types
    if o[2] == "airport" and d[2] == "airport":
        transport, t_mode = "air", 2
    elif o[2] == "icd" and d[2] == "icd" and dist < 2000:
        transport, t_mode = "road", 1
    elif (o[2] == "icd" or d[2] == "icd") and dist < 1500:
        transport, t_mode = "road", 1
    elif dist < 500:
        transport, t_mode = "road", 1
    else:
        transport = "sea" if np.random.random() > 0.3 else "road"
        t_mode = 0 if transport == "sea" else 1

    month = np.random.randint(0, 12)
    cont_size = np.random.choice([20, 40])
    booking_mode = 1 if np.random.random() > 0.7 else 0
    cbm = np.random.randint(3, 26) if booking_mode == 1 else (33 if cont_size == 20 else 67)
    wf = weather_factor(month, transport)
    sm = sea_route_multiplier(ok, dk) if transport == "sea" else 1.0
    road_mult = 1.3 if transport == "road" else 1.0
    oh = port_handling(o[4], o[2])
    dh = port_handling(d[4], d[2])
    ce = CUSTOMS_DAYS.get(o[3], (2, 3))[0]
    ci = CUSTOMS_DAYS.get(d[3], (2, 3))[1]

    eff_dist = dist * sm * road_mult
    speed = SPEEDS[transport]
    transit = (eff_dist / speed) * wf
    total = transit + oh + dh + ce + ci
    lcl_extra = (1 + np.random.random() * 2) if booking_mode == 1 else 0
    delivery = max(1, round(total + lcl_extra + np.random.normal(0, 1)))

    records.append({
        "distance_km": round(eff_dist),
        "transport_mode": t_mode,
        "container_size": cont_size,
        "booking_mode": booking_mode,
        "cbm": cbm,
        "origin_congestion": o[4],
        "dest_congestion": d[4],
        "customs_export_days": ce,
        "customs_import_days": ci,
        "weather_factor": round(wf, 2),
        "port_handling_origin": round(oh, 1),
        "port_handling_dest": round(dh, 1),
        "sea_route_multiplier": round(sm, 2),
        "delivery_days": delivery,
    })

df = pd.DataFrame(records[:data_size])

print(f"✅ Dataset generated: {len(df)} rows")
print(f"   Transport modes: Sea={len(df[df.transport_mode==0])}, Road={len(df[df.transport_mode==1])}, Air={len(df[df.transport_mode==2])}")
print(f"   Delivery days: min={df.delivery_days.min()}, avg={df.delivery_days.mean():.1f}, max={df.delivery_days.max()}")
print(f"   Distance range: {df.distance_km.min()}-{df.distance_km.max()} km")

# ─── Save dataset as CSV for reference ────────────────────────────────────────

df.to_csv("shipment_dataset.csv", index=False)
print("📄 Dataset saved to shipment_dataset.csv")

# ─── Train model ──────────────────────────────────────────────────────────────

feature_cols = [
    "distance_km", "transport_mode", "container_size", "booking_mode", "cbm",
    "origin_congestion", "dest_congestion", "customs_export_days", "customs_import_days",
    "weather_factor", "port_handling_origin", "port_handling_dest", "sea_route_multiplier",
]

X = df[feature_cols]
y = df["delivery_days"]

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Train Random Forest
rf_model = RandomForestRegressor(n_estimators=200, max_depth=15, random_state=42)
rf_model.fit(X_train, y_train)
rf_pred = rf_model.predict(X_test)
rf_mae = mean_absolute_error(y_test, rf_pred)
rf_r2 = r2_score(y_test, rf_pred)

# Train Gradient Boosting
gb_model = GradientBoostingRegressor(n_estimators=200, max_depth=6, learning_rate=0.1, random_state=42)
gb_model.fit(X_train, y_train)
gb_pred = gb_model.predict(X_test)
gb_mae = mean_absolute_error(y_test, gb_pred)
gb_r2 = r2_score(y_test, gb_pred)

print(f"\n📊 Model Performance:")
print(f"   Random Forest:      MAE={rf_mae:.2f} days, R²={rf_r2:.4f}")
print(f"   Gradient Boosting:  MAE={gb_mae:.2f} days, R²={gb_r2:.4f}")

# Use the better model
if gb_r2 >= rf_r2:
    best_model = gb_model
    best_name = "GradientBoosting"
    print(f"\n✅ Best model: Gradient Boosting")
else:
    best_model = rf_model
    best_name = "RandomForest"
    print(f"\n✅ Best model: Random Forest")

# Feature importance
importances = best_model.feature_importances_
print(f"\n📈 Feature Importance ({best_name}):")
for feat, imp in sorted(zip(feature_cols, importances), key=lambda x: -x[1]):
    bar = "█" * int(imp * 50)
    print(f"   {feat:25s} {imp:.4f} {bar}")

# ─── Save model ───────────────────────────────────────────────────────────────

joblib.dump(best_model, "delivery_time_model.pkl")
print(f"\n✅ Model saved as delivery_time_model.pkl ({best_name}, {len(df)} training samples)")

# Save metadata
meta = {
    "model_type": best_name,
    "features": feature_cols,
    "training_samples": len(df),
    "test_mae": round(gb_mae if best_name == "GradientBoosting" else rf_mae, 2),
    "test_r2": round(gb_r2 if best_name == "GradientBoosting" else rf_r2, 4),
    "transport_modes": {"0": "sea", "1": "road", "2": "air"},
}
with open("model_metadata.json", "w") as f:
    json.dump(meta, f, indent=2)
print("📄 Metadata saved to model_metadata.json")
