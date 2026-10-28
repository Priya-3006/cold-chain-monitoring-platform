import crypto from 'node:crypto';
import { col } from '../db/mongo.js';
import { triggerAlert } from './alertEngine.js';
import { calculateShipmentRiskScore } from './safetyAnalytics.js';

// In-memory simulation fault flags
export const faultState = {
  tempSpikes: {}, // containerId -> targetTemp
  doorOverrides: {}, // containerId -> 'OPEN' | 'CLOSED'
  powerCuts: {}, // containerId -> boolean
  lowBatteries: {}, // containerId -> number
  sensorOffline: {}, // containerId -> boolean
  routeDeviations: {}, // shipmentId -> boolean
  transportDelays: {} // shipmentId -> number
};

let simulatorInterval = null;
let broadcastCallback = null;

export function registerBroadcastCallback(fn) {
  broadcastCallback = fn;
}

/**
 * Starts the IoT simulation loop
 */
export function startSimulator(intervalMs = 4000) {
  if (simulatorInterval) return;

  console.log('--- IoT Simulator Service Started (MongoDB Engine) ---');
  simulatorInterval = setInterval(async () => {
    try {
      await runSimulationTick();
    } catch (err) {
      console.error('Simulation tick error:', err);
    }
  }, intervalMs);
}

export function stopSimulator() {
  if (simulatorInterval) {
    clearInterval(simulatorInterval);
    simulatorInterval = null;
  }
}

/**
 * One simulation tick for all containers and vehicles
 */
export async function runSimulationTick() {
  const containers = await col('containers').find({ is_active: 1 }).toArray();
  const now = new Date().toISOString();
  const telemetryUpdates = [];

  for (const c of containers) {
    const containerIdStr = c.id || c._id;
    const isOffline = faultState.sensorOffline[containerIdStr];

    // If sensor offline injected, skip logging new readings
    if (isOffline) {
      await triggerAlert({
        alertType: 'SENSOR_OFFLINE',
        severity: 'WARNING',
        entityType: 'CONTAINER',
        entityId: containerIdStr,
        shipmentId: c.current_shipment_id,
        title: `Telemetry Heartbeat Missing: Container ${c.container_code}`,
        message: `Sensor offline on ${c.container_code}. Last reading was ${c.current_temp}°C at ${c.last_telemetry_at}.`,
        currentReading: 'OFFLINE'
      });
      continue;
    }

    // Determine door status
    let doorStatus = faultState.doorOverrides[containerIdStr] || c.door_status;

    // Determine power status & battery
    let powerStatus = faultState.powerCuts[containerIdStr] ? 'BATTERY' : c.power_status;
    let batteryPct = faultState.lowBatteries[containerIdStr] !== undefined
      ? faultState.lowBatteries[containerIdStr]
      : (powerStatus === 'BATTERY' ? Math.max(15, c.battery_pct - 1) : Math.min(100, c.battery_pct + 1));

    // Determine current temperature
    let newTemp = c.current_temp;
    if (faultState.tempSpikes[containerIdStr] !== undefined) {
      newTemp = faultState.tempSpikes[containerIdStr];
    } else if (doorStatus === 'OPEN') {
      newTemp = Number((newTemp + 0.35).toFixed(2));
    } else if (powerStatus === 'BATTERY' && batteryPct < 20) {
      newTemp = Number((newTemp + 0.15).toFixed(2));
    } else {
      const targetMid = (c.min_temp + c.max_temp) / 2;
      const drift = (targetMid - newTemp) * 0.1;
      const randomJitter = (Math.random() - 0.5) * 0.15;
      newTemp = Number((newTemp + drift + randomJitter).toFixed(2));
    }

    const newHumidity = Number((50 + (Math.random() - 0.5) * 4).toFixed(1));

    // Update container record
    await col('containers').updateOne(
      { _id: c._id },
      {
        $set: {
          current_temp: newTemp,
          current_humidity: newHumidity,
          door_status: doorStatus,
          power_status: powerStatus,
          battery_pct: batteryPct,
          last_telemetry_at: now
        }
      }
    );

    // Insert telemetry log
    const logId = crypto.randomUUID();
    await col('temperature_logs').insertOne({
      _id: logId,
      id: logId,
      entity_type: 'CONTAINER',
      entity_id: containerIdStr,
      temperature: newTemp,
      humidity: newHumidity,
      door_open: doorStatus === 'OPEN' ? 1 : 0,
      power_mode: powerStatus,
      battery_pct: batteryPct,
      timestamp: now
    });

    // Update sensor heartbeat
    const sensorId = `sns-${containerIdStr}`;
    await col('sensor_logs').updateOne(
      { _id: sensorId },
      {
        $set: {
          id: sensorId,
          entity_type: 'CONTAINER',
          entity_id: containerIdStr,
          sensor_id: `SNS-PROBE-${c.container_code}`,
          sensor_type: 'PRIMARY_PROBE',
          status: 'ONLINE',
          last_heartbeat: now,
          battery_level: batteryPct
        }
      },
      { upsert: true }
    );

    // Evaluate temperature alerts
    if (newTemp > c.max_temp) {
      await triggerAlert({
        alertType: 'TEMP_HIGH',
        severity: 'CRITICAL',
        entityType: 'CONTAINER',
        entityId: containerIdStr,
        shipmentId: c.current_shipment_id,
        title: `High Temperature Excursion: ${c.container_code} at ${newTemp}°C`,
        message: `Container ${c.container_code} exceeded maximum limit (${c.max_temp}°C). Current reading: ${newTemp}°C.`,
        currentReading: `${newTemp}°C`
      });
    } else if (newTemp < c.min_temp) {
      // Check if container holds freeze-sensitive vaccines
      const containerVaccines = await col('container_vaccines').find({ container_id: containerIdStr }).toArray();
      let freezeSensitiveItem = null;

      if (containerVaccines.length > 0) {
        const batchIds = containerVaccines.map(cv => cv.batch_id);
        const batches = await col('batches').find({ $or: [{ _id: { $in: batchIds } }, { id: { $in: batchIds } }] }).toArray();
        const vaccineIds = batches.map(b => b.vaccine_id);
        const freezeVac = await col('vaccines').findOne({
          $or: [{ _id: { $in: vaccineIds } }, { id: { $in: vaccineIds } }],
          freeze_sensitive: 1
        });
        if (freezeVac) freezeSensitiveItem = freezeVac;
      }

      const isFreezeRisk = Boolean(freezeSensitiveItem);
      await triggerAlert({
        alertType: isFreezeRisk ? 'FREEZE_RISK' : 'TEMP_LOW',
        severity: isFreezeRisk ? 'EMERGENCY' : 'CRITICAL',
        entityType: 'CONTAINER',
        entityId: containerIdStr,
        shipmentId: c.current_shipment_id,
        title: isFreezeRisk
          ? `FREEZE RISK DETECTED: ${freezeSensitiveItem.name} at ${newTemp}°C`
          : `Low Temperature Excursion: ${c.container_code} at ${newTemp}°C`,
        message: isFreezeRisk
          ? `Freeze-sensitive vaccine ${freezeSensitiveItem.name} exposed to ${newTemp}°C below ${c.min_temp}°C limit! Shake test & quarantine required.`
          : `Temperature dropped to ${newTemp}°C below minimum safe limit (${c.min_temp}°C).`,
        currentReading: `${newTemp}°C`
      });
    }

    // Door open alert
    if (doorStatus === 'OPEN') {
      await triggerAlert({
        alertType: 'DOOR_OPEN_TOO_LONG',
        severity: 'WARNING',
        entityType: 'CONTAINER',
        entityId: containerIdStr,
        shipmentId: c.current_shipment_id,
        title: `Door Open Ajar: Container ${c.container_code}`,
        message: `Container ${c.container_code} door latch is open. Cold air escaping rapidly.`,
        currentReading: 'DOOR_OPEN'
      });
    }

    // Power failure alert
    if (powerStatus === 'BATTERY' && faultState.powerCuts[containerIdStr]) {
      await triggerAlert({
        alertType: 'POWER_FAILURE',
        severity: 'CRITICAL',
        entityType: 'CONTAINER',
        entityId: containerIdStr,
        shipmentId: c.current_shipment_id,
        title: `AC Power Lost: Container ${c.container_code}`,
        message: `Mains electricity interrupted. Switched to internal battery (${batteryPct}%).`,
        currentReading: `Battery: ${batteryPct}%`
      });
    }

    // Low battery alert
    if (batteryPct < 25) {
      await triggerAlert({
        alertType: 'LOW_BATTERY',
        severity: 'CRITICAL',
        entityType: 'CONTAINER',
        entityId: containerIdStr,
        shipmentId: c.current_shipment_id,
        title: `Critical Low Battery: Container ${c.container_code} (${batteryPct}%)`,
        message: `Battery reserves depleted to ${batteryPct}%. Cooling capability at imminent risk.`,
        currentReading: `${batteryPct}%`
      });
    }

    telemetryUpdates.push({
      containerId: containerIdStr,
      containerCode: c.container_code,
      temperature: newTemp,
      humidity: newHumidity,
      doorStatus,
      powerStatus,
      batteryPct,
      timestamp: now
    });
  }

  // Update in-transit vehicles and shipments
  const activeShipments = await col('shipments').find({ status: 'IN_TRANSIT' }).toArray();
  const vehicleUpdates = [];

  for (const shp of activeShipments) {
    const shpIdStr = shp.id || shp._id;
    const vehicle = await col('vehicles').findOne({ $or: [{ _id: shp.vehicle_id }, { id: shp.vehicle_id }] });
    const container = await col('containers').findOne({ $or: [{ _id: shp.container_id }, { id: shp.container_id }] });

    if (!vehicle || !container) continue;

    let lat = vehicle.latitude || 13.0067;
    let lng = vehicle.longitude || 80.2023;
    let speed = 35 + Math.round((Math.random() - 0.5) * 10);

    // Route deviation simulation
    if (faultState.routeDeviations[shpIdStr]) {
      lat += 0.003;
      lng -= 0.004;
      await triggerAlert({
        alertType: 'ROUTE_DEVIATION',
        severity: 'HIGH',
        entityType: 'VEHICLE',
        entityId: vehicle.id || vehicle._id,
        shipmentId: shpIdStr,
        title: `Route Deviation Detected: Shipment ${shp.shipment_number}`,
        message: `Reefer vehicle has deviated > 2.5 km from planned transport corridor.`,
        currentReading: `${lat.toFixed(4)}, ${lng.toFixed(4)}`
      });
    } else {
      lat += 0.0008;
      lng += 0.0009;
    }

    const addedDelay = faultState.transportDelays[shpIdStr] || 0;
    const etaMinutes = Math.max(5, (shp.eta_minutes || 45) - 1 + addedDelay);

    const risk = calculateShipmentRiskScore({
      etaMinutes,
      plannedMinutes: 45,
      currentTemp: container.current_temp,
      doorOpenCount: shp.door_open_count || 0,
      batteryPct: container.battery_pct,
      weatherRisk: 'CLEAR'
    });

    await col('vehicles').updateOne(
      { _id: vehicle._id },
      { $set: { latitude: Number(lat.toFixed(6)), longitude: Number(lng.toFixed(6)), speed_kmh: speed } }
    );

    await col('shipments').updateOne(
      { _id: shp._id },
      { $set: { eta_minutes: etaMinutes, risk_score: risk.riskScore, risk_reasons: JSON.stringify(risk.reasons) } }
    );

    const gpsLogId = crypto.randomUUID();
    await col('gps_logs').insertOne({
      _id: gpsLogId,
      id: gpsLogId,
      vehicle_id: vehicle.id || vehicle._id,
      shipment_id: shpIdStr,
      latitude: lat,
      longitude: lng,
      speed,
      timestamp: now
    });

    vehicleUpdates.push({
      shipmentId: shpIdStr,
      vehicleId: vehicle.id || vehicle._id,
      latitude: lat,
      longitude: lng,
      speed,
      etaMinutes,
      riskScore: risk.riskScore
    });
  }

  // Broadcast via WebSocket
  if (broadcastCallback) {
    broadcastCallback({
      type: 'TELEMETRY_TICK',
      timestamp: now,
      containers: telemetryUpdates,
      vehicles: vehicleUpdates
    });
  }
}

/**
 * Fault Injection APIs
 */
export function injectTempSpike(containerId, targetTemp = 9.8) {
  faultState.tempSpikes[containerId] = Number(targetTemp);
  return { success: true, message: `Injected temperature spike (${targetTemp}°C) on container ${containerId}.` };
}

export function injectDoorOpen(containerId, isOpen = true) {
  faultState.doorOverrides[containerId] = isOpen ? 'OPEN' : 'CLOSED';
  return { success: true, message: `Container ${containerId} door set to ${isOpen ? 'OPEN' : 'CLOSED'}.` };
}

export function injectPowerCut(containerId, hasCut = true) {
  faultState.powerCuts[containerId] = hasCut;
  return { success: true, message: `Power cut ${hasCut ? 'ACTIVATED' : 'RESTORED'} on container ${containerId}.` };
}

export function injectLowBattery(containerId, pct = 18) {
  faultState.lowBatteries[containerId] = Number(pct);
  return { success: true, message: `Battery depleted to ${pct}% on container ${containerId}.` };
}

export function injectSensorOffline(containerId, isOffline = true) {
  faultState.sensorOffline[containerId] = isOffline;
  return { success: true, message: `Sensor offline ${isOffline ? 'SIMULATED' : 'RESTORED'} on container ${containerId}.` };
}

export function injectRouteDeviation(shipmentId, isDeviated = true) {
  faultState.routeDeviations[shipmentId] = isDeviated;
  return { success: true, message: `Route deviation ${isDeviated ? 'TRIGGERED' : 'CLEARED'} on shipment ${shipmentId}.` };
}

export function injectTransportDelay(shipmentId, extraMinutes = 35) {
  faultState.transportDelays[shipmentId] = Number(extraMinutes);
  return { success: true, message: `Transport delay (+${extraMinutes} min) applied to shipment ${shipmentId}.` };
}

export function resetSimulation() {
  faultState.tempSpikes = {};
  faultState.doorOverrides = {};
  faultState.powerCuts = {};
  faultState.lowBatteries = {};
  faultState.sensorOffline = {};
  faultState.routeDeviations = {};
  faultState.transportDelays = {};
  return { success: true, message: 'All fault injections cleared. Returning to nominal steady-state.' };
}
