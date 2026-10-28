import express from 'express';
import {
  faultState,
  injectTempSpike,
  injectDoorOpen,
  injectPowerCut,
  injectLowBattery,
  injectSensorOffline,
  injectRouteDeviation,
  injectTransportDelay,
  resetSimulation,
  runSimulationTick
} from '../services/simulatorService.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

/**
 * GET /api/simulator/status
 */
router.get('/status', (req, res) => {
  res.json({ faultState });
});

/**
 * POST /api/simulator/temp-spike
 */
router.post('/temp-spike', (req, res) => {
  const { containerId = 'cnt-c015', targetTemp = 9.8 } = req.body;
  const result = injectTempSpike(containerId, targetTemp);
  res.json(result);
});

/**
 * POST /api/simulator/door-open
 */
router.post('/door-open', (req, res) => {
  const { containerId = 'cnt-c015', isOpen = true } = req.body;
  const result = injectDoorOpen(containerId, isOpen);
  res.json(result);
});

/**
 * POST /api/simulator/power-cut
 */
router.post('/power-cut', (req, res) => {
  const { containerId = 'cnt-c015', hasCut = true } = req.body;
  const result = injectPowerCut(containerId, hasCut);
  res.json(result);
});

/**
 * POST /api/simulator/low-battery
 */
router.post('/low-battery', (req, res) => {
  const { containerId = 'cnt-c015', pct = 18 } = req.body;
  const result = injectLowBattery(containerId, pct);
  res.json(result);
});

/**
 * POST /api/simulator/sensor-offline
 */
router.post('/sensor-offline', (req, res) => {
  const { containerId = 'cnt-c015', isOffline = true } = req.body;
  const result = injectSensorOffline(containerId, isOffline);
  res.json(result);
});

/**
 * POST /api/simulator/route-deviation
 */
router.post('/route-deviation', (req, res) => {
  const { shipmentId = 'shp-vc1020', isDeviated = true } = req.body;
  const result = injectRouteDeviation(shipmentId, isDeviated);
  res.json(result);
});

/**
 * POST /api/simulator/transport-delay
 */
router.post('/transport-delay', (req, res) => {
  const { shipmentId = 'shp-vc1020', extraMinutes = 35 } = req.body;
  const result = injectTransportDelay(shipmentId, extraMinutes);
  res.json(result);
});

/**
 * POST /api/simulator/trigger-tick
 * Manually force a simulation tick
 */
router.post('/trigger-tick', async (req, res) => {
  await runSimulationTick();
  res.json({ message: 'Manual simulation tick executed.' });
});

/**
 * POST /api/simulator/reset
 */
router.post('/reset', (req, res) => {
  const result = resetSimulation();
  res.json(result);
});

export default router;
