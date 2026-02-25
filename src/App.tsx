import { Routes, Route } from "react-router-dom";

// pages
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ExporterDashboard from "./pages/ExporterDashboard";
import ProviderDashboard from "./pages/ProviderDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import Booking from "./pages/Booking";
import Chat from "./pages/Chat";
import Tracking from "./pages/Tracking";
import ProviderTracking from "./pages/ProviderTracking";
import ProviderContainers from "./pages/ProviderContainers";
import ProviderBookings from "./pages/ProviderBookings";
import ExporterBookings from "./pages/ExporterBookings";
import MockPayment from "./pages/MockPayment";
import Settings from "./pages/Settings";
import Landing from "./pages/Landing";
import ProtectedRoute from "./components/ProtectedRoute";


function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      {/* Exporter */}
      <Route
        path="/exporter/dashboard"
        element={
          <ProtectedRoute allowedRoles={["exporter"]}>
            <ExporterDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/exporter/bookings"
        element={
          <ProtectedRoute allowedRoles={["exporter"]}>
            <ExporterBookings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/booking"
        element={
          <ProtectedRoute allowedRoles={["exporter"]}>
            <Booking />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tracking/:bookingId"
        element={
          <ProtectedRoute allowedRoles={["exporter", "provider"]}>
            <Tracking />
          </ProtectedRoute>
        }
      />
      <Route
        path="/payment/:bookingId"
        element={
          <ProtectedRoute allowedRoles={["exporter"]}>
            <MockPayment />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute allowedRoles={["exporter", "provider", "admin"]}>
            <Settings />
          </ProtectedRoute>
        }
      />



      {/* Provider */}
      <Route
        path="/provider/dashboard"
        element={
          <ProtectedRoute allowedRoles={["provider"]}>
            <ProviderDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/provider-containers"
        element={
          <ProtectedRoute allowedRoles={["provider"]}>
            <ProviderContainers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/provider/bookings"
        element={
          <ProtectedRoute allowedRoles={["provider"]}>
            <ProviderBookings />
          </ProtectedRoute>
        }
      />
      <Route
        path="/provider/tracking/:bookingId"
        element={
          <ProtectedRoute allowedRoles={["provider"]}>
            <ProviderTracking />
          </ProtectedRoute>
        }
      />

      {/* Admin */}
      <Route
        path="/admin/dashboard"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      {/* Shared */}
      <Route
        path="/chat"
        element={
          <ProtectedRoute allowedRoles={["exporter", "provider"]}>
            <Chat />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
