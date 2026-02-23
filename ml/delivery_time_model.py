import joblib
import numpy as np

# Load trained model
model = joblib.load("delivery_time_model.pkl")

def predict_delivery_time(distance_km, transport_mode, container_type):
    """
    transport_mode:
      0 = Sea
      1 = Road
      2 = Air
    """

    input_data = np.array([[distance_km, transport_mode, container_type]])
    prediction = model.predict(input_data)

    return round(float(prediction[0]), 2)
