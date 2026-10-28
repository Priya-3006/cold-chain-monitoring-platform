# System Architecture & Technical Specification

## Smart Cold-Chain Monitoring and Response Platform for Vaccines and Temperature-Sensitive Medicines

### Tagline
**Monitor → Scan → Validate → Guide → Perform → Verify → Track → Deliver → Record**

---

## 1. High-Level Architecture
```mermaid
graph TD
    subgraph Edge & Field Layer
        ESP["ESP32 Microcontroller (or IoT Simulator)"]
        SENSORS["DS18B20 (Temp) + DHT22 (Humidity) + NEO-6M (GPS) + Reed Switch (Door)"]
        PROOFS["QR / 1D Barcode Scanners + Camera Latch Photos + Recipient OTP / Signatures"]
    end

    subgraph Backend Core [Node.js 24 + Express + Native SQLite]
        API_GATEWAY["REST API + JWT RBAC Guard"]
        WS_SERVER["WebSocket Server (/ws) - Real-time Telemetry"]
        WORKFLOW_ENG["Proof-Gated State Machine Engine"]
        ALERT_ENG["Smart Alert & SLA Escalation Engine (L1 -> L2 -> L3)"]
        SAFETY_ENG["Thermodynamic MKT (Arrhenius) + Hold-Time + Rate-of-Rise Predictor"]
        AUDIT_CHAIN["SHA-256 Tamper-Evident Cryptographic Ledger"]
        AI_ENGINE["ColdChain Assistant (Grounded DB Tools + English/Tamil NLP)"]
        DB[(Cold-Chain Relational DB)]
    end

    subgraph Client Application [React 19 + Vite + Tailwind CSS]
        MOBILE_VIEW["Mobile-Optimized PWA (Warehouse Picking, Driver Delivery, Door Verifier)"]
        DESKTOP_DASH["Desktop Operations Command (Admin, Manager, Auditor, Hospital Receiver)"]
        PUBLIC_PORTAL["Public Vaccine QR Verification Portal"]
    end

    ESP -->|MQTT / REST HTTP POST| API_GATEWAY
    SENSORS --> ESP
    PROOFS -->|Scan / Photo Upload| API_GATEWAY
    API_GATEWAY --> WORKFLOW_ENG
    API_GATEWAY --> ALERT_ENG
    API_GATEWAY --> SAFETY_ENG
    WORKFLOW_ENG --> DB
    ALERT_ENG --> DB
    SAFETY_ENG --> DB
    DB --> AUDIT_CHAIN
    WS_SERVER <-->|Bidirectional Telemetry & Alerts| Client
    API_GATEWAY <-->|REST API| Client
```

---

## 2. Proof-Gated Workflow Engine (State Machine)
The core differentiator of this platform is that physical actions cannot simply be marked "done". They require unforgeable proof:
$$\text{ACTION} \xrightarrow{\text{PROOF}} \text{VERIFICATION} \xrightarrow{\text{SUCCESS}} \text{NEXT STAGE UNLOCKED}$$

```mermaid
stateDiagram-v2
    [*] --> CREATED: Order Initialized
    CREATED --> PICKING: Warehouse Task Assigned
    PICKING --> CONTAINER_ASSIGNMENT: All Vials Scanned (FEFO & Expiry Checked)
    CONTAINER_ASSIGNMENT --> PUT_AWAY: Compatible Container Scanned & Validated
    PUT_AWAY --> LOADING_CHECKLIST: Storage Slot Verified
    LOADING_CHECKLIST --> DOOR_VERIFICATION: All 7 Checklist Items Passed
    DOOR_VERIFICATION --> DISPATCH_READY: Door Sensor CLOSED + Latch Photo Verified
    DISPATCH_READY --> IN_TRANSIT: Dispatched & GPS Active
    IN_TRANSIT --> DELIVERED: 4-Point Proof Submitted (Dest Photo + Pkg Photo + GPS Proximity + Receiver OTP)
    DELIVERED --> COMPLETED: Hospital Receiver Inward Inspection Accepted
    COMPLETED --> [*]
```

---

## 3. Product-Safety & Predictive Analytics Algorithms

### A. Mean Kinetic Temperature (MKT)
Calculated via the Arrhenius equation with activation energy $\Delta H = 83.144 \text{ kJ/mol}$:
$$T_{\text{mkt}} = \frac{\frac{\Delta H}{R}}{-\ln \left( \frac{1}{n} \sum_{i=1}^n e^{-\frac{\Delta H}{R \cdot T_i}} \right)}$$
Where $T_i$ is temperature in Kelvin, $R = 8.314472 \text{ J/(mol}\cdot\text{K)}$.
Because the degradation rate is exponential, transient high-temperature spikes contribute disproportionately to the MKT compared to arithmetic mean.

### B. Rate-of-Temperature-Rise ($dT/dt$) Predictor
Evaluates the temperature gradient over the preceding 5–10 minutes:
$$\frac{dT}{dt} = \frac{T_{\text{latest}} - T_{\text{initial}}}{\Delta t}$$
$$\text{Minutes to Threshold} = \frac{T_{\text{max}} - T_{\text{latest}}}{dT/dt}$$
Enables proactive warnings: *"Rising at 0.28°C/min; threshold (8.0°C) reached in ~14 min"*.

### C. Safe Hold-Time Calculation Under Power Failure
$$\text{Passive Hold Time } t = -\tau \ln \left( \frac{T_{\text{ambient}} - T_{\text{max}}}{T_{\text{ambient}} - T_0} \right)$$
Where $\tau$ is the thermal insulation time constant of the container (typically 6.0 hours for active compressors).

---

## 4. Cryptographic Hash Chain Ledger
Every mutation (log, pick, alert, scan, decision) generates a cryptographically linked block:
$$H_i = \text{SHA256}(H_{i-1} \,\|\, \text{Timestamp} \,\|\, \text{UserId} \,\|\, \text{Role} \,\|\, \text{Action} \,\|\, \text{Entity} \,\|\, \text{Details})$$
- Genesis Hash: `0000000000000000000000000000000000000000000000000000000000000000`
- The system includes a live **"Verify Integrity"** engine that recomputes hash pointers across all sequence blocks and flags any tampered or deleted entry.
