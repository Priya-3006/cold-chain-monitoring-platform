# End-to-End Live Demo & Evaluation Script

Follow this step-by-step walkthrough for an end-to-end live demonstration or viva review of the **Smart Cold-Chain Monitoring and Response Platform**.

---

## Pre-Requisites & Launching
1. Launch Backend API & IoT Simulator:
   ```bash
   npm run backend
   ```
   *(Running on `http://localhost:5000`, WebSocket on `ws://localhost:5000/ws`)*

2. Launch Frontend Application:
   ```bash
   npm run frontend
   ```
   *(Open `http://localhost:3000` in browser)*

---

## Step-by-Step Walkthrough

### Phase 1: Authentication & RBAC Demonstration
1. Open `http://localhost:3000`. You will see the **Cold-Chain Operations Portal Login**.
2. Notice the **Quick One-Click Demo Role Logins** at the bottom of the card:
   - Click **Warehouse Staff** (`warehouse@coldchain.com`).
   - You are immediately signed in with JWT token and directed to the **Guided Picking & Tasks** view.
   - Note the role badge: **Warehouse Employee**.

---

### Phase 2: Blinkit-Style Guided Picking & Validation (Shipment VC1024)
1. On the screen, you will see active Order **VC1024** for Apollo Main Hospital:
   - Vials to pick: Covaxin BBV152 (50 vials) & Covishield (20 vials).
2. **Test 1: Barcode Scan & FEFO Expiry Validation**:
   - Click **Scan Vial** next to Covaxin.
   - Switch to **Manual / Quick-Pick** tab in the scanner modal.
   - Click preset **`VA2024-EXP` (EXPIRED Batch)**:
     - 🛑 **Observation**: Dispensing is immediately BLOCKED. The system logs an incident alert: *"CRITICAL: Batch VA2024-EXP expired on 2025-01-01. Dispensing strictly prohibited by regulatory compliance."*
   - Click **Scan Vial** again and click preset **`VA2026-001` (Covaxin Valid Batch)**:
     - ✅ **Observation**: Verified! FEFO recommendation pops up indicating this batch expires earlier than VA2026-002, preventing warehouse spoilage. Pick count updates.
3. **Test 2: Container Compatibility & Guidance on Failure**:
   - Scroll to Step 2: **Container Assignment & Compatibility**.
   - Click **Scan Container QR**.
   - Click preset **`CONT-C003` (INCOMPATIBLE Ultra-Cold -70°C)**:
     - 🛑 **Observation**: The system does NOT merely fail silently. It provides proactive guidance:
       *"Wrong container! Covaxin requires 2°C to 8°C. Scanned C003 operates at -80°C to -60°C. Recommended compatible containers: C015, C001, C005."*
   - Click **Scan Container QR** again and click preset **`CONT-C015` (Compatible 2-8°C Active Refrigerator)**:
     - ✅ **Observation**: Container verified! Stage 3 unlocks.
4. **Test 3: Location-Verified Put-Away**:
   - Under Step 3, the system recommends: `CHN-CR-A-R01-S01` (Cold Room A / Rack R01 / Slot S01).
   - Click **Verify Put-Away Scan**.
   - Click preset **`LOC-CHN-CR-A-R01-S02` (WRONG Location)**:
     - 🛑 **Observation**: Mismatch detected: *"Wrong location! Expected CHN-CR-A-R01-S01, but scanned CHN-CR-A-R01-S02."*
   - Click **Verify Put-Away Scan** again and click preset **`LOC-CHN-CR-A-R01-S01` (CORRECT Location)**:
     - ✅ **Observation**: Location verified! Confetti triggers.
5. **Test 4: Pre-Dispatch Loading Checklist**:
   - In the right-hand panel, inspect the **Pre-Dispatch Checklist**.
   - Note that **"Proceed to Door Seal Verification"** button remains disabled until all 7 mandatory checklist items pass.
   - Check off all checklist boxes to unlock the next stage.

---

### Phase 3: Physical Seal Verification (Verification Staff)
1. In the top Navbar, switch role from the dropdown to **Verification Staff** (`verifier@coldchain.com`).
2. Navigate to **Physical Seal Verification** tab.
3. Select **Shipment VC1024**:
   - Dual-proof requirement: Door Reed Sensor must read **CLOSED** AND a camera photo proof must be uploaded.
   - Click **Capture Door Latch Photo** -> click **Choose photo from files** (or start camera to snap a photo).
   - Click **Verify Door Closure & Unlock Dispatch Stage**.
   - ✅ **Observation**: Verified! Consignment status transitions to `DOOR_VERIFIED` and `DISPATCH_READY`.

---

### Phase 4: IoT Fault Injection & Chaos Testing
1. In the top navigation bar, click the orange **Fault Injector** button.
2. In the slide-over drawer:
   - Click **Inject Temperature Spike (9.8°C)**.
   - Click **Simulate AC Power Outage**.
3. Close the drawer and navigate to **Live Cold-Chain Monitoring**:
   - ⚡ **Observation**: The **CRITICAL POWER MONITORING** banner immediately activates, displaying:
     - Main power OFF, backup battery active (88%).
     - Safe hold-time and remaining runtime calculations.
     - Red **Critical** status badge with rate-of-rise prediction: *"Rising at 0.28°C/min; threshold exceeded."*
4. Navigate to **Smart Alerts & SOPs**:
   - Notice the high-priority incident: **`ALT-...`: High Temperature Excursion: C015 at 9.8°C**.
   - The SOP guide displays step-by-step instructions from the SOP library (inspect latch, check humming compressor, transfer to Cold Room A if >10 min).
   - Click **Acknowledge Alert**.
   - Click **Take Corrective Action**: select root cause *"Door Latch Left Ajar"*, enter notes, and submit.
   - Click **Verify & Resolve Incident**.
   - Re-open the Fault Injector drawer and click **Reset Nominal State**.

---

### Phase 5: Driver Fleet & 4-Point Delivery Handover
1. In the top Navbar, switch role to **Driver** (`driver@coldchain.com`).
2. Navigate to **Driver Fleet & Proofs**:
   - Note that Driver Murugan P. sees ONLY his assigned vehicle and shipment (Strict RBAC).
   - Click **Start Delivery & Activate GPS Tracking**.
   - Consignment status transitions to `IN_TRANSIT`.
3. Inspect the **4-Point Delivery Handover** form at the bottom:
   - Notice that the driver cannot simply click "Completed".
   - Click **Capture Destination Sign** -> upload/snap photo.
   - Click **Capture Container Seal** -> upload/snap photo.
   - GPS proximity confirms driver is within 20 meters of Apollo Hospitals gate.
   - Enter Receiver Name: `Dr. Vimala Nathan` and OTP `849201`.
   - Click **Submit 4-Point Delivery Proof**.
   - ✅ **Observation**: Confetti triggers. Shipment transitions to `DELIVERED`.

---

### Phase 6: Hospital Inward Inspection Portal
1. Switch role to **Hospital Receiver** (`receiver@apollo.com`).
2. Navigate to **Hospital Receiving Portal**:
   - View inward Shipment VC1024 / VC1018.
   - Review 4-point handover proofs (photos, OTP confirmation, temperature history).
   - Click **Accept & Receive Vials**.
   - ✅ **Observation**: Consignment is marked **COMPLETED**.

---

### Phase 7: Public Vaccine Verification Portal (No Login Required)
1. Click **Public Vaccine Verification** tab in sidebar.
2. Enter consignment code **`VC1018`** and click **Verify**:
   - A sanitized authentication certificate appears showing origin depot, destination hospital, vaccine batches, and cryptographic compliance confirmation.

---

### Phase 8: Cryptographic Hash Chain Audit & Batch Recall
1. Switch role to **Auditor** (`auditor@cdsco.gov`).
2. Navigate to **Audit Chain & Compliance**:
   - **Tab 1: Cryptographic Audit Chain**:
     - Click **Verify Ledger Integrity**.
     - System traverses all SHA-256 blocks from genesis hash `000...000` to chain tip and confirms: *"All sequential audit entries verified successfully. Cryptographic chain is authentic and uncompromised."*
   - **Tab 2: Batch Recall Engine**:
     - Enter batch `VA2026-001` and click **Locate All Vials**.
     - Instantly maps all vials across containers, warehouses, and delivered hospitals with contact phone numbers.
   - **Tab 3: GDP Compliance Report**:
     - Displays WHO/CDSCO aligned compliance score (98.4%), Mean Kinetic Temperature (MKT = 4.2°C), and verification proof records.
     - Click **Export CSV** to download telemetry raw data.
     - Click **Print PDF** for printable inspection dossier.

---

### Phase 9: AI ColdChain Assistant (English & Tamil + Voice)
1. Click the floating **ColdChain Assistant** button in bottom-right corner.
2. Click any prompt chip or type in:
   - *"Which shipments are at risk right now?"* -> returns grounded in-transit risk scores and container temperatures.
   - *"Where is batch VA2026-001?"* -> returns exact custody location and depot slot.
   - *"Power failed in cold room, what do I do?"* -> returns step-by-step SOP instructions.
3. Click the **EN / தமிழ்** language button to switch to Tamil:
   - Type *"ஆபத்தில் உள்ள ஏற்றுமதிகள்"* or ask for batch location.
   - ColdChain Assistant answers in fluent Tamil grounded in the live database!
4. Click the **Mic** icon to test voice input via Web Speech API.
