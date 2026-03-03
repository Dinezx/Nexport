import joblib
import numpy as np
import json
import os

# Load trained model
MODEL_PATH = os.path.join(os.path.dirname(__file__), "delivery_time_model.pkl")
META_PATH = os.path.join(os.path.dirname(__file__), "model_metadata.json")

model = joblib.load(MODEL_PATH)

# Load metadata if available
try:
    with open(META_PATH) as f:
        metadata = json.load(f)
except Exception:
    metadata = {"features": ["distance_km", "transport_mode", "container_size"]}


def predict_delivery_time(
    distance_km,
    transport_mode,
    container_size=40,
    booking_mode=0,
    cbm=33,
    origin_congestion=5,
    dest_congestion=5,
    customs_export_days=2.5,
    customs_import_days=3.5,
    weather_factor=1.0,
    port_handling_origin=1.5,
    port_handling_dest=1.5,
    sea_route_multiplier=1.35,
):
    """
    Predict delivery time using the trained ML model.
    
    transport_mode: 0 = Sea, 1 = Road, 2 = Air
    booking_mode: 0 = FCL (full container), 1 = LCL (partial)
    congestion: 1-10 scale (10 = most congested)
    """
    features = len(metadata.get("features", []))
    
    if features >= 13:
        # Full feature model
        input_data = np.array([[
            distance_km, transport_mode, container_size, booking_mode, cbm,
            origin_congestion, dest_congestion, customs_export_days,
            customs_import_days, weather_factor, port_handling_origin,
            port_handling_dest, sea_route_multiplier,
        ]])
    else:
        # Legacy 3-feature model
        input_data = np.array([[distance_km, transport_mode, container_size]])

    prediction = model.predict(input_data)
    return max(1.0, round(float(prediction[0]), 1))
