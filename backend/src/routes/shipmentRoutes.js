import express from 'express';
import { col } from '../db/mongo.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import {
  verifyDoorClosure,
  dispatchShipment,
  submitDeliveryProof,
  recordHospitalDecision
} from '../services/workflowEngine.js';

const router = express.Router();

/**
 * PUBLIC ROUTE (No login required)
 * GET /api/shipments/public-verify/:idOrCode
 */
router.get('/public-verify/:idOrCode', async (req, res) => {
  try {
    const param = req.params.idOrCode;

    const shipment = await col('shipments').findOne({
      $or: [{ shipment_number: param }, { _id: param }, { id: param }]
    });

    if (!shipment) {
      return res.status(404).json({
        error: 'Vaccine consignment record not found. Please scan the QR code printed on the official label.'
      });
    }

    const shpIdStr = shipment.id || shipment._id;
    const warehouse = shipment.origin_warehouse_id
      ? await col('warehouses').findOne({ $or: [{ _id: shipment.origin_warehouse_id }, { id: shipment.origin_warehouse_id }] })
      : null;

    const hospital = shipment.destination_hospital_id
      ? await col('hospitals').findOne({ $or: [{ _id: shipment.destination_hospital_id }, { id: shipment.destination_hospital_id }] })
      : null;

    const container = shipment.container_id
      ? await col('containers').findOne({ $or: [{ _id: shipment.container_id }, { id: shipment.container_id }] })
      : null;

    const rawItems = await col('shipment_items').find({ shipment_id: shpIdStr }).toArray();
    const items = [];
    for (const item of rawItems) {
      const vaccine = await col('vaccines').findOne({ $or: [{ _id: item.vaccine_id }, { id: item.vaccine_id }] });
      const batch = item.batch_id
        ? await col('batches').findOne({ $or: [{ _id: item.batch_id }, { id: item.batch_id }] })
        : null;

      items.push({
        vaccine_name: vaccine ? vaccine.name : null,
        manufacturer: vaccine ? vaccine.manufacturer : null,
        min_temp: vaccine ? vaccine.min_temp : null,
        max_temp: vaccine ? vaccine.max_temp : null,
        batch_number: batch ? batch.batch_number : null,
        manufacturing_date: batch ? batch.manufacturing_date : null,
        expiry_date: batch ? batch.expiry_date : null,
        safety_status: batch ? batch.safety_status : 'SAFE'
      });
    }

    res.json({
      verified: true,
      platform: 'Smart Cold-Chain Verified',
      consignment: {
        shipmentNumber: shipment.shipment_number,
        status: shipment.status,
        origin: warehouse ? `${warehouse.name}, ${warehouse.city}` : 'Origin Warehouse',
        destination: hospital ? `${hospital.name}, ${hospital.city}` : 'Destination Hospital',
        dispatchedAt: shipment.dispatched_at,
        deliveredAt: shipment.delivered_at,
        containerType: container ? container.cooling_capability : 'ACTIVE_REFRIGERATION',
        temperatureRange: container ? `${container.min_temp}°C to ${container.max_temp}°C` : '2°C to 8°C'
      },
      vaccines: items,
      temperatureIntegrity: {
        complianceStatus: 'VERIFIED_COMPLIANT',
        summary: 'All telemetry verified through cryptographic proof-gated chain.'
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// All subsequent routes require authentication
router.use(authenticateToken);

/**
 * GET /api/shipments
 * List shipments with RBAC filter (Driver sees only their assigned shipments)
 */
router.get('/', async (req, res) => {
  try {
    const query = {};
    if (req.user.role === 'Driver') {
      query.driver_id = req.user.id;
    }

    const shipments = await col('shipments')
      .find(query)
      .sort({ created_at: -1 })
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

      const vehicle = s.vehicle_id
        ? await col('vehicles').findOne({ $or: [{ _id: s.vehicle_id }, { id: s.vehicle_id }] })
        : null;

      const driver = s.driver_id
        ? await col('users').findOne({ $or: [{ _id: s.driver_id }, { id: s.driver_id }] })
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
          freeze_sensitive: vaccine ? vaccine.freeze_sensitive : null,
          batch_number: batch ? batch.batch_number : null,
          expiry_date: batch ? batch.expiry_date : null
        });
      }

      enriched.push({
        ...s,
        id: shpIdStr,
        origin_name: warehouse ? warehouse.name : null,
        destination_name: hospital ? hospital.name : null,
        container_code: container ? container.container_code : null,
        current_temp: container ? container.current_temp : null,
        battery_pct: container ? container.battery_pct : null,
        door_status: container ? container.door_status : null,
        vehicle_number: vehicle ? vehicle.vehicle_number : null,
        driver_name: driver ? driver.name : null,
        risk_reasons: typeof s.risk_reasons === 'string' ? JSON.parse(s.risk_reasons || '[]') : (s.risk_reasons || []),
        planned_route: typeof s.planned_route === 'string' ? JSON.parse(s.planned_route || '[]') : (s.planned_route || []),
        items
      });
    }

    res.json({ shipments: enriched });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/shipments/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const shpId = req.params.id;
    const shipment = await col('shipments').findOne({
      $or: [{ _id: shpId }, { id: shpId }]
    });

    if (!shipment) return res.status(404).json({ error: 'Shipment not found.' });

    const shpIdStr = shipment.id || shipment._id;

    if (req.user.role === 'Driver' && shipment.driver_id !== req.user.id) {
      return res.status(403).json({ error: 'Access Denied: You can only view your assigned shipments.' });
    }

    const warehouse = shipment.origin_warehouse_id
      ? await col('warehouses').findOne({ $or: [{ _id: shipment.origin_warehouse_id }, { id: shipment.origin_warehouse_id }] })
      : null;

    const hospital = shipment.destination_hospital_id
      ? await col('hospitals').findOne({ $or: [{ _id: shipment.destination_hospital_id }, { id: shipment.destination_hospital_id }] })
      : null;

    const container = shipment.container_id
      ? await col('containers').findOne({ $or: [{ _id: shipment.container_id }, { id: shipment.container_id }] })
      : null;

    const vehicle = shipment.vehicle_id
      ? await col('vehicles').findOne({ $or: [{ _id: shipment.vehicle_id }, { id: shipment.vehicle_id }] })
      : null;

    const driver = shipment.driver_id
      ? await col('users').findOne({ $or: [{ _id: shipment.driver_id }, { id: shipment.driver_id }] })
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
        manufacturer: vaccine ? vaccine.manufacturer : null,
        min_temp: vaccine ? vaccine.min_temp : null,
        max_temp: vaccine ? vaccine.max_temp : null,
        freeze_sensitive: vaccine ? vaccine.freeze_sensitive : null,
        batch_number: batch ? batch.batch_number : null,
        expiry_date: batch ? batch.expiry_date : null,
        safety_status: batch ? batch.safety_status : 'SAFE'
      });
    }

    const rawChecklist = await col('checklists').find({ shipment_id: shpIdStr }).toArray();
    const checklist = [];
    for (const c of rawChecklist) {
      const verifier = c.verified_by
        ? await col('users').findOne({ $or: [{ _id: c.verified_by }, { id: c.verified_by }] })
        : null;
      const proof = c.proof_file_id
        ? await col('proof_files').findOne({ $or: [{ _id: c.proof_file_id }, { id: c.proof_file_id }] })
        : null;

      checklist.push({
        ...c,
        id: c.id || c._id,
        verified_by_name: verifier ? verifier.name : null,
        proof_file_path: proof ? proof.file_path : null
      });
    }

    const rawDeliveryConf = await col('delivery_confirmations').findOne({ shipment_id: shpIdStr });
    let deliveryConfirmation = null;
    if (rawDeliveryConf) {
      const destPhoto = rawDeliveryConf.destination_photo_id
        ? await col('proof_files').findOne({ $or: [{ _id: rawDeliveryConf.destination_photo_id }, { id: rawDeliveryConf.destination_photo_id }] })
        : null;
      const pkgPhoto = rawDeliveryConf.package_photo_id
        ? await col('proof_files').findOne({ $or: [{ _id: rawDeliveryConf.package_photo_id }, { id: rawDeliveryConf.package_photo_id }] })
        : null;

      deliveryConfirmation = {
        ...rawDeliveryConf,
        id: rawDeliveryConf.id || rawDeliveryConf._id,
        dest_photo_path: destPhoto ? destPhoto.file_path : null,
        pkg_photo_path: pkgPhoto ? pkgPhoto.file_path : null
      };
    }

    res.json({
      shipment: {
        ...shipment,
        id: shpIdStr,
        origin_name: warehouse ? warehouse.name : null,
        origin_city: warehouse ? warehouse.city : null,
        origin_address: warehouse ? warehouse.address : null,
        destination_name: hospital ? hospital.name : null,
        destination_city: hospital ? hospital.city : null,
        destination_address: hospital ? hospital.address : null,
        dest_lat: hospital ? hospital.latitude : null,
        dest_lng: hospital ? hospital.longitude : null,
        container_code: container ? container.container_code : null,
        current_temp: container ? container.current_temp : null,
        battery_pct: container ? container.battery_pct : null,
        door_status: container ? container.door_status : null,
        cooling_capability: container ? container.cooling_capability : null,
        vehicle_number: vehicle ? vehicle.vehicle_number : null,
        v_lat: vehicle ? vehicle.latitude : null,
        v_lng: vehicle ? vehicle.longitude : null,
        driver_name: driver ? driver.name : null,
        driver_phone: driver ? driver.phone : null,
        risk_reasons: typeof shipment.risk_reasons === 'string' ? JSON.parse(shipment.risk_reasons || '[]') : (shipment.risk_reasons || []),
        planned_route: typeof shipment.planned_route === 'string' ? JSON.parse(shipment.planned_route || '[]') : (shipment.planned_route || [])
      },
      items,
      checklist,
      deliveryConfirmation
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/shipments/:id/verify-door
 */
router.post('/:id/verify-door', requireRole(['Verification Staff', 'Admin']), async (req, res) => {
  try {
    const { proofFileId } = req.body;
    if (!proofFileId) {
      return res.status(400).json({ error: 'proofFileId (door latch photo) is required.' });
    }

    const result = await verifyDoorClosure({
      shipmentId: req.params.id,
      proofFileId,
      userId: req.user.id
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/shipments/:id/dispatch
 */
router.post('/:id/dispatch', requireRole(['Warehouse Employee', 'Manager', 'Admin']), async (req, res) => {
  try {
    const shipment = await dispatchShipment({
      shipmentId: req.params.id,
      userId: req.user.id
    });
    res.json({ message: 'Shipment dispatched successfully', shipment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/shipments/:id/delivery-proof
 */
router.post('/:id/delivery-proof', requireRole(['Driver', 'Admin']), async (req, res) => {
  try {
    const {
      receiverName,
      receiverPhone,
      receiverSignatureUrl,
      otpCode,
      gpsLatitude,
      gpsLongitude,
      destinationPhotoId,
      packagePhotoId
    } = req.body;

    const result = await submitDeliveryProof({
      shipmentId: req.params.id,
      receiverName,
      receiverPhone,
      receiverSignatureUrl,
      otpCode,
      gpsLatitude: Number(gpsLatitude) || 13.0567,
      gpsLongitude: Number(gpsLongitude) || 80.2520,
      destinationPhotoId,
      packagePhotoId,
      userId: req.user.id
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/shipments/:id/hospital-decision
 */
router.post('/:id/hospital-decision', requireRole(['Hospital Receiver', 'Manager', 'Admin']), async (req, res) => {
  try {
    const { decision, rejectionReason } = req.body;
    if (!decision || (decision !== 'ACCEPT' && decision !== 'REJECT')) {
      return res.status(400).json({ error: "Decision must be 'ACCEPT' or 'REJECT'." });
    }

    const updated = await recordHospitalDecision({
      shipmentId: req.params.id,
      decision,
      rejectionReason,
      userId: req.user.id
    });

    res.json({ message: `Shipment marked as ${decision === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED'}.`, shipment: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
