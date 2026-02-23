from flask import Flask, request, jsonify
from delivery_time_model import predict_delivery_time

app = Flask(__name__)

@app.route("/predict", methods=["POST"])
def predict():
    data = request.json

    distance_km = data.get("distance_km")
    transport_mode = data.get("transport_mode")
    container_type = data.get("container_type")

    prediction = predict_delivery_time(
        distance_km, transport_mode, container_type
    )

    return jsonify({
        "estimated_delivery_days": prediction
    })

if __name__ == "__main__":
    app.run(debug=True)
