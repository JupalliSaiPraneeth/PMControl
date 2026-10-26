# OmniControl 📡

**A Secure Android Remote-Support and Device-Management Platform**  
*Consent-based, peer-to-peer WebRTC screen sharing, live audio transmission, and authorized remote interaction.*

---

## 1. Project Overview & Architecture

OmniControl is designed for personal remote management and support of your own Android phone from a MacBook (macOS), Windows PC, or mobile browser.

### Key Pillars
- **Zero Covert Surveillance**: MediaProjection requires per-session Android consent. Active screen sharing and microphone usage display an omnipresent, persistent Android foreground notification.
- **Peer-to-Peer Encryption**: Screen frames and audio tracks flow directly over WebRTC DTLS/SRTP with STUN/TURN NAT traversal. Media is never stored or routed through the database.
- **Cryptographic Device Pairing**: Enrollment uses high-entropy, single-use 6-digit numeric pairing codes with a 5-minute TTL and server-side SHA-256 hashing.
- **PostgreSQL Row Level Security (RLS)**: Enforces cryptographic ownership isolation across all profiles, devices, pairing requests, and session logs.

```
┌────────────────────────────────────────────────────────┐
│                   React Dashboard                      │
│   (macOS / Windows Browsers / Mobile Android Chrome)   │
└───────────────▲────────────────────────▲───────────────┘
                │ HTTPS / WSS            │ WebRTC Data
                │ (REST & Signaling)     │ & DTLS/SRTP Media
┌───────────────▼────────────────┐       │
│      Node.js & Express API     │       │
│   • Supabase JWT Validation    │       │
│   • Device Pairing Service     │       │
│   • Socket.IO Signaling        │       │
│   • Audit & Security Events    │       │
└───────────────▲────────────────┘       │
                │                        │
                │ Socket.IO Signaling    │
┌───────────────▼────────────────────────▼───────────────┐
│              Authorized Android Application            │
│   • Jetpack Compose Native Interface                   │
│   • MediaProjection Screen Capturer                    │
│   • Foreground Notification Service                    │
│   • Accessibility Service (Taps & Swipes)              │
│   • WebRTC Stream Pipeline (Video & Mic Audio)         │
└────────────────────────────────────────────────────────┘
```

---

## 2. Technology Stack

| Layer | Technologies |
|---|---|
| **Android Application** | Kotlin, Jetpack Compose, Coroutines, MediaProjection, Foreground Services, AccessibilityService, Stream WebRTC Android SDK, DataStore, OkHttp |
| **Frontend Dashboard** | React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons, Socket.IO Client, Vitest |
| **Backend API & Signaling** | Node.js (v24), TypeScript, Express, Socket.IO, Zod, Helmet, Vitest |
| **Database & Auth** | Supabase (PostgreSQL 15+, Row Level Security, Auth JWT) |
| **Real-Time Media** | WebRTC (Unified Plan, VP8/H.264, Opus Audio), STUN (`stun.l.google.com:19302`) |

---

## 3. Directory Structure

```
OmniControl/
├── backend/                  # REST API and WebRTC Signaling Server
│   ├── src/
│   │   ├── config/           # Zod environment variable parsing
│   │   ├── middleware/       # JWT auth & rate limiting
│   │   ├── routes/           # /api/v1/devices, /api/v1/sessions
│   │   ├── services/         # Pairing, Session lifecycle, Audit, Supabase
│   │   ├── signaling/        # Socket.IO authenticated WebRTC signaling
│   │   ├── types/            # Data models and Zod validation schemas
│   │   └── server.ts         # Express app configuration
│   ├── tests/                # Automated API and security test suite
│   ├── .env.example
│   └── package.json
│
├── frontend/                 # React Control Dashboard
│   ├── src/
│   │   ├── components/       # Layout, Navigation, Status Badges
│   │   ├── context/          # AuthContext with session persistence
│   │   ├── pages/            # Overview, Devices, RemoteSession, History, Security, Settings, Login
│   │   ├── services/         # REST API and WebRTC signaling clients
│   │   └── index.css         # Dark-themed glassmorphic design system
│   ├── .env.example
│   └── package.json
│
├── android/                  # Native Android Application (com.omnicontrol.app)
│   ├── app/
│   │   ├── src/main/java/com/omnicontrol/app/
│   │   │   ├── MainActivity.kt               # MediaProjection launcher & Compose navigation
│   │   │   ├── service/
│   │   │   │   ├── ScreenCaptureService.kt    # Foreground service with persistent notification
│   │   │   │   └── OmniAccessibilityService.kt# Authorized touch & gesture execution
│   │   │   ├── webrtc/WebRtcManager.kt       # WebRTC video/audio peer pipeline
│   │   │   ├── pairing/PairingRepository.kt  # Device enrollment & DataStore
│   │   │   ├── session/SessionManager.kt     # Active session state holder
│   │   │   └── ui/screens/                   # Welcome, Pairing, Dashboard, ActiveSession
│   │   ├── src/main/AndroidManifest.xml
│   │   └── build.gradle.kts
│   ├── build.gradle.kts
│   └── settings.gradle.kts
│
└── supabase/
    └── migrations/           # 20261026000000_init_omnicontrol.sql (Tables, RLS policies, Indexes)
```

---

## 4. Getting Started & Local Development

### Prerequisites
- **Node.js**: v18+ or v24 LTS (`node -v` && `npm -v`)
- **JDK**: Java 17 or higher (for building the Android project)
- **Android Studio**: Android Studio Hedgehog / Iguana / Ladybug or newer
- **Supabase Account** (Optional for local testing; backend includes built-in in-memory fallback for unit and integration testing)

---

### Step 1: Start the Backend API & Signaling Server

```bash
cd backend
cp .env.example .env
npm install
npm test          # Runs 10 automated unit & security tests
npm run dev       # Starts server on http://localhost:4000
```

Verify backend health:
```bash
curl http://localhost:4000/health
# Output: {"status":"healthy","service":"omnicontrol-backend",...}
```

---

### Step 2: Start the React Dashboard

In a new terminal window:
```bash
cd frontend
cp .env.example .env
npm install
npm test          # Runs frontend unit & integration tests
npm run dev       # Starts Vite dev server on http://localhost:5173
```

Open `http://localhost:5173` in your browser.  
Click **"Instant Developer Demo Account"** to access the dashboard immediately.

---

### Step 3: Run the Android Application

1. Open **Android Studio**.
2. Select **Open an Existing Project** and choose the `/Users/jupalli/SPY/android` folder.
3. Allow Gradle to sync dependencies.
4. **Target Device**:
   - **Android Emulator**: In the app's server settings, use `http://10.0.2.2:4000` (this maps to your host machine's `localhost`).
   - **Physical Device**: Connect phone via USB with USB Debugging enabled, or connect to the same Wi-Fi network and enter your Mac's LAN IP (e.g. `http://192.168.1.50:4000`).
5. Run the app (`Shift + F10` in Android Studio).

---

## 5. End-to-End Workflow

1. **Generate Pairing Code**: On the dashboard (`http://localhost:5173/devices`), click **"Pair New Android Device"**. A 6-digit numeric code (e.g. `482910`) appears with a 5-minute countdown.
2. **Enroll Device**: On your Android phone in the OmniControl app, tap **"Pair with Controller"**, enter the 6-digit code, and confirm. The phone is now permanently paired with your account.
3. **Initiate Remote Support**: On the dashboard, click **"Start Session"**.
4. **Grant Device Consent**: The Android phone displays the system screen sharing dialog (*"OmniControl will start capturing everything that's displayed on your screen"*). Tap **"Start now"**.
5. **Interactive Support**:
   - The dashboard receives and renders the live screen stream.
   - Click anywhere on the dashboard's virtual phone screen to send authorized tap commands. Drag to send swipe commands.
   - Use the soft navigation bar (Back, Home, Recents) below the screen viewer.
   - Speak or listen via live WebRTC voice audio.
6. **Terminate Session**: Either party can click **"End Session"** at any time. The foreground notification dismisses, WebRTC peer connections close, and screen capture releases immediately.

---

## 6. Android Platform Restrictions & Security Boundaries

1. **FLAG_SECURE**: Banking applications, password managers, and operating-system PIN entry fields intentionally display a black screen under MediaProjection. This is a core Android security protection and is never bypassed.
2. **Accessibility Consent**: Remote gestures (taps and swipes) require the device owner to explicitly turn on OmniControl in **Android Settings -> Accessibility**. If disabled, screen viewing functions normally while touch injection is safely ignored.
3. **No Covert Access**: There is no background surveillance. The foreground service notification remains permanently visible in the Android status bar for the entire duration of an active session.

---

## 7. Automated Test Suite

Both backend and frontend include test suites covering all critical security and functional paths.

### Backend Tests
```bash
cd backend && npm test
```
- ✅ Service health check endpoint
- ✅ Unauthorized pairing code rejection
- ✅ 6-digit cryptographically secure code generation
- ✅ Device enrollment and ownership assignment
- ✅ Single-use pairing code consumption (preventing replay attacks)
- ✅ Input validation for malformed codes
- ✅ Device access revocation
- ✅ Cross-user unauthorized revocation denial
- ✅ Remote session request, approval, and termination lifecycle
- ✅ Cross-user session creation rejection

### Frontend Tests
```bash
cd frontend && npm test
```
- ✅ Unauthenticated state renders login screen
- ✅ Developer demo account authentication and session persistence
- ✅ System Overview telemetry metrics rendering
- ✅ Protected route navigation to Devices management
