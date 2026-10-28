import express from 'express';
import { col } from '../db/mongo.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import {
  scanVaccineBarcode,
  validateContainerScan,
  verifyLocationPutAway,
  updateChecklistItem
} from '../services/workflowEngine.js';

const router = express.Router();
router.use(authenticateToken);

/**
 * GET /api/warehouse/tasks
 * Returns shipments awaiting picking or warehouse processing
 */
router.get('/tasks', requireRole(['Warehouse Employee', 'Manager', 'Admin']), async (req, res) => {
  try {
    const shipments = await col('shipments')
     .find({ status: { $in: ['CREATED', 'PICKED', 'PUT_AWAY', 'LOADED', 'COMPLETED', 'GPS_TRACKING', 'IN_TRANSIT'] } })
      .sort({ created_at: 1 })
      .toArray();

    const enriched = [];
    for (const s of shipments) {
      const shpIdStr = s.id || s._id;
      const warehouse = s.origin_warehouse_id
        ? await col('warehouses').findOne({ $or: [{ _id: s.origin_warehouse_id }, { id: s.origin_warehouse_id }] })
        : null;

      const hospital = s.destination_hospital_id
        ? await col('hospitals').findOne({ $or: [{ _id: s.destination_hospital_id }, { id: s.destination_hospital_id }] })
        : null;

      const container = s.container_id
        ? await col('containers').findOne({ $or: [{ _id: s.container_id }, { id: s.container_id }] })
        : null;

      const rawItems = await col('shipment_items').find({ shipment_id: shpIdStr }).toArray();
      const items = [];
      for (const item of rawItems) {
        const vaccine = await col('vaccines').findOne({ $or: [{ _id: item.vaccine_id }, { id: item.vaccine_id }] });
        const batch = item.batch_id
          ? await col('batches').findOne({ $or: [{ _id: item.batch_id }, { id: item.batch_id }] })
          : null;

        items.push({
          ...item,
          id: item.id || item._id,
          vaccine_name: vaccine ? vaccine.name : null,
          vaccine_code: vaccine ? vaccine.vaccine_code : null,
          min_temp: vaccine ? vaccine.min_temp : null,
          max_temp: vaccine ? vaccine.max_temp : null,
          freeze_sensitive: vaccine ? vaccine.freeze_sensitive : null,
          batch_number: batch ? batch.batch_number : null,
          expiry_date: batch ? batch.expiry_date : null
        });
      }

      const checklist = await col('checklists')
        .find({ shipment_id: shpIdStr })
        .sort({ item_key: 1 })
        .toArray();

      const formattedChecklist = checklist.map(c => ({ ...c, id: c.id || c._id }));

      enriched.push({
        ...s,
        id: shpIdStr,
        warehouse_name: warehouse ? warehouse.name : null,
        destination_name: hospital ? hospital.name : null,
        container_code: container ? container.container_code : null,
        items,
        checklist: formattedChecklist
      });
    }

    res.json({ tasks: enriched });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/warehouse/scan-vaccine
 * Scans vaccine barcode, performs FEFO & expiration checks
 */
router.post('/scan-vaccine', requireRole(['Warehouse Employee', 'Admin']), async (req, res) => {
  try {
    const { shipmentId, scannedCode } = req.body;
    if (!shipmentId || !scannedCode) {
      return res.status(400).json({ error: 'shipmentId and scannedCode are required.' });
    }

    const result = await scanVaccineBarcode({
      shipmentId,
      scannedCode: scannedCode.trim(),
      userId: req.user.id
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/warehouse/scan-container
 * Validates container compatibility and operating temp
 */
router.post('/scan-container', requireRole(['Warehouse Employee', 'Admin']), async (req, res) => {
  try {
    const { shipmentId, scannedCode } = req.body;
    if (!shipmentId || !scannedCode) {
      return res.status(400).json({ error: 'shipmentId and scannedCode are required.' });
    }

    const result = await validateContainerScan({
      shipmentId,
      scannedCode: scannedCode.trim(),
      userId: req.user.id
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/warehouse/put-away
 * Location-verified put-away check
 */
router.post('/put-away', requireRole(['Warehouse Employee', 'Admin']), async (req, res) => {
  try {
    const { shipmentId, scannedLocationCode, expectedLocationId } = req.body;
    if (!shipmentId || !scannedLocationCode || !expectedLocationId) {
      return res.status(400).json({ error: 'Missing shipmentId, scannedLocationCode, or expectedLocationId.' });
    }

    const result = await verifyLocationPutAway({
      shipmentId,
      scannedLocationCode: scannedLocationCode.trim(),
      expectedLocationId,
      userId: req.user.id
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/warehouse/checklist-item
 * Toggles a digital loading checklist item
 */
router.post('/checklist-item', requireRole(['Warehouse Employee', 'Admin']), async (req, res) => {
  try {
    const { shipmentId, itemKey, passed, notes } = req.body;
    const result = await updateChecklistItem({
      shipmentId,
      itemKey,
      passed,
      userId: req.user.id,
      notes
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/warehouse/scan-events
 * Logs of scans, wrong scans, and corrections
 */
router.get('/scan-events', async (req, res) => {
  try {
    const events = await col('scan_events')
      .find({})
      .sort({ timestamp: -1 })
      .limit(50)
      .toArray();

    const enriched = [];
    for (const se of events) {
      const user = await col('users').findOne({ $or: [{ _id: se.user_id }, { id: se.user_id }] });
      enriched.push({
        ...se,
        id: se.id || se._id,
        user_name: user ? user.name : 'System User'
      });
    }

    res.json({ scanEvents: enriched });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/warehouse/container-tree/:containerId
 * Container Content Tracking & Contents Tree
 */
router.get('/container-tree/:containerId', async (req, res) => {
  try {
    const cid = req.params.containerId;
    const container = await col('containers').findOne({
      $or: [{ _id: cid }, { id: cid }, { container_code: cid }]
    });

    if (!container) return res.status(404).json({ error: 'Container not found.' });

    const containerIdStr = container.id || container._id;
    const loc = container.current_location_id
      ? await col('storage_locations').findOne({ $or: [{ _id: container.current_location_id }, { id: container.current_location_id }] })
      : null;

    const vehicle = container.current_vehicle_id
      ? await col('vehicles').findOne({ $or: [{ _id: container.current_vehicle_id }, { id: container.current_vehicle_id }] })
      : null;

    const shipment = container.current_shipment_id
      ? await col('shipments').findOne({ $or: [{ _id: container.current_shipment_id }, { id: container.current_shipment_id }] })
      : null;

    const formattedContainer = {
      ...container,
      id: containerIdStr,
      location_code: loc ? loc.code : null,
      cold_room: loc ? loc.cold_room : null,
      rack: loc ? loc.rack : null,
      slot: loc ? loc.slot : null,
      vehicle_number: vehicle ? vehicle.vehicle_number : null,
      shipment_number: shipment ? shipment.shipment_number : null
    };

    const containerVaccines = await col('container_vaccines')
      .find({ container_id: containerIdStr, unloaded_at: null })
      .toArray();

    const contents = [];
    for (const cv of containerVaccines) {
      const batch = await col('batches').findOne({ $or: [{ _id: cv.batch_id }, { id: cv.batch_id }] });
      const vaccine = batch
        ? await col('vaccines').findOne({ $or: [{ _id: batch.vaccine_id }, { id: batch.vaccine_id }] })
        : null;

      contents.push({
        ...cv,
        id: cv.id || cv._id,
        batch_number: batch ? batch.batch_number : null,
        expiry_date: batch ? batch.expiry_date : null,
        safety_status: batch ? batch.safety_status : null,
        vvm_stage: batch ? batch.vvm_stage : null,
        vaccine_name: vaccine ? vaccine.name : null,
        vaccine_code: vaccine ? vaccine.vaccine_code : null,
        min_temp: vaccine ? vaccine.min_temp : null,
        max_temp: vaccine ? vaccine.max_temp : null,
        freeze_sensitive: vaccine ? vaccine.freeze_sensitive : null
      });
    }

    res.json({ container: formattedContainer, contents });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
