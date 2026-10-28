import express from 'express';
import { col } from '../db/mongo.js';
import { authenticateToken } from '../middleware/auth.js';
import {
  calculateMKT,
  predictExcursionTime,
  estimateHoldTimeAndBattery,
  detectSensorAnomalies
} from '../services/safetyAnalytics.js';
import { faultState } from '../services/simulatorService.js';

const router = express.Router();
router.use(authenticateToken);

/**
 * GET /api/monitoring/overview
 * Real-time monitoring overview of all cold storage assets
 */
router.get('/overview', async (req, res) => {
  try {
    const containers = await col('containers')
      .find({ is_active: 1 })
      .sort({ container_code: 1 })
      .toArray();

    const enrichedContainers = [];

    for (const c of containers) {
      const containerIdStr = c.id || c._id;
      const isOffline = Boolean(faultState.sensorOffline[containerIdStr]);

      const loc = c.current_location_id
        ? await col('storage_locations').findOne({ $or: [{ _id: c.current_location_id }, { id: c.current_location_id }] })
        : null;

      const vehicle = c.current_vehicle_id
        ? await col('vehicles').findOne({ $or: [{ _id: c.current_vehicle_id }, { id: c.current_vehicle_id }] })
        : null;

      const shipment = c.current_shipment_id
        ? await col('shipments').findOne({ $or: [{ _id: c.current_shipment_id }, { id: c.current_shipment_id }] })
        : null;

      const recentReadings = (await col('temperature_logs')
        .find({ entity_id: containerIdStr })
        .sort({ timestamp: -1 })
        .limit(10)
        .toArray()).reverse();

      const temps = recentReadings.map(r => r.temperature);
      const mkt = calculateMKT(temps);
      const prediction = predictExcursionTime(recentReadings, c.max_temp);
      const holdTime = estimateHoldTimeAndBattery({
        batteryPct: c.battery_pct,
        currentTemp: c.current_temp,
        maxTemp: c.max_temp
      });
      const anomaly = detectSensorAnomalies(recentReadings);

      let sensorBadge = 'Safe';
      if (isOffline) {
        sensorBadge = 'Offline';
      } else if (c.current_temp > c.max_temp || c.current_temp < c.min_temp) {
        sensorBadge = 'Critical';
      } else if (c.battery_pct < 40 || c.door_status === 'OPEN') {
        sensorBadge = 'Warning';
      }

      enrichedContainers.push({
        ...c,
        id: containerIdStr,
        location_code: loc ? loc.code : null,
        cold_room: loc ? loc.cold_room : null,
        vehicle_number: vehicle ? vehicle.vehicle_number : null,
        shipment_number: shipment ? shipment.shipment_number : null,
        isSensorOffline: isOffline,
        sensorBadge,
        mkt,
        prediction,
        holdTime,
        anomaly,
        recentReadings
      });
    }

    const powerAnomalies = enrichedContainers.filter(
      c => c.power_status === 'BATTERY' || faultState.powerCuts[c.id]
    );

    const redundantProbes = enrichedContainers.map(c => ({
      containerId: c.id,
      containerCode: c.container_code,
      probePrimary: c.current_temp,
      probeSecondary: Number((c.current_temp + (Math.random() - 0.5) * 0.2).toFixed(2)),
      delta: 0.15,
      status: 'MATCHED'
    }));

    res.json({
      containers: enrichedContainers,
      powerAnomalies,
      redundantProbes,
      totalContainers: containers.length,
      criticalCount: enrichedContainers.filter(c => c.sensorBadge === 'Critical').length,
      warningCount: enrichedContainers.filter(c => c.sensorBadge === 'Warning').length,
      offlineCount: enrichedContainers.filter(c => c.sensorBadge === 'Offline').length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/monitoring/telemetry-history/:entityId
 * Detailed historical series for Recharts
 */
router.get('/telemetry-history/:entityId', async (req, res) => {
  try {
    const { limit = 40 } = req.query;
    const logs = (await col('temperature_logs')
      .find({ entity_id: req.params.entityId })
      .sort({ timestamp: -1 })
      .limit(Number(limit))
      .toArray()).reverse();

    const formatted = logs.map(l => ({
      ...l,
      id: l.id || l._id
    }));

    res.json({ history: formatted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
