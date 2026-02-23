# Nexport — Logistics & Container Booking Platform

Nexport is a full-stack logistics platform that connects **exporters** with **container providers** for seamless container booking, real-time shipment tracking, and secure payments.

![React](https://img.shields.io/badge/React-18-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Supabase](https://img.shields.io/badge/Supabase-Backend-green) ![Razorpay](https://img.shields.io/badge/Razorpay-Payments-blueviolet) ![Vite](https://img.shields.io/badge/Vite-5-yellow)

---

## Features

### For Exporters
- **Container Search & Booking** — Browse available containers by route, type (Dry/Reefer/Normal), and size (20ft/40ft). Book full or partial container space.
- **AI-Powered ETA & Delay Risk** — Get intelligent estimated delivery times and delay risk predictions using Supabase Edge Functions.
- **Razorpay Payment Gateway** — Secure payments via UPI, Card, and Netbanking (Razorpay test mode integrated).
- **Real-Time Shipment Tracking** — Live map tracking with Leaflet, geocoded routes, and a step-by-step tracking timeline.
- **In-App Messaging** — Chat with container providers directly from the booking, with AI-powered assistance.

### For Providers
- **Container Management** — Add, edit, and delete containers with full control over type, size, space, origin, destination, and transport mode.
- **Booking Overview** — View all bookings made on your containers.
- **Manual Tracking Updates** — Update booking status and add tracking events (Picked Up, In Transit, At Customs, Delivered, etc.) that exporters see in real time.
- **Live GPS Updates** — Share your current geolocation so exporters can track shipments on a live map.
- **Exporter Chat** — Communicate with exporters directly per booking.

### For Admins
- **Admin Dashboard** — Overview of platform activity, users, bookings, and providers.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite |
| UI | Tailwind CSS, shadcn/ui, Radix UI |
| Backend | Supabase (PostgreSQL, Auth, RLS, Edge Functions) |
| Payments | Razorpay Checkout (Test Mode) |
| Maps | Leaflet + OpenStreetMap + Nominatim Geocoding |
| AI/ML | Supabase Edge Functions (ETA, Delay Risk, Chat) |
| State | React Context, React Hooks |

---

## Getting Started

### Prerequisites
- Node.js 18+ (or Bun)
- A Supabase project
- Razorpay test account (optional, for payments)

### Installation

```bash
# Clone the repository
git clone https://github.com/Dinezx/Nexport.git
cd Nexport

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your Supabase and Razorpay keys

# Start the development server
npm run dev
```

### Environment Variables

Create a `.env` file in the root:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
```

> **Note:** Never commit your `.env` file. The Razorpay Key Secret should only be used server-side.

---

## Project Structure

```
src/
├── components/       # Reusable UI components (layout, shared, ui)
├── context/          # Auth context provider
├── hooks/            # Custom React hooks
├── lib/              # Utilities, constants, Supabase client
├── pages/            # All page components
│   ├── Booking.tsx           # Container search & booking
│   ├── ExporterBookings.tsx  # Exporter's booking list + Razorpay pay
│   ├── ExporterDashboard.tsx # Exporter dashboard
│   ├── ProviderBookings.tsx  # Provider's booking list
│   ├── ProviderContainers.tsx # Container CRUD management
│   ├── ProviderTracking.tsx  # Manual tracking updates & GPS
│   ├── Tracking.tsx          # Live shipment tracking map
│   ├── Chat.tsx              # In-app messaging
│   └── ...
├── services/         # API service layer
│   ├── bookingService.ts
│   ├── paymentService.ts    # Razorpay checkout integration
│   ├── trackingService.ts
│   ├── chatService.ts
│   └── containerService.ts
supabase/
├── migrations/       # Database schema & RLS policies
└── functions/        # Edge Functions (AI chat, ETA, delay risk)
```

---

## User Roles

| Role | Access |
|------|--------|
| **Exporter** | Book containers, make payments, track shipments, chat with providers |
| **Provider** | Manage containers, update tracking, share GPS, chat with exporters |
| **Admin** | Platform overview and management |

---

## Payment Integration

Nexport uses **Razorpay** in test mode. When clicking "Pay Now" on a booking, the Razorpay checkout popup opens with options for UPI, Card, and Netbanking.

**Test Credentials:**
- **Card:** `5267 3181 8797 5449` (any future expiry, any CVV)
- **UPI:** `success@razorpay`
- **Netbanking:** Select any bank → click "Success"

---

## Scripts

```bash
npm run dev       # Start dev server
npm run build     # Production build
npm run preview   # Preview production build
npm run test      # Run tests
npm run lint      # Lint code
```

---

## License

This project is private and proprietary.

---

Built with ❤️ by [Dinesh Kumar](https://github.com/Dinezx)
