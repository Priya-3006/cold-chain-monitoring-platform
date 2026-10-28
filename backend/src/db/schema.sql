-- SMART COLD-CHAIN MONITORING AND RESPONSE PLATFORM
-- Database Schema (SQLite & PostgreSQL Compatible)

-- 1. ROLES
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. USERS
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  employee_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  warehouse_id TEXT,
  responsibilities TEXT,
  phone TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME
);

-- 3. WAREHOUSES
CREATE TABLE IF NOT EXISTS warehouses (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  contact_person TEXT,
  contact_phone TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. STORAGE LOCATIONS HIERARCHY
-- Warehouse -> Cold Room -> Rack -> Slot
CREATE TABLE IF NOT EXISTS storage_locations (
  id TEXT PRIMARY KEY,
  warehouse_id TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  qr_code TEXT UNIQUE NOT NULL,
  cold_room TEXT NOT NULL,
  rack TEXT NOT NULL,
  slot TEXT NOT NULL,
  min_temp REAL NOT NULL,
  max_temp REAL NOT NULL,
  allowed_container_types TEXT NOT NULL, -- JSON array e.g. ["ACTIVE_ULTRA_COLD", "PASSIVE_COOLBOX"]
  capacity INTEGER DEFAULT 10,
  current_occupancy INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
);

-- 5. HOSPITALS / DESTINATIONS
CREATE TABLE IF NOT EXISTS hospitals (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  contact_person TEXT,
  contact_phone TEXT,
  is_backup_facility INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. VACCINES (Vaccine Master)
CREATE TABLE IF NOT EXISTS vaccines (
  id TEXT PRIMARY KEY,
  vaccine_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  manufacturer TEXT NOT NULL,
  min_temp REAL NOT NULL,
  max_temp REAL NOT NULL,
  freeze_sensitive INTEGER DEFAULT 0, -- 1: strict alert if < min_temp
  storage_instructions TEXT,
  compatible_container_types TEXT NOT NULL, -- JSON array
  vvm_type TEXT DEFAULT 'VVM30', -- Vaccine Vial Monitor type (VVM2, VVM7, VVM14, VVM30)
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. BATCHES
CREATE TABLE IF NOT EXISTS batches (
  id TEXT PRIMARY KEY,
  batch_number TEXT UNIQUE NOT NULL,
  vaccine_id TEXT NOT NULL,
  manufacturing_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  initial_quantity INTEGER NOT NULL,
  remaining_quantity INTEGER NOT NULL,
  vvm_stage INTEGER DEFAULT 1, -- 1: normal, 2: acceptable, 3: discard, 4: unusable
  mkt_cached REAL DEFAULT 4.0,
  time_out_of_range_seconds INTEGER DEFAULT 0,
  safety_status TEXT DEFAULT 'SAFE', -- SAFE, QUARANTINE, DISCARD
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vaccine_id) REFERENCES vaccines(id)
);

-- 8. CONTAINERS (Container Master)
CREATE TABLE IF NOT EXISTS containers (
  id TEXT PRIMARY KEY,
  container_code TEXT UNIQUE NOT NULL,
  qr_code TEXT UNIQUE NOT NULL,
  container_type TEXT NOT NULL, -- ACTIVE_COMPRESSOR, ACTIVE_ULTRA_COLD, PASSIVE_COOLBOX, PCM_CARRIER
  min_temp REAL NOT NULL,
  max_temp REAL NOT NULL,
  capacity_liters REAL NOT NULL,
  cooling_capability TEXT NOT NULL, -- ACTIVE_REFRIGERATION, DRY_ICE, PCM, GEL_PACKS
  battery_pct INTEGER DEFAULT 100,
  power_status TEXT DEFAULT 'MAINS_POWER', -- MAINS_POWER, BATTERY, CRITICAL, OFFLINE
  door_status TEXT DEFAULT 'CLOSED', -- CLOSED, OPEN
  current_temp REAL DEFAULT 4.5,
  current_humidity REAL DEFAULT 50.0,
  current_location_id TEXT, -- In warehouse storage location
  current_vehicle_id TEXT,  -- In transit
  current_shipment_id TEXT,
  status TEXT DEFAULT 'AVAILABLE', -- AVAILABLE, IN_USE, MAINTENANCE, QUARANTINED
  is_active INTEGER DEFAULT 1,
  last_telemetry_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (current_location_id) REFERENCES storage_locations(id)
);

-- 9. CONTAINER VACCINES (Contents Tree)
CREATE TABLE IF NOT EXISTS container_vaccines (
  id TEXT PRIMARY KEY,
  container_id TEXT NOT NULL,
  batch_id TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  loaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  unloaded_at DATETIME,
  FOREIGN KEY (container_id) REFERENCES containers(id),
  FOREIGN KEY (batch_id) REFERENCES batches(id)
);

-- 10. VEHICLES
CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY,
  vehicle_number TEXT UNIQUE NOT NULL,
  driver_id TEXT,
  vehicle_type TEXT DEFAULT 'REFRIGERATED_VAN',
  cooling_type TEXT DEFAULT 'ONBOARD_CHILLER',
  gps_device_id TEXT UNIQUE,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  speed_kmh REAL DEFAULT 0,
  heading REAL DEFAULT 0,
  status TEXT DEFAULT 'IDLE', -- IDLE, IN_TRANSIT, MAINTENANCE
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (driver_id) REFERENCES users(id)
);

-- 11. SHIPMENTS
CREATE TABLE IF NOT EXISTS shipments (
  id TEXT PRIMARY KEY,
  shipment_number TEXT UNIQUE NOT NULL,
  origin_warehouse_id TEXT NOT NULL,
  destination_hospital_id TEXT NOT NULL,
  vehicle_id TEXT,
  driver_id TEXT,
  container_id TEXT,
  status TEXT DEFAULT 'CREATED', -- CREATED, PICKED, PUT_AWAY, LOADED, DOOR_VERIFIED, DISPATCHED, IN_TRANSIT, DELIVERED, VERIFIED, COMPLETED, CANCELLED
  current_step TEXT DEFAULT 'PICKING',
  risk_score REAL DEFAULT 0.0, -- 0-100%
  risk_reasons TEXT, -- JSON breakdown
  eta_minutes INTEGER DEFAULT 45,
  distance_km REAL DEFAULT 24.5,
  planned_route TEXT, -- JSON array of waypoints [[lat, lng], ...]
  door_open_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  dispatched_at DATETIME,
  delivered_at DATETIME,
  completed_at DATETIME,
  FOREIGN KEY (origin_warehouse_id) REFERENCES warehouses(id),
  FOREIGN KEY (destination_hospital_id) REFERENCES hospitals(id),
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
  FOREIGN KEY (driver_id) REFERENCES users(id),
  FOREIGN KEY (container_id) REFERENCES containers(id)
);

-- 12. SHIPMENT ITEMS
CREATE TABLE IF NOT EXISTS shipment_items (
  id TEXT PRIMARY KEY,
  shipment_id TEXT NOT NULL,
  vaccine_id TEXT NOT NULL,
  batch_id TEXT,
  quantity_requested INTEGER NOT NULL,
  quantity_picked INTEGER DEFAULT 0,
  status TEXT DEFAULT 'PENDING', -- PENDING, PICKED, LOADED
  FOREIGN KEY (shipment_id) REFERENCES shipments(id),
  FOREIGN KEY (vaccine_id) REFERENCES vaccines(id),
  FOREIGN KEY (batch_id) REFERENCES batches(id)
);

-- 13. PROOF FILES (Storage for camera photos, signatures, docs)
CREATE TABLE IF NOT EXISTS proof_files (
  id TEXT PRIMARY KEY,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL, -- PHOTO_DOOR, PHOTO_DELIVERY, SIGNATURE, ATTACHMENT
  original_name TEXT,
  mime_type TEXT,
  file_size INTEGER,
  gps_latitude REAL,
  gps_longitude REAL,
  uploaded_by TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (uploaded_by) REFERENCES users(id)
);

-- 14. TELEMETRY LOGS (Historical temperature, humidity, power, doors)
CREATE TABLE IF NOT EXISTS temperature_logs (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL, -- CONTAINER, WAREHOUSE_ROOM, VEHICLE
  entity_id TEXT NOT NULL,
  temperature REAL NOT NULL,
  humidity REAL NOT NULL,
  door_open INTEGER DEFAULT 0,
  power_mode TEXT DEFAULT 'MAINS_POWER', -- MAINS_POWER, BATTERY, GENERATOR, OFFLINE
  battery_pct INTEGER DEFAULT 100,
  is_redundant INTEGER DEFAULT 0, -- 1 if secondary sensor probe
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 15. GPS LOGS
CREATE TABLE IF NOT EXISTS gps_logs (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL,
  shipment_id TEXT,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  speed REAL DEFAULT 0,
  heading REAL DEFAULT 0,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 16. SENSOR LOGS / HEARTBEATS
CREATE TABLE IF NOT EXISTS sensor_logs (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  sensor_id TEXT NOT NULL,
  sensor_type TEXT NOT NULL, -- PRIMARY_PROBE, REDUNDANT_PROBE, DOOR_REED, GPS, BATTERY
  status TEXT DEFAULT 'ONLINE', -- ONLINE, OFFLINE, DEGRADED, DRIFTING
  last_heartbeat DATETIME DEFAULT CURRENT_TIMESTAMP,
  battery_level INTEGER DEFAULT 100
);

-- 17. SCAN EVENTS (Log every scan, wrong scan, and correction)
CREATE TABLE IF NOT EXISTS scan_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- VACCINE_PICK, CONTAINER_CHECK, LOCATION_PUTAWAY, DISPATCH_SCAN, DELIVERY_SCAN
  scanned_code TEXT NOT NULL,
  expected_code TEXT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  status TEXT NOT NULL, -- SUCCESS, MISMATCH, EXPIRED, INCOMPATIBLE, INVALID
  message TEXT NOT NULL,
  correction_of_event_id TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 18. SOP LIBRARY
CREATE TABLE IF NOT EXISTS sop_library (
  id TEXT PRIMARY KEY,
  alert_type TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  trigger_condition TEXT NOT NULL,
  severity TEXT NOT NULL, -- LOW, MEDIUM, HIGH, CRITICAL
  root_cause_category TEXT NOT NULL,
  step_by_step_instructions TEXT NOT NULL, -- JSON array of steps
  escalation_minutes INTEGER DEFAULT 30,
  required_proof_type TEXT DEFAULT 'NONE' -- NONE, PHOTO, SENSOR_VERIFY, MANAGER_SIGN
);

-- 19. ALERTS
CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  alert_code TEXT UNIQUE NOT NULL,
  alert_type TEXT NOT NULL, -- TEMP_HIGH, TEMP_LOW, FREEZE_RISK, DOOR_OPEN_TOO_LONG, POWER_FAILURE, LOW_BATTERY, SENSOR_OFFLINE, NETWORK_LOSS, TRANSPORT_DELAY, ROUTE_DEVIATION, WRONG_SCAN
  severity TEXT NOT NULL, -- WARNING, CRITICAL, EMERGENCY
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  shipment_id TEXT,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  current_reading TEXT,
  sop_id TEXT,
  status TEXT DEFAULT 'CREATED', -- CREATED, ASSIGNED, ACKNOWLEDGED, ACTION_TAKEN, VERIFIED, RESOLVED
  assigned_user_id TEXT,
  assigned_role TEXT,
  escalation_level INTEGER DEFAULT 1, -- 1: Operator, 2: Supervisor, 3: Manager
  sla_deadline DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  acknowledged_at DATETIME,
  action_taken_at DATETIME,
  resolved_at DATETIME,
  resolved_by TEXT,
  FOREIGN KEY (sop_id) REFERENCES sop_library(id),
  FOREIGN KEY (assigned_user_id) REFERENCES users(id),
  FOREIGN KEY (resolved_by) REFERENCES users(id)
);

-- 20. ALERT ACTIONS
CREATE TABLE IF NOT EXISTS alert_actions (
  id TEXT PRIMARY KEY,
  alert_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  action_taken TEXT NOT NULL,
  root_cause TEXT,
  proof_file_id TEXT,
  notes TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (alert_id) REFERENCES alerts(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (proof_file_id) REFERENCES proof_files(id)
);

-- 21. CHECKLISTS (Proof-gated Loading & Dispatch)
CREATE TABLE IF NOT EXISTS checklists (
  id TEXT PRIMARY KEY,
  shipment_id TEXT NOT NULL,
  checklist_type TEXT DEFAULT 'DISPATCH_LOADING',
  item_key TEXT NOT NULL,
  item_label TEXT NOT NULL,
  is_mandatory INTEGER DEFAULT 1,
  passed INTEGER DEFAULT 0,
  verified_by TEXT,
  verified_at DATETIME,
  proof_file_id TEXT,
  notes TEXT,
  FOREIGN KEY (shipment_id) REFERENCES shipments(id),
  FOREIGN KEY (verified_by) REFERENCES users(id),
  FOREIGN KEY (proof_file_id) REFERENCES proof_files(id)
);

-- 22. DELIVERY CONFIRMATIONS
CREATE TABLE IF NOT EXISTS delivery_confirmations (
  id TEXT PRIMARY KEY,
  shipment_id TEXT UNIQUE NOT NULL,
  receiver_name TEXT NOT NULL,
  receiver_phone TEXT,
  receiver_signature_url TEXT,
  otp_code TEXT,
  otp_verified INTEGER DEFAULT 0,
  gps_latitude REAL,
  gps_longitude REAL,
  distance_from_hospital_meters REAL,
  destination_photo_id TEXT,
  package_photo_id TEXT,
  confirmed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (shipment_id) REFERENCES shipments(id),
  FOREIGN KEY (destination_photo_id) REFERENCES proof_files(id),
  FOREIGN KEY (package_photo_id) REFERENCES proof_files(id)
);

-- 23. EXCURSION DECISIONS (Product Safety Logic)
CREATE TABLE IF NOT EXISTS excursion_decisions (
  id TEXT PRIMARY KEY,
  alert_id TEXT,
  batch_id TEXT NOT NULL,
  shipment_id TEXT,
  mkt_at_decision REAL NOT NULL,
  cumulative_out_of_range_secs INTEGER NOT NULL,
  recommendation TEXT NOT NULL, -- SAFE_TO_USE, QUARANTINE, DISCARD
  reasoning TEXT NOT NULL,
  manager_decision TEXT, -- APPROVED_SAFE, APPROVED_QUARANTINE, APPROVED_DISCARD
  manager_notes TEXT,
  decided_by TEXT,
  decided_at DATETIME,
  FOREIGN KEY (alert_id) REFERENCES alerts(id),
  FOREIGN KEY (batch_id) REFERENCES batches(id),
  FOREIGN KEY (shipment_id) REFERENCES shipments(id),
  FOREIGN KEY (decided_by) REFERENCES users(id)
);

-- 24. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  role TEXT,
  channel TEXT NOT NULL, -- IN_APP, SMS_MOCK, WHATSAPP_MOCK, EMAIL_MOCK
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_read INTEGER DEFAULT 0,
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 25. CHAT LOGS
CREATE TABLE IF NOT EXISTS chat_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  role TEXT,
  query TEXT NOT NULL,
  response TEXT NOT NULL,
  language TEXT DEFAULT 'en', -- en, ta
  tool_calls_json TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 26. AUDIT LOGS (Tamper-evident Cryptographic Hash Chain)
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  sequence_number INTEGER UNIQUE NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  user_id TEXT,
  user_role TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details_json TEXT,
  prev_hash TEXT NOT NULL,
  current_hash TEXT NOT NULL
);

-- INDEXES FOR FAST SCAN & REAL-TIME QUERIES
CREATE INDEX IF NOT EXISTS idx_containers_qr ON containers(qr_code);
CREATE INDEX IF NOT EXISTS idx_storage_qr ON storage_locations(qr_code);
CREATE INDEX IF NOT EXISTS idx_vaccines_code ON vaccines(vaccine_code);
CREATE INDEX IF NOT EXISTS idx_batches_num ON batches(batch_number);
CREATE INDEX IF NOT EXISTS idx_shipments_num ON shipments(shipment_number);
CREATE INDEX IF NOT EXISTS idx_temp_entity_ts ON temperature_logs(entity_type, entity_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status, severity);
CREATE INDEX IF NOT EXISTS idx_audit_seq ON audit_logs(sequence_number);
