import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { execute, queryOne, db } from './database.js';
import { logAuditEvent } from '../services/auditHashChain.js';

export async function seedDatabase() {
  console.log('--- Starting Database Seeding ---');

  // Clear existing data in reverse order of foreign keys
  const tables = [
    'audit_logs', 'chat_logs', 'notifications', 'excursion_decisions',
    'delivery_confirmations', 'checklists', 'alert_actions', 'alerts',
    'sop_library', 'scan_events', 'sensor_logs', 'gps_logs', 'temperature_logs',
    'proof_files', 'shipment_items', 'shipments', 'container_vaccines',
    'vehicles', 'containers', 'batches', 'vaccines', 'hospitals',
    'storage_locations', 'warehouses', 'users', 'roles'
  ];

  for (const table of tables) {
    execute(`DELETE FROM ${table}`);
  }

  // 1. ROLES
  const roles = [
    { id: 'role-admin', name: 'Admin', description: 'System administration, user and master data management' },
    { id: 'role-warehouse', name: 'Warehouse Employee', description: 'Blinkit-style guided picking, scanning, packing and put-away' },
    { id: 'role-manager', name: 'Manager', description: 'Operations oversight, excursion approvals, SLA tracking and compliance' },
    { id: 'role-driver', name: 'Driver', description: 'Assigned deliveries, route navigation, door-open logging, and delivery proof' },
    { id: 'role-verification', name: 'Verification Staff', description: 'Physical door seals, safety checks and photo verification' },
    { id: 'role-hospital', name: 'Hospital Receiver', description: 'Hospital reception, batch verification, acceptance/rejection' },
    { id: 'role-auditor', name: 'Auditor', description: 'Read-only regulatory compliance, audit hash chain verification' }
  ];

  for (const r of roles) {
    execute('INSERT INTO roles (id, name, description) VALUES (?, ?, ?)', [r.id, r.name, r.description]);
  }

  // 2. USERS (Password for all demo users: password123)
  const passwordHash = await bcrypt.hash('password123', 10);
  const users = [
    {
      id: 'usr-admin',
      employee_id: 'EMP-ADM-001',
      name: 'Dr. Rajesh Sekhar',
      email: 'admin@coldchain.com',
      role: 'Admin',
      warehouse_id: 'wh-chn-01',
      responsibilities: 'Overall Master Data & Security Admin',
      phone: '+91 98401 11222'
    },
    {
      id: 'usr-warehouse',
      employee_id: 'EMP-WH-001',
      name: 'Karthik Ramasamy',
      email: 'warehouse@coldchain.com',
      role: 'Warehouse Employee',
      warehouse_id: 'wh-chn-01',
      responsibilities: 'Picking, Put-away, Loading Verification',
      phone: '+91 98402 33445'
    },
    {
      id: 'usr-manager',
      employee_id: 'EMP-MGR-001',
      name: 'Ananya Sundaram',
      email: 'manager@coldchain.com',
      role: 'Manager',
      warehouse_id: 'wh-chn-01',
      responsibilities: 'Operations Manager, Excursion Approvals',
      phone: '+91 98403 55667'
    },
    {
      id: 'usr-driver',
      employee_id: 'EMP-DRV-001',
      name: 'Murugan P.',
      email: 'driver@coldchain.com',
      role: 'Driver',
      warehouse_id: 'wh-chn-01',
      responsibilities: 'Reefer Van Fleet Pilot',
      phone: '+91 98404 77889'
    },
    {
      id: 'usr-verifier',
      employee_id: 'EMP-VRF-001',
      name: 'Selvi Meenakshi',
      email: 'verifier@coldchain.com',
      role: 'Verification Staff',
      warehouse_id: 'wh-chn-01',
      responsibilities: 'Door Closure and Cold Seal Inspection',
      phone: '+91 98405 99001'
    },
    {
      id: 'usr-hospital',
      employee_id: 'EMP-HSP-001',
      name: 'Dr. Vimala Nathan',
      email: 'receiver@apollo.com',
      role: 'Hospital Receiver',
      warehouse_id: null,
      responsibilities: 'Apollo Hospitals Head Pharmacist',
      phone: '+91 98406 12345'
    },
    {
      id: 'usr-auditor',
      employee_id: 'EMP-AUD-001',
      name: 'S. Ramanathan (CDSCO/WHO)',
      email: 'auditor@cdsco.gov',
      role: 'Auditor',
      warehouse_id: null,
      responsibilities: 'Cold-Chain Regulatory Auditor',
      phone: '+91 98407 67890'
    }
  ];

  for (const u of users) {
    execute(
      `INSERT INTO users (id, employee_id, name, email, password_hash, role, warehouse_id, responsibilities, phone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [u.id, u.employee_id, u.name, u.email, passwordHash, u.role, u.warehouse_id, u.responsibilities, u.phone]
    );
  }

  // 3. WAREHOUSES
  const warehouses = [
    {
      id: 'wh-chn-01',
      code: 'WH-CHN-01',
      name: 'Chennai Central State Vaccine Depot',
      city: 'Chennai',
      address: 'Guindy Industrial Estate, Chennai 600032',
      latitude: 13.0067,
      longitude: 80.2023,
      contact_person: 'Ananya Sundaram',
      contact_phone: '+91 98403 55667'
    },
    {
      id: 'wh-cbe-01',
      code: 'WH-CBE-01',
      name: 'Coimbatore Regional Cold Distribution Hub',
      city: 'Coimbatore',
      address: 'Peelamedu Tech Zone, Coimbatore 641004',
      latitude: 11.0267,
      longitude: 76.9934,
      contact_person: 'R. Balasubramanian',
      contact_phone: '+91 94431 88990'
    }
  ];

  for (const w of warehouses) {
    execute(
      `INSERT INTO warehouses (id, code, name, city, address, latitude, longitude, contact_person, contact_phone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [w.id, w.code, w.name, w.city, w.address, w.latitude, w.longitude, w.contact_person, w.contact_phone]
    );
  }

  // 4. STORAGE LOCATIONS HIERARCHY
  const storageLocations = [
    // Chennai Cold Room A (2 to 8 C)
    {
      id: 'loc-chn-cra-r01-s01',
      warehouse_id: 'wh-chn-01',
      code: 'CHN-CR-A-R01-S01',
      qr_code: 'LOC-CHN-CR-A-R01-S01',
      cold_room: 'Cold Room A (2-8°C)',
      rack: 'Rack R01',
      slot: 'Slot S01',
      min_temp: 2.0,
      max_temp: 8.0,
      allowed_container_types: JSON.stringify(['ACTIVE_COMPRESSOR', 'PASSIVE_COOLBOX', 'PCM_CARRIER']),
      capacity: 10,
      current_occupancy: 2
    },
    {
      id: 'loc-chn-cra-r01-s02',
      warehouse_id: 'wh-chn-01',
      code: 'CHN-CR-A-R01-S02',
      qr_code: 'LOC-CHN-CR-A-R01-S02',
      cold_room: 'Cold Room A (2-8°C)',
      rack: 'Rack R01',
      slot: 'Slot S02',
      min_temp: 2.0,
      max_temp: 8.0,
      allowed_container_types: JSON.stringify(['ACTIVE_COMPRESSOR', 'PASSIVE_COOLBOX']),
      capacity: 10,
      current_occupancy: 1
    },
    {
      id: 'loc-chn-cra-r01-s03',
      warehouse_id: 'wh-chn-01',
      code: 'CHN-CR-A-R01-S03',
      qr_code: 'LOC-CHN-CR-A-R01-S03',
      cold_room: 'Cold Room A (2-8°C)',
      rack: 'Rack R01',
      slot: 'Slot S03',
      min_temp: 2.0,
      max_temp: 8.0,
      allowed_container_types: JSON.stringify(['ACTIVE_COMPRESSOR', 'PASSIVE_COOLBOX']),
      capacity: 10,
      current_occupancy: 0
    },
    // Chennai Freezer Room C (-20 C)
    {
      id: 'loc-chn-frc-r03-s01',
      warehouse_id: 'wh-chn-01',
      code: 'CHN-FR-C-R03-S01',
      qr_code: 'LOC-CHN-FR-C-R03-S01',
      cold_room: 'Freezer Room C (-20°C)',
      rack: 'Rack R03',
      slot: 'Slot S01',
      min_temp: -25.0,
      max_temp: -15.0,
      allowed_container_types: JSON.stringify(['PCM_CARRIER', 'ACTIVE_COMPRESSOR']),
      capacity: 8,
      current_occupancy: 1
    },
    // Chennai Ultra-Cold Room D (-70 C)
    {
      id: 'loc-chn-ucd-r04-s01',
      warehouse_id: 'wh-chn-01',
      code: 'CHN-UCD-R04-S01',
      qr_code: 'LOC-CHN-UCD-R04-S01',
      cold_room: 'Ultra Cold Room D (-70°C)',
      rack: 'Rack R04',
      slot: 'Slot S01',
      min_temp: -80.0,
      max_temp: -60.0,
      allowed_container_types: JSON.stringify(['ACTIVE_ULTRA_COLD']),
      capacity: 4,
      current_occupancy: 1
    },
    // Coimbatore Cold Room A
    {
      id: 'loc-cbe-cra-r01-s01',
      warehouse_id: 'wh-cbe-01',
      code: 'CBE-CR-A-R01-S01',
      qr_code: 'LOC-CBE-CR-A-R01-S01',
      cold_room: 'Cold Room A (2-8°C)',
      rack: 'Rack R01',
      slot: 'Slot S01',
      min_temp: 2.0,
      max_temp: 8.0,
      allowed_container_types: JSON.stringify(['ACTIVE_COMPRESSOR', 'PASSIVE_COOLBOX']),
      capacity: 12,
      current_occupancy: 1
    }
  ];

  for (const l of storageLocations) {
    execute(
      `INSERT INTO storage_locations (
        id, warehouse_id, code, qr_code, cold_room, rack, slot, min_temp, max_temp, allowed_container_types, capacity, current_occupancy
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        l.id, l.warehouse_id, l.code, l.qr_code, l.cold_room, l.rack, l.slot,
        l.min_temp, l.max_temp, l.allowed_container_types, l.capacity, l.current_occupancy
      ]
    );
  }

  // 5. HOSPITALS / DESTINATIONS
  const hospitals = [
    {
      id: 'hsp-apollo-greams',
      code: 'HSP-APO-01',
      name: 'Apollo Main Hospital',
      address: '21 Greams Lane, Thousand Lights, Chennai 600006',
      city: 'Chennai',
      latitude: 13.0567,
      longitude: 80.2520,
      contact_person: 'Dr. Vimala Nathan',
      contact_phone: '+91 98406 12345',
      is_backup_facility: 0
    },
    {
      id: 'hsp-mmc-chennai',
      code: 'HSP-MMC-02',
      name: 'Rajiv Gandhi Govt General Hospital (MMC)',
      address: 'EVR Periyar Salai, Park Town, Chennai 600003',
      city: 'Chennai',
      latitude: 13.0827,
      longitude: 80.2764,
      contact_person: 'Dr. K. Swaminathan',
      contact_phone: '+91 98408 22334',
      is_backup_facility: 1
    },
    {
      id: 'hsp-kmc-backup',
      code: 'HSP-KMC-03',
      name: 'Kilpauk Medical College Cold Storage (Emergency Backup)',
      address: 'Poonamallee High Rd, Kilpauk, Chennai 600010',
      city: 'Chennai',
      latitude: 13.0782,
      longitude: 80.2415,
      contact_person: 'Duty Medical Officer',
      contact_phone: '+91 98409 99887',
      is_backup_facility: 1
    },
    {
      id: 'hsp-cmch-coimbatore',
      code: 'HSP-CMC-04',
      name: 'Coimbatore Medical College Hospital',
      address: 'Trichy Rd, Coimbatore 641018',
      city: 'Coimbatore',
      latitude: 11.0028,
      longitude: 76.9669,
      contact_person: 'Dr. Ramesh Kumar',
      contact_phone: '+91 94432 11223',
      is_backup_facility: 0
    }
  ];

  for (const h of hospitals) {
    execute(
      `INSERT INTO hospitals (id, code, name, address, city, latitude, longitude, contact_person, contact_phone, is_backup_facility)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [h.id, h.code, h.name, h.address, h.city, h.latitude, h.longitude, h.contact_person, h.contact_phone, h.is_backup_facility]
    );
  }

  // 6. VACCINE MASTER (10 vaccines with temperature ranges, freeze sensitivity, VVM)
  const vaccines = [
    {
      id: 'vac-pfizer-mrna',
      vaccine_code: 'VAC-PFIZER-01',
      name: 'Comirnaty COVID-19 mRNA',
      manufacturer: 'Pfizer-BioNTech',
      min_temp: -80.0,
      max_temp: -60.0,
      freeze_sensitive: 0,
      storage_instructions: 'Ultra-low temperature thermal shipper. Thaw only before dilution.',
      compatible_container_types: JSON.stringify(['ACTIVE_ULTRA_COLD']),
      vvm_type: 'VVM30'
    },
    {
      id: 'vac-moderna-mrna',
      vaccine_code: 'VAC-MODERNA-02',
      name: 'Spikevax COVID-19 mRNA',
      manufacturer: 'Moderna Inc.',
      min_temp: -25.0,
      max_temp: -15.0,
      freeze_sensitive: 0,
      storage_instructions: 'Store frozen between -25°C to -15°C. Do not store in dry ice.',
      compatible_container_types: JSON.stringify(['PCM_CARRIER', 'ACTIVE_COMPRESSOR']),
      vvm_type: 'VVM14'
    },
    {
      id: 'vac-covaxin',
      vaccine_code: 'VAC-COVAXIN-03',
      name: 'Covaxin BBV152 Inactivated',
      manufacturer: 'Bharat Biotech',
      min_temp: 2.0,
      max_temp: 8.0,
      freeze_sensitive: 1, // CRITICAL: NEVER FREEZE
      storage_instructions: 'Keep refrigerated at 2°C to 8°C. Shake test required if sub-zero excursion occurred.',
      compatible_container_types: JSON.stringify(['ACTIVE_COMPRESSOR', 'PASSIVE_COOLBOX', 'PCM_CARRIER']),
      vvm_type: 'VVM7'
    },
    {
      id: 'vac-covishield',
      vaccine_code: 'VAC-COVISHIELD-04',
      name: 'Covishield ChAdOx1-S',
      manufacturer: 'Serum Institute of India',
      min_temp: 2.0,
      max_temp: 8.0,
      freeze_sensitive: 1,
      storage_instructions: 'Store between 2°C and 8°C. Do not freeze. Protect from light.',
      compatible_container_types: JSON.stringify(['ACTIVE_COMPRESSOR', 'PASSIVE_COOLBOX', 'PCM_CARRIER']),
      vvm_type: 'VVM30'
    },
    {
      id: 'vac-hepb',
      vaccine_code: 'VAC-HEPB-05',
      name: 'GeneVac-B Hepatitis B',
      manufacturer: 'Serum Institute of India',
      min_temp: 2.0,
      max_temp: 8.0,
      freeze_sensitive: 1, // Extreme freeze sensitivity
      storage_instructions: 'Aluminum adjuvant will precipitate if frozen. Absolutely strictly 2°C to 8°C.',
      compatible_container_types: JSON.stringify(['ACTIVE_COMPRESSOR', 'PASSIVE_COOLBOX']),
      vvm_type: 'VVM30'
    },
    {
      id: 'vac-rotavac',
      vaccine_code: 'VAC-ROTAVAC-06',
      name: 'Rotavac Oral Rotavirus',
      manufacturer: 'Bharat Biotech',
      min_temp: 2.0,
      max_temp: 8.0,
      freeze_sensitive: 1,
      storage_instructions: 'Liquid formulation. Store at 2°C to 8°C.',
      compatible_container_types: JSON.stringify(['ACTIVE_COMPRESSOR', 'PASSIVE_COOLBOX']),
      vvm_type: 'VVM7'
    },
    {
      id: 'vac-mmr',
      vaccine_code: 'VAC-MMR-07',
      name: 'Tresivac MMR Vaccine',
      manufacturer: 'Serum Institute of India',
      min_temp: 2.0,
      max_temp: 8.0,
      freeze_sensitive: 0,
      storage_instructions: 'Lyophilized. Safe at 2°C to 8°C, can tolerate freezing before reconstitution.',
      compatible_container_types: JSON.stringify(['ACTIVE_COMPRESSOR', 'PASSIVE_COOLBOX']),
      vvm_type: 'VVM14'
    },
    {
      id: 'vac-insulin',
      vaccine_code: 'VAC-INSULIN-08',
      name: 'Human Actrapid Insulin',
      manufacturer: 'Novo Nordisk',
      min_temp: 2.0,
      max_temp: 8.0,
      freeze_sensitive: 1,
      storage_instructions: 'Do not freeze. Protein denatures irreversibly if ice crystals form.',
      compatible_container_types: JSON.stringify(['ACTIVE_COMPRESSOR', 'PASSIVE_COOLBOX']),
      vvm_type: 'VVM30'
    },
    {
      id: 'vac-hrig',
      vaccine_code: 'VAC-HRIG-09',
      name: 'Rabishield Rabies Immunoglobulin',
      manufacturer: 'Serum Institute of India',
      min_temp: 2.0,
      max_temp: 8.0,
      freeze_sensitive: 1,
      storage_instructions: 'Sterile immunoglobulin. Store at 2°C to 8°C strictly.',
      compatible_container_types: JSON.stringify(['ACTIVE_COMPRESSOR', 'PASSIVE_COOLBOX']),
      vvm_type: 'VVM30'
    },
    {
      id: 'vac-bopv',
      vaccine_code: 'VAC-BOPV-10',
      name: 'BiO-Polio bOPV (Oral Polio)',
      manufacturer: 'Bharat Biotech',
      min_temp: -25.0,
      max_temp: -15.0,
      freeze_sensitive: 0,
      storage_instructions: 'Must remain frozen at -20°C for long term. Can be thawed to 2-8°C for field use up to 6 months.',
      compatible_container_types: JSON.stringify(['PCM_CARRIER', 'ACTIVE_COMPRESSOR']),
      vvm_type: 'VVM2'
    }
  ];

  for (const v of vaccines) {
    execute(
      `INSERT INTO vaccines (
        id, vaccine_code, name, manufacturer, min_temp, max_temp, freeze_sensitive,
        storage_instructions, compatible_container_types, vvm_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        v.id, v.vaccine_code, v.name, v.manufacturer, v.min_temp, v.max_temp,
        v.freeze_sensitive, v.storage_instructions, v.compatible_container_types, v.vvm_type
      ]
    );
  }

  // 7. BATCHES (with FEFO dates, near-expiry, and expired sample)
  const batches = [
    // Covaxin batches (for FEFO testing)
    {
      id: 'btc-cov-001',
      batch_number: 'VA2026-001',
      vaccine_id: 'vac-covaxin',
      manufacturing_date: '2025-10-01',
      expiry_date: '2026-11-30', // Near expiry (FEFO recommendation!)
      initial_quantity: 500,
      remaining_quantity: 320,
      vvm_stage: 1,
      mkt_cached: 4.2,
      safety_status: 'SAFE'
    },
    {
      id: 'btc-cov-002',
      batch_number: 'VA2026-002',
      vaccine_id: 'vac-covaxin',
      manufacturing_date: '2026-01-15',
      expiry_date: '2027-04-30', // Later expiry
      initial_quantity: 1000,
      remaining_quantity: 950,
      vvm_stage: 1,
      mkt_cached: 4.0,
      safety_status: 'SAFE'
    },
    {
      id: 'btc-cov-exp',
      batch_number: 'VA2024-EXP',
      vaccine_id: 'vac-covaxin',
      manufacturing_date: '2024-01-01',
      expiry_date: '2025-01-01', // Expired batch (testing scanner blocking!)
      initial_quantity: 200,
      remaining_quantity: 50,
      vvm_stage: 3,
      mkt_cached: 9.8,
      safety_status: 'DISCARD'
    },
    // Covishield batches
    {
      id: 'btc-cvs-001',
      batch_number: 'CS2026-101',
      vaccine_id: 'vac-covishield',
      manufacturing_date: '2025-11-10',
      expiry_date: '2026-12-31',
      initial_quantity: 800,
      remaining_quantity: 600,
      vvm_stage: 1,
      mkt_cached: 4.5,
      safety_status: 'SAFE'
    },
    // Pfizer Ultra-Cold batch
    {
      id: 'btc-pfz-001',
      batch_number: 'PF2026-777',
      vaccine_id: 'vac-pfizer-mrna',
      manufacturing_date: '2026-02-01',
      expiry_date: '2026-10-15',
      initial_quantity: 300,
      remaining_quantity: 250,
      vvm_stage: 1,
      mkt_cached: -72.0,
      safety_status: 'SAFE'
    },
    // Moderna Frozen batch
    {
      id: 'btc-mod-001',
      batch_number: 'MD2026-404',
      vaccine_id: 'vac-moderna-mrna',
      manufacturing_date: '2026-01-01',
      expiry_date: '2027-01-01',
      initial_quantity: 400,
      remaining_quantity: 380,
      vvm_stage: 1,
      mkt_cached: -19.5,
      safety_status: 'SAFE'
    },
    // Hepatitis B
    {
      id: 'btc-hpb-001',
      batch_number: 'HB2026-901',
      vaccine_id: 'vac-hepb',
      manufacturing_date: '2025-12-01',
      expiry_date: '2027-06-30',
      initial_quantity: 600,
      remaining_quantity: 540,
      vvm_stage: 1,
      mkt_cached: 4.8,
      safety_status: 'SAFE'
    },
    // Insulin
    {
      id: 'btc-ins-001',
      batch_number: 'IN2026-312',
      vaccine_id: 'vac-insulin',
      manufacturing_date: '2026-02-10',
      expiry_date: '2027-02-10',
      initial_quantity: 450,
      remaining_quantity: 400,
      vvm_stage: 1,
      mkt_cached: 5.1,
      safety_status: 'SAFE'
    }
  ];

  for (const b of batches) {
    execute(
      `INSERT INTO batches (
        id, batch_number, vaccine_id, manufacturing_date, expiry_date,
        initial_quantity, remaining_quantity, vvm_stage, mkt_cached, safety_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        b.id, b.batch_number, b.vaccine_id, b.manufacturing_date, b.expiry_date,
        b.initial_quantity, b.remaining_quantity, b.vvm_stage, b.mkt_cached, b.safety_status
      ]
    );
  }

  // 8. CONTAINERS (8 Containers with different capabilities)
  const containers = [
    {
      id: 'cnt-c015',
      container_code: 'C015',
      qr_code: 'CONT-C015',
      container_type: 'ACTIVE_COMPRESSOR',
      min_temp: 2.0,
      max_temp: 8.0,
      capacity_liters: 45.0,
      cooling_capability: 'ACTIVE_REFRIGERATION',
      battery_pct: 92,
      power_status: 'MAINS_POWER',
      door_status: 'CLOSED',
      current_temp: 4.6,
      current_humidity: 48.0,
      current_location_id: 'loc-chn-cra-r01-s01',
      status: 'AVAILABLE'
    },
    {
      id: 'cnt-c001',
      container_code: 'C001',
      qr_code: 'CONT-C001',
      container_type: 'ACTIVE_COMPRESSOR',
      min_temp: 2.0,
      max_temp: 8.0,
      capacity_liters: 60.0,
      cooling_capability: 'ACTIVE_REFRIGERATION',
      battery_pct: 96,
      power_status: 'MAINS_POWER',
      door_status: 'CLOSED',
      current_temp: 4.2,
      current_humidity: 50.0,
      current_location_id: 'loc-chn-cra-r01-s02',
      status: 'AVAILABLE'
    },
    {
      id: 'cnt-c002',
      container_code: 'C002',
      qr_code: 'CONT-C002',
      container_type: 'ACTIVE_COMPRESSOR',
      min_temp: 2.0,
      max_temp: 8.0,
      capacity_liters: 50.0,
      cooling_capability: 'ACTIVE_REFRIGERATION',
      battery_pct: 88,
      power_status: 'BATTERY',
      door_status: 'CLOSED',
      current_temp: 5.1,
      current_humidity: 52.0,
      current_location_id: null,
      current_vehicle_id: 'veh-01',
      current_shipment_id: 'shp-vc1020',
      status: 'IN_USE'
    },
    {
      id: 'cnt-c003',
      container_code: 'C003',
      qr_code: 'CONT-C003',
      container_type: 'ACTIVE_ULTRA_COLD',
      min_temp: -80.0,
      max_temp: -60.0,
      capacity_liters: 30.0,
      cooling_capability: 'DRY_ICE',
      battery_pct: 98,
      power_status: 'MAINS_POWER',
      door_status: 'CLOSED',
      current_temp: -74.5,
      current_humidity: 20.0,
      current_location_id: 'loc-chn-ucd-r04-s01',
      status: 'AVAILABLE'
    },
    {
      id: 'cnt-c004',
      container_code: 'C004',
      qr_code: 'CONT-C004',
      container_type: 'PCM_CARRIER',
      min_temp: -25.0,
      max_temp: -15.0,
      capacity_liters: 35.0,
      cooling_capability: 'PCM',
      battery_pct: 100,
      power_status: 'MAINS_POWER',
      door_status: 'CLOSED',
      current_temp: -20.2,
      current_humidity: 35.0,
      current_location_id: 'loc-chn-frc-r03-s01',
      status: 'AVAILABLE'
    },
    {
      id: 'cnt-c005',
      container_code: 'C005',
      qr_code: 'CONT-C005',
      container_type: 'PASSIVE_COOLBOX',
      min_temp: 2.0,
      max_temp: 8.0,
      capacity_liters: 25.0,
      cooling_capability: 'GEL_PACKS',
      battery_pct: 100,
      power_status: 'MAINS_POWER',
      door_status: 'CLOSED',
      current_temp: 4.8,
      current_humidity: 55.0,
      current_location_id: 'loc-chn-cra-r01-s01',
      status: 'AVAILABLE'
    },
    {
      id: 'cnt-c006',
      container_code: 'C006',
      qr_code: 'CONT-C006',
      container_type: 'PASSIVE_COOLBOX',
      min_temp: 2.0,
      max_temp: 8.0,
      capacity_liters: 20.0,
      cooling_capability: 'GEL_PACKS',
      battery_pct: 100,
      power_status: 'MAINS_POWER',
      door_status: 'CLOSED',
      current_temp: 5.4,
      current_humidity: 56.0,
      current_location_id: 'loc-cbe-cra-r01-s01',
      status: 'AVAILABLE'
    },
    {
      id: 'cnt-c007',
      container_code: 'C007',
      qr_code: 'CONT-C007',
      container_type: 'ACTIVE_COMPRESSOR',
      min_temp: 2.0,
      max_temp: 8.0,
      capacity_liters: 75.0,
      cooling_capability: 'ACTIVE_REFRIGERATION',
      battery_pct: 38,
      power_status: 'BATTERY',
      door_status: 'CLOSED',
      current_temp: 6.8,
      current_humidity: 58.0,
      current_location_id: null,
      status: 'MAINTENANCE'
    }
  ];

  for (const c of containers) {
    execute(
      `INSERT INTO containers (
        id, container_code, qr_code, container_type, min_temp, max_temp,
        capacity_liters, cooling_capability, battery_pct, power_status, door_status,
        current_temp, current_humidity, current_location_id, current_vehicle_id,
        current_shipment_id, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        c.id, c.container_code, c.qr_code, c.container_type, c.min_temp, c.max_temp,
        c.capacity_liters, c.cooling_capability, c.battery_pct, c.power_status, c.door_status,
        c.current_temp, c.current_humidity, c.current_location_id, c.current_vehicle_id || null,
        c.current_shipment_id || null, c.status
      ]
    );
  }

  // 9. VEHICLES (5 Vehicles)
  const vehicles = [
    {
      id: 'veh-01',
      vehicle_number: 'TN-01-AB-1001',
      driver_id: 'usr-driver',
      vehicle_type: 'REFRIGERATED_VAN',
      cooling_type: 'ONBOARD_CHILLER',
      gps_device_id: 'GPS-TN-01-1001',
      latitude: 13.0425,
      longitude: 80.2312,
      speed_kmh: 38,
      heading: 45,
      status: 'IN_TRANSIT'
    },
    {
      id: 'veh-02',
      vehicle_number: 'TN-02-CD-2002',
      driver_id: null,
      vehicle_type: 'ELECTRIC_REEFER_VAN',
      cooling_type: 'BATTERY_CHILLER',
      gps_device_id: 'GPS-TN-02-2002',
      latitude: 13.0067,
      longitude: 80.2023,
      speed_kmh: 0,
      heading: 0,
      status: 'IDLE'
    },
    {
      id: 'veh-03',
      vehicle_number: 'TN-09-EF-3003',
      driver_id: null,
      vehicle_type: 'HEAVY_REEFER_TRUCK',
      cooling_type: 'DIESEL_ELECTRIC_CHILLER',
      gps_device_id: 'GPS-TN-09-3003',
      latitude: 13.0070,
      longitude: 80.2030,
      speed_kmh: 0,
      heading: 0,
      status: 'IDLE'
    },
    {
      id: 'veh-04',
      vehicle_number: 'TN-10-GH-4004',
      driver_id: null,
      vehicle_type: 'RAPID_PHARMA_VAN',
      cooling_type: 'ONBOARD_CHILLER',
      gps_device_id: 'GPS-TN-10-4004',
      latitude: 13.0065,
      longitude: 80.2020,
      speed_kmh: 0,
      heading: 0,
      status: 'IDLE'
    },
    {
      id: 'veh-05',
      vehicle_number: 'TN-37-JK-5005',
      driver_id: null,
      vehicle_type: 'INTER_DISTRICT_TRUCK',
      cooling_type: 'ONBOARD_CHILLER',
      gps_device_id: 'GPS-TN-37-5005',
      latitude: 11.0267,
      longitude: 76.9934,
      speed_kmh: 0,
      heading: 0,
      status: 'IDLE'
    }
  ];

  for (const v of vehicles) {
    execute(
      `INSERT INTO vehicles (id, vehicle_number, driver_id, vehicle_type, cooling_type, gps_device_id, latitude, longitude, speed_kmh, heading, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [v.id, v.vehicle_number, v.driver_id, v.vehicle_type, v.cooling_type, v.gps_device_id, v.latitude, v.longitude, v.speed_kmh, v.heading, v.status]
    );
  }

  // 10. SOP LIBRARY (Standard Operating Procedures for alerts)
  const sops = [
    {
      id: 'sop-temp-high',
      alert_type: 'TEMP_HIGH',
      title: 'High Temperature Excursion Response',
      trigger_condition: 'Temperature rises > 8.0°C in 2-8°C zone or > -15°C in frozen zone for > 5 min',
      severity: 'CRITICAL',
      root_cause_category: 'Refrigeration Failure / Door Seal Degradation',
      step_by_step_instructions: JSON.stringify([
        'Step 1: Check physical door latch and inspect rubber gasket for air leaks.',
        'Step 2: Inspect compressor power cable and confirm compressor motor is humming.',
        'Step 3: If running on battery, verify battery voltage and plug into primary AC outlet immediately.',
        'Step 4: If temperature does not drop below 8°C within 10 minutes, transfer contents to backup container or Cold Room A-R01-S03.',
        'Step 5: Record MKT and submit incident report for Quality Manager approval.'
      ]),
      escalation_minutes: 15,
      required_proof_type: 'SENSOR_VERIFY'
    },
    {
      id: 'sop-freeze-risk',
      alert_type: 'FREEZE_RISK',
      title: 'Freeze-Sensitive Sub-Zero Emergency Protocol',
      trigger_condition: 'Temperature drops < 2.0°C for freeze-sensitive vaccines (Covaxin, Covishield, HepB, Insulin)',
      severity: 'EMERGENCY',
      root_cause_category: 'Over-cooling / Direct contact with frozen gel packs',
      step_by_step_instructions: JSON.stringify([
        'Step 1: IMMEDIATELY move container away from direct airflow vent or remove unconditioned ice packs.',
        'Step 2: Ensure conditioned gel packs (at 0°C with visible water film) are separated from vials with cardboard or foam dividers.',
        'Step 3: Monitor until temperature rebounds to > 3.0°C.',
        'Step 4: Perform WHO Shake Test on representative vials to check for irreversible adjuvant precipitation.',
        'Step 5: File Excursion Decision form for Manager sign-off before dispatching.'
      ]),
      escalation_minutes: 10,
      required_proof_type: 'MANAGER_SIGN'
    },
    {
      id: 'sop-door-open',
      alert_type: 'DOOR_OPEN_TOO_LONG',
      title: 'Door Open Exceeded Limit Protocol',
      trigger_condition: 'Container or Cold Room door remains open for > 180 seconds',
      severity: 'WARNING',
      root_cause_category: 'Operator Neglect / Loading Delays / Mechanical Jam',
      step_by_step_instructions: JSON.stringify([
        'Step 1: Locate physical container and close door immediately until the latch clicks.',
        'Step 2: Check door reed sensor alignment if door is physically closed but still shows OPEN.',
        'Step 3: Verification Staff must capture timestamped photo of closed latch.',
        'Step 4: Confirm door status reads CLOSED in UI to unlock next workflow step.'
      ]),
      escalation_minutes: 5,
      required_proof_type: 'PHOTO'
    },
    {
      id: 'sop-power-cut',
      alert_type: 'POWER_FAILURE',
      title: 'Power Outage & Backup Generator Response',
      trigger_condition: 'Mains AC voltage lost, container or warehouse switched to battery/generator',
      severity: 'CRITICAL',
      root_cause_category: 'Grid Failure / Blown Breaker / Disconnected Cable',
      step_by_step_instructions: JSON.stringify([
        'Step 1: Confirm Automatic Transfer Switch (ATS) engaged and backup generator is online.',
        'Step 2: Check container battery level and calculate safe hold-time remaining.',
        'Step 3: Minimize door openings during power outage.',
        'Step 4: If backup power fails and battery drops below 30%, dispatch emergency transport to nearest backup facility.'
      ]),
      escalation_minutes: 20,
      required_proof_type: 'SENSOR_VERIFY'
    },
    {
      id: 'sop-sensor-offline',
      alert_type: 'SENSOR_OFFLINE',
      title: 'Telemetry Heartbeat Missing Protocol',
      trigger_condition: 'No heartbeat or sensor telemetry received for > 120 seconds',
      severity: 'WARNING',
      root_cause_category: 'Telemetry Radio Drop / Dead Coin Cell / Firmware Crash',
      step_by_step_instructions: JSON.stringify([
        'Step 1: Check redundant secondary sensor probe readings.',
        'Step 2: Inspect physical IoT telemetry module for power LED indicator.',
        'Step 3: If in transit, check cellular signal connectivity with driver.',
        'Step 4: Perform manual physical temperature reading with calibrated reference thermometer and log manually.'
      ]),
      escalation_minutes: 15,
      required_proof_type: 'NONE'
    },
    {
      id: 'sop-wrong-scan',
      alert_type: 'WRONG_SCAN',
      title: 'Barcode Mismatch & Guided Picking Error',
      trigger_condition: 'Scanned container or location does not match required parameters',
      severity: 'LOW',
      root_cause_category: 'Operator Selection Error / Incompatible Container Type',
      step_by_step_instructions: JSON.stringify([
        'Step 1: Read the UI guidance message indicating the incompatible attribute.',
        'Step 2: Return incompatible container to its staging slot.',
        'Step 3: Scan the recommended compatible container code displayed on screen.',
        'Step 4: Scan event correction is automatically recorded in the audit log.'
      ]),
      escalation_minutes: 60,
      required_proof_type: 'NONE'
    },
    {
      id: 'sop-route-dev',
      alert_type: 'ROUTE_DEVIATION',
      title: 'Transport Route Deviation & Unplanned Stop',
      trigger_condition: 'Vehicle GPS deviates > 2 km from corridor or stops for > 15 min outside authorized stops',
      severity: 'HIGH',
      root_cause_category: 'Driver Detour / Traffic Gridlock / Vehicle Breakdown',
      step_by_step_instructions: JSON.stringify([
        'Step 1: Call driver Murugan P. immediately via registered phone.',
        'Step 2: Assess container temperature stability and battery level.',
        'Step 3: If vehicle is broken down, identify nearest backup cold facility from the map suggestions.',
        'Step 4: Reroute or dispatch recovery van if delay threatens safe cold-chain hold time.'
      ]),
      escalation_minutes: 15,
      required_proof_type: 'NONE'
    }
  ];

  for (const s of sops) {
    execute(
      `INSERT INTO sop_library (id, alert_type, title, trigger_condition, severity, root_cause_category, step_by_step_instructions, escalation_minutes, required_proof_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [s.id, s.alert_type, s.title, s.trigger_condition, s.severity, s.root_cause_category, s.step_by_step_instructions, s.escalation_minutes, s.required_proof_type]
    );
  }

  // 11. SAMPLE SHIPMENTS
  // Shipment 1: VC1024 - Active Guided Picking / Workflow Demo
  const routeWaypoints = JSON.stringify([
    [13.0067, 80.2023], // Origin: Guindy
    [13.0210, 80.2150], // Saidapet
    [13.0380, 80.2330], // T. Nagar
    [13.0567, 80.2520]  // Apollo Greams Rd
  ]);

  execute(
    `INSERT INTO shipments (
      id, shipment_number, origin_warehouse_id, destination_hospital_id, vehicle_id, driver_id, container_id,
      status, current_step, risk_score, risk_reasons, eta_minutes, distance_km, planned_route
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'shp-vc1024',
      'VC1024',
      'wh-chn-01',
      'hsp-apollo-greams',
      'veh-01',
      'usr-driver',
      'cnt-c015',
      'CREATED',
      'PICKING', // Picking -> Container Assignment -> Put-Away -> Loading Checklist -> Door Verified -> Dispatched
      12.5,
      JSON.stringify(['Route clear', 'Temperature normal', 'Container battery 92%']),
      45,
      14.2,
      routeWaypoints
    ]
  );

  // Items for VC1024
  execute(
    `INSERT INTO shipment_items (id, shipment_id, vaccine_id, batch_id, quantity_requested, quantity_picked, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['item-vc1024-1', 'shp-vc1024', 'vac-covaxin', 'btc-cov-001', 50, 0, 'PENDING']
  );
  execute(
    `INSERT INTO shipment_items (id, shipment_id, vaccine_id, batch_id, quantity_requested, quantity_picked, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['item-vc1024-2', 'shp-vc1024', 'vac-covishield', 'btc-cvs-001', 20, 0, 'PENDING']
  );

  // Default loading checklist for VC1024
  const checklistItems = [
    { key: 'vaccine_scanned', label: 'All Vaccines Barcode Scanned & Count Verified', mandatory: 1 },
    { key: 'batch_verified', label: 'Batch Numbers Match Order Specification', mandatory: 1 },
    { key: 'expiry_verified', label: 'FEFO Expiry Date Valid (No Expired Vials)', mandatory: 1 },
    { key: 'container_scanned', label: 'Compatible Container Scanned & Validated', mandatory: 1 },
    { key: 'temp_verified', label: 'Current Container Temp within 2°C - 8°C', mandatory: 1 },
    { key: 'door_closed', label: 'Container Latch Closed & Sensor Verified', mandatory: 1 },
    { key: 'shipment_confirmed', label: 'Shipment Details & Destination Route Confirmed', mandatory: 1 }
  ];

  for (const item of checklistItems) {
    execute(
      `INSERT INTO checklists (id, shipment_id, checklist_type, item_key, item_label, is_mandatory, passed)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), 'shp-vc1024', 'DISPATCH_LOADING', item.key, item.label, item.mandatory, 0]
    );
  }

  // Shipment 2: VC1020 - In-Transit with Live Tracking
  execute(
    `INSERT INTO shipments (
      id, shipment_number, origin_warehouse_id, destination_hospital_id, vehicle_id, driver_id, container_id,
      status, current_step, risk_score, risk_reasons, eta_minutes, distance_km, planned_route, dispatched_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'shp-vc1020',
      'VC1020',
      'wh-chn-01',
      'hsp-apollo-greams',
      'veh-01',
      'usr-driver',
      'cnt-c002',
      'IN_TRANSIT',
      'GPS_TRACKING',
      28.0,
      JSON.stringify(['Heavy traffic on Mount Road', 'Slightly elevated container temp 5.1°C']),
      25,
      12.0,
      routeWaypoints,
      new Date(Date.now() - 3600000).toISOString()
    ]
  );

  execute(
    `INSERT INTO shipment_items (id, shipment_id, vaccine_id, batch_id, quantity_requested, quantity_picked, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['item-vc1020-1', 'shp-vc1020', 'vac-covaxin', 'btc-cov-002', 100, 100, 'LOADED']
  );

  // Link container C002 vaccines
  execute(
    `INSERT INTO container_vaccines (id, container_id, batch_id, quantity)
     VALUES (?, ?, ?, ?)`,
    ['cv-001', 'cnt-c002', 'btc-cov-002', 100]
  );

  // Shipment 3: VC1018 - Completed Delivery with Proofs
  const deliveredTimestamp = new Date(Date.now() - 86400000).toISOString();
  execute(
    `INSERT INTO shipments (
      id, shipment_number, origin_warehouse_id, destination_hospital_id, vehicle_id, driver_id, container_id,
      status, current_step, risk_score, risk_reasons, eta_minutes, distance_km, planned_route, dispatched_at, delivered_at, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'shp-vc1018',
      'VC1018',
      'wh-chn-01',
      'hsp-apollo-greams',
      'veh-01',
      'usr-driver',
      'cnt-c005',
      'COMPLETED',
      'COMPLETED',
      4.2,
      JSON.stringify(['Delivered in compliance']),
      0,
      14.2,
      routeWaypoints,
      new Date(Date.now() - 90000000).toISOString(),
      deliveredTimestamp,
      deliveredTimestamp
    ]
  );

  // Delivery confirmation record for VC1018
  execute(
    `INSERT INTO delivery_confirmations (
      id, shipment_id, receiver_name, receiver_phone, receiver_signature_url, otp_code, otp_verified,
      gps_latitude, gps_longitude, distance_from_hospital_meters, confirmed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      'dlv-vc1018',
      'shp-vc1018',
      'Dr. Vimala Nathan',
      '+91 98406 12345',
      'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60"><text x="10" y="40" font-family="cursive" font-size="28" fill="%232563eb">V. Nathan</text></svg>',
      '849201',
      1,
      13.0566,
      80.2521,
      15.2,
      deliveredTimestamp
    ]
  );

  // 12. TELEMETRY LOGS (Recent history for charts)
  const now = Date.now();
  for (let i = 20; i >= 0; i--) {
    const time = new Date(now - i * 60000).toISOString();
    // Container C015 (Healthy 4.4 - 4.7 C)
    execute(
      `INSERT INTO temperature_logs (id, entity_type, entity_id, temperature, humidity, door_open, power_mode, battery_pct, is_redundant, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(), 'CONTAINER', 'cnt-c015',
        Number((4.5 + Math.sin(i * 0.4) * 0.3).toFixed(2)),
        Number((48.0 + Math.cos(i * 0.3) * 2.0).toFixed(1)),
        0, 'MAINS_POWER', 92, 0, time
      ]
    );

    // Container C002 (In transit, minor fluctuation 5.0 - 5.3 C)
    execute(
      `INSERT INTO temperature_logs (id, entity_type, entity_id, temperature, humidity, door_open, power_mode, battery_pct, is_redundant, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(), 'CONTAINER', 'cnt-c002',
        Number((5.0 + Math.sin(i * 0.5) * 0.4).toFixed(2)),
        Number((52.0 + Math.cos(i * 0.2) * 1.5).toFixed(1)),
        0, 'BATTERY', 88, 0, time
      ]
    );

    // Warehouse Cold Room A
    execute(
      `INSERT INTO temperature_logs (id, entity_type, entity_id, temperature, humidity, door_open, power_mode, battery_pct, is_redundant, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(), 'WAREHOUSE_ROOM', 'loc-chn-cra-r01-s01',
        Number((4.2 + Math.cos(i * 0.3) * 0.2).toFixed(2)),
        50.0, 0, 'MAINS_POWER', 100, 0, time
      ]
    );
  }

  // 13. SAMPLE ALERTS & ACTIONS
  // Alert 1: Active Warning on Container C007
  const alert1Id = 'alt-cnt007-batt';
  execute(
    `INSERT INTO alerts (
      id, alert_code, alert_type, severity, entity_type, entity_id, title, message, current_reading,
      sop_id, status, assigned_user_id, assigned_role, escalation_level, sla_deadline
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      alert1Id,
      'ALT-2026-001',
      'LOW_BATTERY',
      'WARNING',
      'CONTAINER',
      'cnt-c007',
      'Container C007 Low Battery (38%)',
      'Container C007 battery is below safe operational threshold (40%). Reconnect to AC mains immediately.',
      'Battery: 38%, Temp: 6.8°C',
      'sop-power-cut',
      'ASSIGNED',
      'usr-warehouse',
      'Warehouse Employee',
      1,
      new Date(now + 1800000).toISOString()
    ]
  );

  // 14. INITIAL AUDIT LEDGER INITIATION
  logAuditEvent({
    userId: 'usr-admin',
    userRole: 'Admin',
    action: 'SYSTEM_GENESIS_INITIALIZED',
    entityType: 'SYSTEM',
    entityId: 'GENESIS',
    details: { version: '1.0.0', seedTime: new Date().toISOString(), platform: 'Smart Cold-Chain Platform' }
  });

  logAuditEvent({
    userId: 'usr-admin',
    userRole: 'Admin',
    action: 'VACCINE_CATALOG_REGISTERED',
    entityType: 'VACCINE',
    entityId: 'CATALOG-INITIAL',
    details: { totalVaccines: vaccines.length, freezeSensitiveCount: 5 }
  });

  logAuditEvent({
    userId: 'usr-admin',
    userRole: 'Admin',
    action: 'WAREHOUSE_HIERARCHY_CONFIGURED',
    entityType: 'WAREHOUSE',
    entityId: 'wh-chn-01',
    details: { warehouse: 'Chennai Central State Vaccine Depot', coldRooms: 4 }
  });

  logAuditEvent({
    userId: 'usr-warehouse',
    userRole: 'Warehouse Employee',
    action: 'SHIPMENT_ORDER_CREATED',
    entityType: 'SHIPMENT',
    entityId: 'shp-vc1024',
    details: { shipmentNumber: 'VC1024', requiredContainer: 'C015', destination: 'Apollo Main Hospital' }
  });

  console.log('--- Database Seeding Completed Successfully ---');
  return true;
}

// If run directly from CLI
if (process.argv[1]?.endsWith('seed.js')) {
  seedDatabase().then(() => {
    console.log('Seed execution finished.');
    process.exit(0);
  }).catch((err) => {
    console.error('Seed error:', err);
    process.exit(1);
  });
}
