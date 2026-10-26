# OmniControl: Cross-Network WebRTC, TURN Relay & Live Voice Transmission Guide

This guide details the network architecture, TURN relay deployment, Android background service lifecycle, and cross-network test validation matrix for **OmniControl**.

---

## 1. Network Connectivity Architecture

OmniControl supports peer-to-peer real-time sessions across diverse, heterogeneous network topologies:
- Controller on **Home / Office Wi-Fi**, Android device on **5G / 4G LTE Mobile Data**.
- Both devices behind separate **Symmetric NATs** or Carrier-Grade NAT (CGNAT).
- Restrictive corporate or public Wi-Fi networks blocking direct UDP traffic.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Controller (Web Dashboard)                      │
│                (macOS / Windows / Android Chrome Browser)              │
└───────────────────▲────────────────────────────────▲───────────────────┘
                    │                                │
    HTTPS / WSS     │                                │ WebRTC DTLS/SRTP
 (Signaling, Auth,  │                                │ (Audio & Video Media)
 ICE Configuration) │                                │
                    ▼                                │
┌───────────────────────────────────────┐            │
│       OmniControl Node.js Server      │            │
│  • JWT Auth & Pairing Verification    │            │
│  • Socket.IO Session Coordination     │            │
│  • Ephemeral TURN HMAC Credential Gen │            │
└───────────────────────────────────────┘            │
                    │                                │
                    │ Socket.IO                      │
                    ▼                                │
┌───────────────────────────────────────┐            │
│       Authorized Android Device       │            │
│  • MediaProjection Screen Capturer    │            │
│  • Opus Audio Pipeline (Microphone)   │            │
│  • ConnectivityManager Network Monitor│            │
└───────────────────▲───────────────────┘            │
                    │                                │
                    │   STUN Succeeded?              │
                    ├─── YES ──> [Direct P2P Stream] ┤
                    │                                │
                    └─── NO (Symmetric NAT / Firewall)
                         │
                         ▼
             ┌───────────────────────┐
             │   COTURN Relay Server │
             │  (TURN UDP/TCP/TLS)   │───────────────┘
             └───────────────────────┘
```

---

## 2. Production TURN Server Deployment (coturn)

When devices are on different networks (e.g. mobile carrier data vs home broadband), direct P2P connections frequently fail due to symmetric NAT. A **TURN (Traversal Using Relays around NAT)** server acts as an encrypted media relay.

### Step 1: Install coturn on an Ubuntu/Debian Cloud VM (AWS, DigitalOcean, Hetzner)
```bash
sudo apt update && sudo apt install -y coturn
```

### Step 2: Configure `/etc/turnserver.conf`
```conf
# Listening ports
listening-port=3478
tls-listening-port=5349

# Public IP address of the server
external-ip=YOUR_SERVER_PUBLIC_IP

# Realm and authentication
realm=omnicontrol.net
lt-cred-mech
use-auth-secret
static-auth-secret=YOUR_HIGH_ENTROPY_TURN_SECRET

# Transport and performance
fingerprint
min-port=49152
max-port=65535
no-cli
no-tcp-relay=0
no-stdout-log
```

### Step 3: Firewall Configuration
Open the following ports on your cloud firewall / security group:
| Port | Protocol | Purpose |
|---|---|---|
| `3478` | UDP & TCP | Standard TURN & STUN |
| `5349` | UDP & TCP | Secure TLS TURN & STUN |
| `49152:65535` | UDP | Dynamic Relay Media Ports |

### Step 4: Configure OmniControl Backend
Add your server details to `backend/.env`:
```env
STUN_SERVER_URL=stun:turn.yourdomain.com:3478,stun:stun.l.google.com:19302
TURN_SERVER_URL=turn:turn.yourdomain.com:3478?transport=udp,turn:turn.yourdomain.com:3478?transport=tcp,turns:turn.yourdomain.com:5349?transport=tcp
TURN_SECRET=YOUR_HIGH_ENTROPY_TURN_SECRET
```

The backend automatically issues short-lived HMAC-SHA1 credentials (`3600s TTL`) to authenticated users, preventing unauthorized relay traffic.

---

## 3. Connection State Machine

OmniControl implements an explicit 9-state connection model:

```
[DISCONNECTED]
      │
      ▼
[CONNECTING]
      │
      ▼
[AUTHENTICATING]
      │
      ▼
[AWAITING_DEVICE_APPROVAL]
      │
      ▼
[ESTABLISHING_WEBRTC]
      │
      ▼
  [CONNECTED]
      │
      ├── (Microphone active) ──────> [VOICE_TRANSMISSION_ACTIVE]
      │                                       │
      │                                       ├── (Network interrupted) ──> [RECONNECTING]
      │                                       │                                   │
      │                                       │                                   ▼
      │                                       │                             [CONNECTED]
      │                                       ▼
      │                                 [VOICE_STOPPED]
      ▼
[DISCONNECTED] (Session ended by participant)
```

---

## 4. Cross-Network Test Matrix

| Test ID | Environment | Description | Expected Result |
|---|---|---|---|
| **TEST A** | Controller on Home Wi-Fi, Android on same Wi-Fi | Local LAN peer-to-peer WebRTC | Direct P2P (`host` candidate), RTT < 15ms, audio & screen live |
| **TEST B** | Controller on Home Wi-Fi, Android on 5G/LTE Mobile Data | Cross-network via STUN | Direct P2P (`srflx` candidate), RTT 30–80ms, audio clear |
| **TEST C** | Controller on Mobile Hotspot, Android on different Wi-Fi | Cross-network NAT traversal | Succeeded via STUN or TURN, media stable |
| **TEST D** | Symmetric NAT on both sides | Both networks block direct UDP | Traversal succeeds via TURN relay (`relay` candidate) |
| **TEST E** | Active session packet drop (Airplane mode toggle) | Temporary network loss (5s) | State shifts to `RECONNECTING`, auto ICE restart recovers stream |
| **TEST F** | Android switches Wi-Fi to Mobile Data | Handover during active voice | `ConnectivityManager.NetworkCallback` triggers ICE restart; stream resumes |
| **TEST G** | Enforced TURN Relay | Firewall blocking UDP ports | TCP/TLS fallback on port 3478/5349 relays stream |
| **TEST H** | Microphone permission rejected | User denies audio prompt | Screen streams without audio; status indicates "Mic Denied" |
| **TEST I** | Android user mutes or stops voice | User taps "Stop Audio" in app | Audio track instantly disabled; controller UI shows `VOICE_STOPPED` |
| **TEST J** | Controller terminates during reconnection | Peer ends session in `RECONNECTING` | Complete cleanup of WebRTC tracks, notification removed |
| **TEST K** | Expired / Invalid TURN credentials | Invalid secret or timestamp | Gracefully falls back to direct STUN; reports auth diagnostic |
| **TEST L** | Unauthorized device ID in signaling room | Malicious controller connects to socket | Rejected with `401 Unauthorized: User does not own session` |

---

## 5. APK Direct Download & Mobile Installation Troubleshooting

### 1. Direct Server Download Endpoint
The backend serves the compiled release APK with correct Android package headers:
- URL: `http://<SERVER_IP>:4000/download/OmniControl.apk`
- MIME: `application/vnd.android.package-archive`
- Content-Disposition: `attachment; filename="OmniControl.apk"`

### 2. Resolving "Problem parsing the package" on Mobile
- **Cause:** Android PackageInstaller was served an incomplete download or an HTML error page.
- **Fix:** Always download directly via `http://<SERVER_IP>:4000/download/OmniControl.apk` or GitHub Releases.

### 3. Resolving "Installation failed. Please try again" on Realme UI / ColorOS
- **Cause:** Conflicting signature with a previous debug build or Google Play Protect blocking custom APKs.
- **Fix:**
  1. Uninstall any older OmniControl installation from `Settings > Apps > App Management`.
  2. Open **Google Play Store** ➔ Profile icon ➔ **Play Protect** ➔ Settings gear ➔ Temporarily toggle **OFF** *"Scan apps with Play Protect"*.
  3. Tap the downloaded APK to install.
