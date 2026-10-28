import express from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { col } from '../db/mongo.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { logAuditEvent } from '../services/auditHashChain.js';

const router = express.Router();
router.use(authenticateToken);

/**
 * GET /api/admin/users
 */
router.get('/users', requireRole(['Admin', 'Manager', 'Auditor']), async (req, res) => {
  try {
    const users = await col('users')
      .find({ deleted_at: { $exists: false } })
      .sort({ created_at: -1 })
      .toArray();

    const enriched = [];
    for (const u of users) {
      const warehouse = u.warehouse_id
        ? await col('warehouses').findOne({ $or: [{ _id: u.warehouse_id }, { id: u.warehouse_id }] })
        : null;

      enriched.push({
        ...u,
        id: u.id || u._id,
        warehouse_name: warehouse ? warehouse.name : null
      });
    }

    res.json({ users: enriched });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/users - Create User
 */
router.post('/users', requireRole(['Admin']), async (req, res) => {
  try {
    const { employee_id, name, email, password, role, warehouse_id, responsibilities, phone } = req.body;
    if (!employee_id || !name || !email || !role) {
      return res.status(400).json({ error: 'Missing required user fields.' });
    }

    const passwordHash = await bcrypt.hash(password || 'password123', 10);
    const id = `usr-${crypto.randomUUID().slice(0, 8)}`;
    const nowStr = new Date().toISOString();

    const userDoc = {
      _id: id,
      id,
      employee_id,
      name,
      email,
      password_hash: passwordHash,
      role,
      warehouse_id: warehouse_id || null,
      responsibilities: responsibilities || null,
      phone: phone || null,
      is_active: 1,
      created_at: nowStr,
      updated_at: nowStr
    };

    await col('users').insertOne(userDoc);

    await logAuditEvent({
      userId: req.user.id,
      userRole: req.user.role,
      action: 'ADMIN_CREATE_USER',
      entityType: 'USER',
      entityId: id,
      details: { employee_id, name, email, role }
    });

    res.status(201).json({ message: 'User created successfully', id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/admin/users/:id/status - Toggle Activate/Deactivate
 */
router.put('/users/:id/status', requireRole(['Admin']), async (req, res) => {
  try {
    const { isActive } = req.body;
    await col('users').updateOne(
      { $or: [{ _id: req.params.id }, { id: req.params.id }] },
      { $set: { is_active: isActive ? 1 : 0, updated_at: new Date().toISOString() } }
    );

    await logAuditEvent({
      userId: req.user.id,
      userRole: req.user.role,
      action: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
      entityType: 'USER',
      entityId: req.params.id,
      details: { isActive }
    });

    res.json({ message: `User status updated to ${isActive ? 'active' : 'inactive'}.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/vaccines - Vaccine Master
 */
router.get('/vaccines', async (req, res) => {
  try {
    const vaccines = await col('vaccines').find({}).sort({ name: 1 }).toArray();
    const formatted = vaccines.map(v => ({ ...v, id: v.id || v._id }));
    res.json({ vaccines: formatted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/vaccines - Create Vaccine
 */
router.post('/vaccines', requireRole(['Admin']), async (req, res) => {
  try {
    const {
      vaccine_code, name, manufacturer, min_temp, max_temp,
      freeze_sensitive, storage_instructions, compatible_container_types, vvm_type
    } = req.body;

    const id = `vac-${crypto.randomUUID().slice(0, 8)}`;
    const nowStr = new Date().toISOString();

    const vaccineDoc = {
      _id: id,
      id,
      vaccine_code,
      name,
      manufacturer,
      min_temp,
      max_temp,
      freeze_sensitive: freeze_sensitive ? 1 : 0,
      storage_instructions,
      compatible_container_types: Array.isArray(compatible_container_types)
        ? compatible_container_types
        : JSON.stringify(compatible_container_types || []),
      vvm_type: vvm_type || 'VVM30',
      is_active: 1,
      created_at: nowStr
    };

    await col('vaccines').insertOne(vaccineDoc);

    await logAuditEvent({
      userId: req.user.id,
      userRole: req.user.role,
      action: 'ADMIN_CREATE_VACCINE',
      entityType: 'VACCINE',
      entityId: id,
      details: { vaccine_code, name, min_temp, max_temp, freeze_sensitive }
    });

    res.status(201).json({ message: 'Vaccine registered', id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/containers - Container Master
 */
router.get('/containers', async (req, res) => {
  try {
    const containers = await col('containers').find({}).sort({ container_code: 1 }).toArray();

    const enriched = [];
    for (const c of containers) {
      const loc = c.current_location_id
        ? await col('storage_locations').findOne({ $or: [{ _id: c.current_location_id }, { id: c.current_location_id }] })
        : null;

      const vehicle = c.current_vehicle_id
        ? await col('vehicles').findOne({ $or: [{ _id: c.current_vehicle_id }, { id: c.current_vehicle_id }] })
        : null;

      const shipment = c.current_shipment_id
        ? await col('shipments').findOne({ $or: [{ _id: c.current_shipment_id }, { id: c.current_shipment_id }] })
        : null;

      enriched.push({
        ...c,
        id: c.id || c._id,
        location_code: loc ? loc.code : null,
        cold_room: loc ? loc.cold_room : null,
        rack: loc ? loc.rack : null,
        slot: loc ? loc.slot : null,
        vehicle_number: vehicle ? vehicle.vehicle_number : null,
        shipment_number: shipment ? shipment.shipment_number : null
      });
    }

    res.json({ containers: enriched });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/locations - Warehouse Locations Hierarchy
 */
router.get('/locations', async (req, res) => {
  try {
    const warehouses = await col('warehouses').find({}).sort({ name: 1 }).toArray();
    const locations = await col('storage_locations').find({}).sort({ code: 1 }).toArray();

    const enrichedLocs = [];
    for (const l of locations) {
      const wh = warehouses.find(w => w._id === l.warehouse_id || w.id === l.warehouse_id);
      enrichedLocs.push({
        ...l,
        id: l.id || l._id,
        warehouse_name: wh ? wh.name : 'Unknown Warehouse'
      });
    }

    const formattedWhs = warehouses.map(w => ({ ...w, id: w.id || w._id }));
    res.json({ warehouses: formattedWhs, locations: enrichedLocs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/sops - SOP Library
 */
router.get('/sops', async (req, res) => {
  try {
    const sops = await col('sop_library').find({}).sort({ alert_type: 1 }).toArray();
    const formatted = sops.map(s => ({
      ...s,
      id: s.id || s._id,
      instructions: Array.isArray(s.step_by_step_instructions)
        ? s.step_by_step_instructions
        : JSON.parse(s.step_by_step_instructions || '[]')
    }));
    res.json({ sops: formatted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/vehicles - Fleet Master
 */
router.get('/vehicles', async (req, res) => {
  try {
    const vehicles = await col('vehicles').find({}).sort({ vehicle_number: 1 }).toArray();

    const enriched = [];
    for (const v of vehicles) {
      const driver = v.driver_id
        ? await col('users').findOne({ $or: [{ _id: v.driver_id }, { id: v.driver_id }] })
        : null;

      enriched.push({
        ...v,
        id: v.id || v._id,
        driver_name: driver ? driver.name : null,
        driver_phone: driver ? driver.phone : null
      });
    }

    res.json({ vehicles: enriched });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
