import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
import joblib

# -----------------------------
# Generate synthetic dataset
# -----------------------------

np.random.seed(42)

data_size = 1000

data = {
    "distance_km": np.random.randint(300, 12000, data_size),
    "transport_mode": np.random.choice([0, 1, 2], data_size),  
    # 0 = Sea, 1 = Road, 2 = Air
    "container_type": np.random.choice([20, 40], data_size),
}

df = pd.DataFrame(data)

# Delivery time logic (simple & realistic)
df["delivery_days"] = (
    df["distance_km"] / 500
    + np.where(df["transport_mode"] == 0, 10, 0)
    + np.where(df["transport_mode"] == 2, -8, 0)
    + np.random.randint(1, 5, data_size)
)

# -----------------------------
# Train model
# -----------------------------

X = df[["distance_km", "transport_mode", "container_type"]]
y = df["delivery_days"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

model = RandomForestRegressor(n_estimators=100, random_state=42)
model.fit(X_train, y_train)

# -----------------------------
# Save model
# -----------------------------

joblib.dump(model, "delivery_time_model.pkl")

print("✅ Model trained and saved as delivery_time_model.pkl")
