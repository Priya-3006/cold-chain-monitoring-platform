# API Specification Reference

All endpoints (except login and public verification) require:
`Authorization: Bearer <JWT_TOKEN>`

## 1. Authentication (`/api/auth`)
| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | Public | Authenticates by Employee ID or Email + Password |
| `GET` | `/api/auth/me` | Authenticated | Retrieves current authenticated profile |
| `GET` | `/api/auth/demo-users` | Public | List of quick-switch demo personas for evaluation |

## 2. Warehouse Operations (`/api/warehouse`)
| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/api/warehouse/tasks` | Warehouse, Manager, Admin | Lists shipments requiring picking or put-away |
| `POST` | `/api/warehouse/scan-vaccine` | Warehouse, Admin | Scans vial barcode; validates FEFO & blocks expired |
| `POST` | `/api/warehouse/scan-container` | Warehouse, Admin | Validates container operating temp vs vaccine requirements |
| `POST` | `/api/warehouse/put-away` | Warehouse, Admin | Validates Cold Room/Rack/Slot staging QR |
| `POST` | `/api/warehouse/checklist-item` | Warehouse, Admin | Updates pre-dispatch checklist item |
| `GET` | `/api/warehouse/scan-events` | All Roles | Audit log of scans, mismatches, and corrections |
| `GET` | `/api/warehouse/container-tree/:id`| All Roles | Manifest contents tree & live telemetry of container |

## 3. Real-Time Monitoring (`/api/monitoring`)
| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/api/monitoring/overview` | All Roles | Real-time status of all containers, rooms, and vehicles |
| `GET` | `/api/monitoring/telemetry-history/:id`| All Roles | Historical series for thermodynamic Recharts curves |

## 4. Alert & SOP Response (`/api/alerts`)
| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/api/alerts` | All Roles | Lists active/resolved alerts with SOP details |
| `GET` | `/api/alerts/:id/details` | All Roles | Incident deep-dive with SOP step-by-step guidance |
| `POST` | `/api/alerts/:id/acknowledge`| Staff, Supervisor, Manager | Acknowledges alert, pauses SLA timer |
| `POST` | `/api/alerts/:id/action` | Staff, Supervisor, Manager | Records corrective action with root-cause and proof |
| `POST` | `/api/alerts/:id/resolve` | Supervisor, Manager, Admin | Resolves incident after verification |
| `POST` | `/api/alerts/:id/excursion-decision`| Manager, Admin | Authorizes "Safe to Use / Quarantine / Discard" |

## 5. Shipment & Physical Proof Gating (`/api/shipments`)
| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/api/shipments` | Role Filtered | Lists consignments (Driver sees ONLY their shipments) |
| `GET` | `/api/shipments/:id` | Role Filtered | Consignment details, checklists, and handover proofs |
| `POST` | `/api/shipments/:id/verify-door` | Verification Staff, Admin | Dual-proof door closure: sensor CLOSED + photo proof |
| `POST` | `/api/shipments/:id/dispatch` | Warehouse, Manager, Admin | Unlocks dispatch after door verification |
| `POST` | `/api/shipments/:id/delivery-proof`| Driver, Admin | 4-Point handover proof: Dest photo + Pkg photo + GPS + OTP |
| `POST` | `/api/shipments/:id/hospital-decision`| Hospital Receiver, Manager| Hospital inward inspection: Accept or Reject |
| `GET` | `/api/shipments/public-verify/:id`| Public | Consumer/patient verification page without login |

## 6. Traceability & Compliance (`/api/traceability`)
| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `GET` | `/api/traceability/audit-logs` | Auditor, Manager, Admin | Immutable sequential cryptographic audit ledger |
| `GET` | `/api/traceability/verify-integrity`| Auditor, Manager, Admin | Validates SHA-256 block hash pointers for tampering |
| `GET` | `/api/traceability/recall/:batch`| All Roles | Maps batch to containers, vehicles, and hospitals |
| `GET` | `/api/traceability/compliance-report/:id`| All Roles | Generates WHO/CDSCO aligned GDP audit report |

## 7. IoT Simulator & Fault Injection (`/api/simulator`)
| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `POST` | `/api/simulator/temp-spike` | All Roles | Injects high temperature spike (e.g. 9.8°C) |
| `POST` | `/api/simulator/door-open` | All Roles | Sets container door to OPEN (> 180s alarm) |
| `POST` | `/api/simulator/power-cut` | All Roles | Interrupts AC mains; switches to battery mode |
| `POST` | `/api/simulator/low-battery` | All Roles | Depletes battery to 18% critical reserve |
| `POST` | `/api/simulator/sensor-offline` | All Roles | Simulates telemetry packet drop / radio failure |
| `POST` | `/api/simulator/route-deviation`| All Roles | Deviates vehicle GPS > 2 km from route corridor |
| `POST` | `/api/simulator/transport-delay`| All Roles | Adds transport delay (+35 min) |
| `POST` | `/api/simulator/reset` | All Roles | Clears all injected faults to nominal steady-state |

## 8. AI Chatbot Assistant (`/api/ai`)
| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `POST` | `/api/ai/chat` | Authenticated | Grounded ColdChain Assistant query (English/Tamil) |

## 9. Physical Photo Proof Uploads (`/api/upload`)
| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `POST` | `/api/upload/photo` | Authenticated | Uploads webcam or file proof photo with GPS stamp |
