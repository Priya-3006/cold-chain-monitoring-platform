# SMART COLD-CHAIN MONITORING AND RESPONSE PLATFORM FOR VACCINES AND TEMPERATURE-SENSITIVE MEDICINES

> **Tagline:** *Monitor → Scan → Validate → Guide → Perform → Verify → Track → Deliver → Record*  
> **Core Concept:** An end-to-end healthcare operations platform where every physical action requires digital proof:  
> $$\text{ACTION} \xrightarrow{\text{PROOF (scan / photo / sensor / GPS)}} \text{VERIFICATION} \xrightarrow{\text{SUCCESS}} \text{NEXT STEP UNLOCKED}$$

---

## 🌟 Key Highlights & Differentiators
1. **Proof-Gated Workflow Engine**: Critical actions cannot simply be marked "completed". Progression through the lifecycle requires unforgeable proof:
   - *Picking*: Vial barcode scan with FEFO & expiration checks (expired batches are hard-blocked).
   - *Container Assignment*: Validates container thermal capability vs vaccine specs (guides user with compatible alternatives if mismatched).
   - *Put-Away*: Staging slot scan confirms correct Cold Room, Rack, and Slot.
   - *Pre-Dispatch Gate*: 7-point digital checklist must pass 100%.
   - *Verification Staff*: Dual-proof door closure requires **Door Reed Sensor = CLOSED** AND a **Timestamped Photo Proof** of the locked latch.
   - *Driver Delivery Handover*: 4-Point proof requires **Destination Facade Photo** + **Package Seal Photo** + **GPS Proximity Check (< 20m)** + **Receiver Name & OTP Verification**.
2. **Product-Safety Logic & Kinetic Analytics**:
   - **Mean Kinetic Temperature (MKT)** via the Arrhenius equation ($\Delta H = 83.144 \text{ kJ/mol}$).
   - **Rate-of-Rise ($dT/dt$) Predictor**: Forecasts threshold breaches (*"Rising at 0.28°C/min; threshold reached in ~14 min"*).
   - **Emergency Hold-Time & Battery Runtime**: Computes passive hold time and compressor battery depletion hours under power failures.
   - **Freeze-Sensitivity Protection**: Immediate emergency alert if freeze-sensitive vaccines drop below minimum limits.
3. **Cryptographic SHA-256 Tamper-Evident Audit Ledger**:
   - Every event links to the cryptographic hash of the preceding block ($H_i = \text{SHA256}(H_{i-1} + \dots)$).
   - Live **Verify Integrity** engine recalculates all block hashes to detect any modified, inserted, or deleted records.
4. **Interactive IoT Chaos & Fault-Injection Simulator**:
   - Simulates real-time multi-sensor telemetry (temperature, humidity, magnetic door latch, power mode, battery, GPS coordinates).
   - One-click fault injection: Temperature spikes, door left open, power cut, battery drain, sensor offline, route deviation, and traffic delay.
5. **AI ColdChain Assistant**:
   - Grounded natural-language query assistant (English + Tamil + Voice input via Web Speech API).
   - Queries at-risk shipments, container telemetry, batch traceability, and step-by-step SOP procedures.
6. **Regulatory Compliance**:
   - Per-shipment compliance report (Printable PDF & CSV export) structured aligned with **WHO Good Distribution Practices (GDP)** & **CDSCO Guidelines**.

---

## 🛠️ Tech Stack
- **Frontend**: React 19, Vite 6, Tailwind CSS, Recharts, Leaflet, HTML5-QRCode, Canvas-Confetti, Lucide Icons.
- **Backend**: Node.js 24, Express, Native SQLite (`node:sqlite` zero external build dependencies), WebSockets (`ws`), JWT, BcryptJS, Multer.
- **Database**: SQLite schema structured for direct portability to PostgreSQL via parameterized DAO abstraction.
- **Architecture**: Decoupled client-server with live WebSocket streaming (`/ws`) and REST API (`/api`).

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js >= 20 (Node 24 recommended)
- npm >= 10

### 1. Installation
Install dependencies for both backend and frontend:
```bash
# In the root repository
cd backend && npm install
cd ../frontend && npm install
cd ..
```

### 2. Database Initialization & Seeding
Seed the database with 10 vaccines, 8 containers, 2 warehouses, 5 vehicles, users for all roles, SOP library, and historical shipments:
```bash
npm run seed
```

### 3. Running the Platform
Start the backend and frontend services:

**Terminal 1 (Backend API & IoT Simulator):**
```bash
npm run backend
```
*Backend runs at `http://localhost:5000` • WebSocket live feed at `ws://localhost:5000/ws`*

**Terminal 2 (Frontend Web Application):**
```bash
npm run frontend
```
*Frontend runs at `http://localhost:3000`*

---

## 🧪 Running Unit Tests
Execute the comprehensive unit test suite covering MKT Arrhenius calculations, product safety logic, container compatibility, put-away validation, proof-gating rules, audit hash chain integrity, and alert SLA escalation:
```bash
npm test
```

Test Results Summary:
```
✔ 1. Mean Kinetic Temperature (MKT) - Arrhenius Kinetics Calculation
✔ 2. Product-Safety Logic - Freeze Sensitivity & Excursion Recommendations
✔ 3. Container Compatibility Validation - Rejects Incompatible & Guides User
✔ 4. Warehouse Location Put-Away Validation
✔ 5. Proof-Gating Rules - Verification Staff Door Closure
✔ 6. Tamper-Evident SHA-256 Audit Chain Integrity & Tamper Detection
✔ 7. Alert Engine - Triggering, Deduplication, and SLA Escalation
ℹ tests 7 | pass 7 | fail 0
```

---

## 👥 Demo User Personas & Role-Based Access Control (RBAC)

All accounts share the default demo password: `password123`.

| Role | Employee ID | Email | Primary Responsibilities |
|---|---|---|---|
| **Warehouse Employee** | `EMP-WH-001` | `warehouse@coldchain.com` | Blinkit-style picking, container validation, put-away, loading checklist |
| **Manager** | `EMP-MGR-001` | `manager@coldchain.com` | Operations oversight, excursion sign-off, fleet radar, SLA tracking |
| **Driver** | `EMP-DRV-001` | `driver@coldchain.com` | Assigned delivery navigation, start delivery, 4-point handover proof |
| **Verification Staff** | `EMP-VRF-001` | `verifier@coldchain.com` | Dual-proof door closure verification (sensor CLOSED + camera photo) |
| **Hospital Receiver** | `EMP-HSP-001` | `receiver@apollo.com` | Apollo hospital receiving portal, thermal audit, accept/reject |
| **Auditor** | `EMP-AUD-001` | `auditor@cdsco.gov` | Read-only compliance, SHA-256 hash chain verification, batch recall |
| **Admin** | `EMP-ADM-001` | `admin@coldchain.com` | Master data (Users, Vaccines, Containers, Locations, SOPs) |

*Tip: You can switch personas instantly using the **Demo Role** dropdown in the top navigation bar or the quick-login cards on the login page.*

---

## 📖 Key Logic for Viva & Oral Review

### 1. Why MKT instead of Arithmetic Average?
Chemical degradation of biologics and vaccines follows the **Arrhenius law**, where reaction velocity increases exponentially with temperature. An arithmetic mean of (2°C, 2°C, 2°C, 14°C) would calculate as 5.0°C (falsely appearing compliant with 2–8°C). In contrast, the MKT calculation weights the 14°C spike exponentially higher, accurately reflecting the real thermal damage and potency loss.

### 2. How Does Proof-Gating Prevent Human Error?
Existing logistics apps allow operators to check a box saying "Door Closed" or "Item Delivered". In ColdChain Pro:
- A driver cannot complete delivery without uploading a **destination photo**, a **package photo**, confirming **GPS proximity within 20m of the hospital**, and recording the **receiver's name & OTP**.
- Verification staff cannot sign off on container closure unless the **magnetic reed sensor reads CLOSED** AND a **photo of the latch** is attached.
- A warehouse picker scanning an ultra-cold container for a 2–8°C vaccine is blocked with intelligent guidance: *"Wrong container, vaccine requires 2-8°C, compatible containers: C015, C001, C005"*.

### 3. How Does the Audit Hash Chain Ensure Tamper-Evidence?
Every audit record $i$ computes its current hash $H_i = \text{SHA256}(H_{i-1} \,\|\, \text{fields})$. If an attacker directly alters a row in the database (e.g. changing an excursion temperature from 12°C to 5°C), the recalculated hash pointer of that row and all subsequent rows will break. Clicking **"Verify Integrity"** instantly pinpoints the exact sequence number where tampering occurred.

---

## 📚 Technical Documentation Index
- [Architecture & State Machines](docs/ARCHITECTURE.md)
- [Relational ER Diagram](docs/ER_DIAGRAM.md)
- [REST & WebSocket API Specification](docs/API_SPEC.md)
- [ESP32 Hardware & MQTT Integration Guide](docs/ESP32_HARDWARE_GUIDE.md)
- [Step-by-Step Live Demo & Viva Walkthrough Script](docs/DEMO_SCRIPT.md)
