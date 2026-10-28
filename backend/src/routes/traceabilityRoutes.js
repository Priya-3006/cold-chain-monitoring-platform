import express from 'express';
import { col } from '../db/mongo.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { verifyAuditIntegrity } from '../services/auditHashChain.js';
import { calculateMKT, calculateExcursionStats } from '../services/safetyAnalytics.js';

const router = express.Router();
router.use(authenticateToken);

/**
 * GET /api/traceability/audit-logs
 * Retrieves immutable cryptographic audit log chain
 */
router.get('/audit-logs', async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const logs = await col('audit_logs')
      .find({})
      .sort({ sequence_number: -1 })
      .limit(Number(limit))
      .toArray();

    const parsed = logs.map(l => ({
      ...l,
      details: l.details_json
        ? (typeof l.details_json === 'string' ? JSON.parse(l.details_json) : l.details_json)
        : (l.details || {})
    }));

    res.json({ logs: parsed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/traceability/verify-integrity
 * Verifies SHA-256 hash pointers across entire audit chain
 */
router.get('/verify-integrity', async (req, res) => {
  try {
    const verificationResult = await verifyAuditIntegrity();
    res.json(verificationResult);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/traceability/recall/:batchNumber
 * Batch Recall Management: Maps batch -> containers, locations, vehicles, shipments, hospitals
 */
router.get('/recall/:batchNumber', async (req, res) => {
  try {
    const batchNum = req.params.batchNumber.trim();
    const batch = await col('batches').findOne({ batch_number: batchNum });

    if (!batch) {
      return res.status(404).json({ error: `Batch '${batchNum}' not found in registry.` });
    }

    const vaccine = await col('vaccines').findOne({ $or: [{ _id: batch.vaccine_id }, { id: batch.vaccine_id }] });
    const batchCombined = {
      ...batch,
      vaccine_name: vaccine ? vaccine.name : null,
      vaccine_code: vaccine ? vaccine.vaccine_code : null,
      manufacturer: vaccine ? vaccine.manufacturer : null,
      min_temp: vaccine ? vaccine.min_temp : null,
      max_temp: vaccine ? vaccine.max_temp : null,
      freeze_sensitive: vaccine ? vaccine.freeze_sensitive : null
    };

    const batchIdStr = batch.id || batch._id;
    const containerVaccines = await col('container_vaccines').find({ batch_id: batchIdStr }).toArray();

    const containers = await Promise.all(containerVaccines.map(async (cv) => {
      const c = await col('containers').findOne({ $or: [{ _id: cv.container_id }, { id: cv.container_id }] }) || {};
      let sl = null;
      let w = null;
      if (c.current_location_id) {
        sl = await col('storage_locations').findOne({ $or: [{ _id: c.current_location_id }, { id: c.current_location_id }] });
        if (sl && sl.warehouse_id) {
          w = await col('warehouses').findOne({ $or: [{ _id: sl.warehouse_id }, { id: sl.warehouse_id }] });
        }
      }
      return {
        ...c,
        quantity: cv.quantity,
        loaded_at: cv.loaded_at,
        unloaded_at: cv.unloaded_at,
        location_code: sl ? sl.code : null,
        cold_room: sl ? sl.cold_room : null,
        rack: sl ? sl.rack : null,
        slot: sl ? sl.slot : null,
        warehouse_name: w ? w.name : null
      };
    }));

    const items = await col('shipment_items').find({ batch_id: batchIdStr }).toArray();
    const shipments = await Promise.all(items.map(async (si) => {
      const s = await col('shipments').findOne({ $or: [{ _id: si.shipment_id }, { id: si.shipment_id }] }) || {};
      const w = s.origin_warehouse_id ? await col('warehouses').findOne({ $or: [{ _id: s.origin_warehouse_id }, { id: s.origin_warehouse_id }] }) : null;
      const h = s.destination_hospital_id ? await col('hospitals').findOne({ $or: [{ _id: s.destination_hospital_id }, { id: s.destination_hospital_id }] }) : null;
      const vh = s.vehicle_id ? await col('vehicles').findOne({ $or: [{ _id: s.vehicle_id }, { id: s.vehicle_id }] }) : null;
      const u = s.driver_id ? await col('users').findOne({ $or: [{ _id: s.driver_id }, { id: s.driver_id }] }) : null;

      return {
        ...s,
        quantity_requested: si.quantity_requested,
        quantity_picked: si.quantity_picked,
        origin_warehouse: w ? w.name : null,
        destination_hospital: h ? h.name : null,
        hospital_address: h ? h.address : null,
        hospital_contact: h ? h.contact_person : null,
        hospital_phone: h ? h.contact_phone : null,
        vehicle_number: vh ? vh.vehicle_number : null,
        driver_name: u ? u.name : null,
        driver_phone: u ? u.phone : null
      };
    }));

    const affectedHospitalsMap = {};
    for (const s of shipments) {
      if (s.destination_hospital_id && !affectedHospitalsMap[s.destination_hospital_id]) {
        affectedHospitalsMap[s.destination_hospital_id] = {
          hospitalName: s.destination_hospital,
          address: s.hospital_address,
          contactPerson: s.hospital_contact,
          contactPhone: s.hospital_phone,
          shipmentNumber: s.shipment_number,
          shipmentStatus: s.status,
          quantity: s.quantity_picked
        };
      }
    }

    res.json({
      batch: batchCombined,
      recalledAt: new Date().toISOString(),
      totalVialsDistributed: shipments.reduce((sum, s) => sum + (s.quantity_picked || 0), 0),
      totalVialsInDepot: containers.reduce((sum, c) => sum + (c.quantity || 0), 0),
      affectedContainers: containers,
      affectedShipments: shipments,
      affectedHospitals: Object.values(affectedHospitalsMap)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/traceability/compliance-report/:shipmentId
 * Per-shipment WHO/CDSCO aligned compliance report
 */
router.get('/compliance-report/:shipmentId', async (req, res) => {
  try {
    const shipId = req.params.shipmentId;
    const rawShipment = await col('shipments').findOne({ $or: [{ _id: shipId }, { id: shipId }] });
    if (!rawShipment) return res.status(404).json({ error: 'Shipment not found.' });

    const w = rawShipment.origin_warehouse_id ? await col('warehouses').findOne({ $or: [{ _id: rawShipment.origin_warehouse_id }, { id: rawShipment.origin_warehouse_id }] }) : null;
    const h = rawShipment.destination_hospital_id ? await col('hospitals').findOne({ $or: [{ _id: rawShipment.destination_hospital_id }, { id: rawShipment.destination_hospital_id }] }) : null;
    const c = rawShipment.container_id ? await col('containers').findOne({ $or: [{ _id: rawShipment.container_id }, { id: rawShipment.container_id }] }) : null;
    const v = rawShipment.vehicle_id ? await col('vehicles').findOne({ $or: [{ _id: rawShipment.vehicle_id }, { id: rawShipment.vehicle_id }] }) : null;
    const u = rawShipment.driver_id ? await col('users').findOne({ $or: [{ _id: rawShipment.driver_id }, { id: rawShipment.driver_id }] }) : null;

    const shipment = {
      ...rawShipment,
      origin_name: w ? w.name : null,
      origin_city: w ? w.city : null,
      destination_name: h ? h.name : null,
      destination_city: h ? h.city : null,
      container_code: c ? c.container_code : null,
      container_type: c ? c.container_type : null,
      cooling_capability: c ? c.cooling_capability : null,
      vehicle_number: v ? v.vehicle_number : null,
      driver_name: u ? u.name : null
    };

    const currentShipmentIdStr = rawShipment.id || rawShipment._id;
    const rawItems = await col('shipment_items').find({ shipment_id: currentShipmentIdStr }).toArray();
    const items = await Promise.all(rawItems.map(async (si) => {
      const vac = si.vaccine_id ? await col('vaccines').findOne({ $or: [{ _id: si.vaccine_id }, { id: si.vaccine_id }] }) : null;
      const bat = si.batch_id ? await col('batches').findOne({ $or: [{ _id: si.batch_id }, { id: si.batch_id }] }) : null;
      return {
        ...si,
        vaccine_name: vac ? vac.name : null,
        min_temp: vac ? vac.min_temp : null,
        max_temp: vac ? vac.max_temp : null,
        freeze_sensitive: vac ? vac.freeze_sensitive : null,
        batch_number: bat ? bat.batch_number : null,
        expiry_date: bat ? bat.expiry_date : null,
        mkt_cached: bat ? bat.mkt_cached : null,
        safety_status: bat ? bat.safety_status : null
      };
    }));

    const telemetry = await col('temperature_logs')
      .find({ entity_id: rawShipment.container_id })
      .sort({ timestamp: 1 })
      .toArray();

    const temps = telemetry.map(t => t.temperature);
    const mkt = calculateMKT(temps);
    const excursionStats = calculateExcursionStats(telemetry, 2.0, 8.0);

    const checklist = await col('checklists').find({ shipment_id: currentShipmentIdStr }).toArray();
    const deliveryConf = await col('delivery_confirmations').findOne({ shipment_id: currentShipmentIdStr });
    const scanErrors = await col('scan_events').find({
      $or: [
        { entity_id: currentShipmentIdStr },
        { message: new RegExp(rawShipment.shipment_number, 'i') }
      ]
    }).toArray();
    const alerts = await col('alerts').find({ shipment_id: currentShipmentIdStr }).toArray();

    const isCompliant = excursionStats.outOfRangeSeconds <= 1800 && alerts.length === 0;
    const complianceScore = Math.max(0, 100 - (excursionStats.outOfRangeSeconds / 60) * 0.5 - alerts.length * 5);

    res.json({
      regulatoryFramework: 'Aligned with WHO Good Distribution Practices (GDP) & CDSCO Guidelines (Prototype Evaluation)',
      reportGeneratedAt: new Date().toISOString(),
      shipmentDetails: shipment,
      vaccinesCarried: items,
      temperatureProfile: {
        totalReadings: telemetry.length,
        meanKineticTemperature: mkt,
        minTempRecorded: temps.length > 0 ? Math.min(...temps) : 4.0,
        maxTempRecorded: temps.length > 0 ? Math.max(...temps) : 5.0,
        outOfRangeSeconds: excursionStats.outOfRangeSeconds,
        outOfRangeMinutes: Math.round(excursionStats.outOfRangeSeconds / 60),
        excursionEvents: excursionStats.excursions
      },
      qualityAudit: {
        complianceScore: Number(complianceScore.toFixed(1)),
        complianceGrade: complianceScore >= 95 ? 'GRADE_A_OPTIMAL' : complianceScore >= 80 ? 'GRADE_B_ACCEPTABLE' : 'GRADE_C_EXCURSION',
        checklistPassedCount: checklist.filter(c => c.passed === 1).length,
        checklistTotalCount: checklist.length,
        doorClosureVerified: checklist.some(c => c.item_key === 'door_closed' && c.passed === 1),
        deliveryProofCompleted: Boolean(deliveryConf),
        scanExceptionsCount: scanErrors.length,
        alertsCount: alerts.length
      },
      telemetryHistory: telemetry
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
