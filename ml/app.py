from flask import Flask, request, jsonify
from flask_cors import CORS
from delivery_time_model import predict_delivery_time

app = Flask(__name__)
CORS(app)


@app.route("/predict", methods=["POST"])
def predict():
    data = request.json

    distance_km = data.get("distance_km")
    transport_mode = data.get("transport_mode")

    if distance_km is None or transport_mode is None:
        return jsonify({"error": "distance_km and transport_mode are required"}), 400

    prediction = predict_delivery_time(
        distance_km=distance_km,
        transport_mode=transport_mode,
        container_size=data.get("container_size", data.get("container_type", 40)),
        booking_mode=data.get("booking_mode", 0),
        cbm=data.get("cbm", 33),
        origin_congestion=data.get("origin_congestion", 5),
        dest_congestion=data.get("dest_congestion", 5),
        customs_export_days=data.get("customs_export_days", 2.5),
        customs_import_days=data.get("customs_import_days", 3.5),
        weather_factor=data.get("weather_factor", 1.0),
        port_handling_origin=data.get("port_handling_origin", 1.5),
        port_handling_dest=data.get("port_handling_dest", 1.5),
        sea_route_multiplier=data.get("sea_route_multiplier", 1.35),
    )

    return jsonify({
        "estimated_delivery_days": prediction,
        "features_used": len(data.keys()),
    })


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model": "delivery_time_v2"})


if __name__ == "__main__":
    app.run(debug=True)
