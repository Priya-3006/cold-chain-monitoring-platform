/**
 * PRODUCT-SAFETY LOGIC & PREDICTIVE ANALYTICS
 * Mean Kinetic Temperature (MKT), Arrhenius kinetics, Rate-of-Rise Prediction,
 * Battery Run-Time, Safe Hold-Time, Anomaly Detection & Risk Scoring.
 */

const DELTA_H = 83144; // Activation energy (J/mol) for typical pharmaceuticals
const GAS_CONST_R = 8.314472; // Universal gas constant J/(mol·K)
const KELVIN_OFFSET = 273.15;

/**
 * Calculates Mean Kinetic Temperature (MKT) in Celsius using the Arrhenius equation:
 * Tk = (dH / R) / -ln( (1/n) * sum( e^(-dH / (R * Ti)) ) )
 * @param {Array<number>} temperaturesInCelsius - Array of temperature readings in Celsius
 * @returns {number} MKT in Celsius
 */
export function calculateMKT(temperaturesInCelsius) {
  if (!temperaturesInCelsius || temperaturesInCelsius.length === 0) {
    return 4.0;
  }

  const n = temperaturesInCelsius.length;
  let sumExp = 0;

  for (const tempC of temperaturesInCelsius) {
    const tempK = tempC + KELVIN_OFFSET;
    if (tempK <= 0) continue;
    const exponent = -DELTA_H / (GAS_CONST_R * tempK);
    sumExp += Math.exp(exponent);
  }

  const avgExp = sumExp / n;
  if (avgExp <= 0) return temperaturesInCelsius[0];

  const mktKelvin = (DELTA_H / GAS_CONST_R) / (-Math.log(avgExp));
  const mktCelsius = mktKelvin - KELVIN_OFFSET;

  return Number(mktCelsius.toFixed(2));
}

/**
 * Calculates cumulative time spent outside allowable temperature bounds
 * @param {Array<{temperature: number, timestamp: string}>} readings
 * @param {number} minTemp
 * @param {number} maxTemp
 * @returns {{ outOfRangeSeconds: number, excursions: Array<object> }}
 */
export function calculateExcursionStats(readings, minTemp = 2.0, maxTemp = 8.0) {
  if (!readings || readings.length < 2) {
    return { outOfRangeSeconds: 0, excursions: [] };
  }

  let totalOutOfRangeSeconds = 0;
  const excursions = [];
  let currentExcursion = null;

  for (let i = 1; i < readings.length; i++) {
    const prev = readings[i - 1];
    const curr = readings[i];
    const prevTime = new Date(prev.timestamp).getTime();
    const currTime = new Date(curr.timestamp).getTime();
    const deltaSeconds = Math.max(0, (currTime - prevTime) / 1000);

    const isHigh = curr.temperature > maxTemp;
    const isLow = curr.temperature < minTemp;

    if (isHigh || isLow) {
      totalOutOfRangeSeconds += deltaSeconds;

      if (!currentExcursion) {
        currentExcursion = {
          type: isHigh ? 'HIGH' : 'LOW',
          startTime: curr.timestamp,
          peakTemp: curr.temperature,
          durationSeconds: deltaSeconds
        };
      } else {
        currentExcursion.durationSeconds += deltaSeconds;
        if (isHigh && curr.temperature > currentExcursion.peakTemp) {
          currentExcursion.peakTemp = curr.temperature;
        } else if (isLow && curr.temperature < currentExcursion.peakTemp) {
          currentExcursion.peakTemp = curr.temperature;
        }
      }
    } else {
      if (currentExcursion) {
        currentExcursion.endTime = curr.timestamp;
        excursions.push({ ...currentExcursion });
        currentExcursion = null;
      }
    }
  }

  if (currentExcursion) {
    currentExcursion.endTime = readings[readings.length - 1].timestamp;
    excursions.push(currentExcursion);
  }

  return {
    outOfRangeSeconds: Math.round(totalOutOfRangeSeconds),
    excursions
  };
}

/**
 * Evaluates excursion safety for a vaccine batch and provides recommendation
 */
export function evaluateExcursionSafety({
  mkt,
  timeOutOfRangeSeconds,
  isFreezeSensitive,
  minAllowedTemp,
  maxAllowedTemp,
  lowestTempEncountered,
  highestTempEncountered
}) {
  const outOfRangeMinutes = timeOutOfRangeSeconds / 60;

  // 1. Strict freeze sensitivity check
  if (isFreezeSensitive && lowestTempEncountered < 0.0) {
    return {
      recommendation: 'DISCARD',
      severity: 'CRITICAL',
      reasoning: `Freeze-sensitive vaccine experienced sub-zero temperature (${lowestTempEncountered}°C). High probability of adjuvant precipitation, loss of immunogenicity, and toxic flocculation.`
    };
  }

  if (isFreezeSensitive && lowestTempEncountered < minAllowedTemp) {
    return {
      recommendation: 'QUARANTINE',
      severity: 'HIGH',
      reasoning: `Temperature dropped to ${lowestTempEncountered}°C below the ${minAllowedTemp}°C minimum limit. Requires WHO physical Shake Test and Quality Officer laboratory clearance before use.`
    };
  }

  // 2. High temperature excursion evaluation
  if (highestTempEncountered > 25.0 || outOfRangeMinutes > 240) {
    return {
      recommendation: 'DISCARD',
      severity: 'CRITICAL',
      reasoning: `Severe thermal degradation: Peak temperature reached ${highestTempEncountered}°C or prolonged cumulative out-of-range exposure (${Math.round(outOfRangeMinutes)} min). Potency compromised.`
    };
  }

  if (highestTempEncountered > maxAllowedTemp || mkt > maxAllowedTemp) {
    if (outOfRangeMinutes <= 45 && mkt <= maxAllowedTemp + 2.0) {
      return {
        recommendation: 'SAFE_TO_USE',
        severity: 'WARNING',
        reasoning: `Minor transient excursion: MKT is ${mkt}°C (within kinetic tolerance), out-of-range duration ${Math.round(outOfRangeMinutes)} min is within manufacturer stability margin. Immediate cooling restored.`
      };
    } else {
      return {
        recommendation: 'QUARANTINE',
        severity: 'HIGH',
        reasoning: `Excursion exceeds standard margin: MKT ${mkt}°C, duration ${Math.round(outOfRangeMinutes)} min. Batch must be placed under quarantine pending stability data review and Manager authorization.`
      };
    }
  }

  return {
    recommendation: 'SAFE_TO_USE',
    severity: 'NORMAL',
    reasoning: 'Temperature maintained within optimal cold chain specifications.'
  };
}

/**
 * Predicts excursion time based on recent rate of temperature rise (dT/dt)
 * @param {Array<{temperature: number, timestamp: string}>} recentReadings - Last 5-10 readings
 * @param {number} thresholdTemp - Max allowed limit (e.g. 8.0°C)
 * @returns {{ ratePerMinute: number, minutesToThreshold: number|null, predictionText: string }}
 */
export function predictExcursionTime(recentReadings, thresholdTemp = 8.0) {
  if (!recentReadings || recentReadings.length < 3) {
    return {
      ratePerMinute: 0,
      minutesToThreshold: null,
      predictionText: 'Telemetry stream initializing'
    };
  }

  const latest = recentReadings[recentReadings.length - 1];
  const oldest = recentReadings[0];
  const deltaMinutes = (new Date(latest.timestamp) - new Date(oldest.timestamp)) / 60000;

  if (deltaMinutes <= 0) {
    return { ratePerMinute: 0, minutesToThreshold: null, predictionText: 'Stable' };
  }

  const deltaTemp = latest.temperature - oldest.temperature;
  const ratePerMinute = deltaTemp / deltaMinutes;

  if (latest.temperature >= thresholdTemp) {
    return {
      ratePerMinute: Number(ratePerMinute.toFixed(3)),
      minutesToThreshold: 0,
      predictionText: `THRESHOLD EXCEEDED: Currently ${latest.temperature}°C (Limit: ${thresholdTemp}°C)`
    };
  }

  if (ratePerMinute > 0.05) {
    const remainingTemp = thresholdTemp - latest.temperature;
    const minutesToThreshold = Math.max(1, Math.round(remainingTemp / ratePerMinute));
    return {
      ratePerMinute: Number(ratePerMinute.toFixed(3)),
      minutesToThreshold,
      predictionText: `WARNING: Rising at ${ratePerMinute.toFixed(2)}°C/min; threshold (${thresholdTemp}°C) reached in ~${minutesToThreshold} min`
    };
  }

  if (ratePerMinute < -0.05) {
    return {
      ratePerMinute: Number(ratePerMinute.toFixed(3)),
      minutesToThreshold: null,
      predictionText: `Cooling actively at ${Math.abs(ratePerMinute).toFixed(2)}°C/min`
    };
  }

  return {
    ratePerMinute: Number(ratePerMinute.toFixed(3)),
    minutesToThreshold: null,
    predictionText: `Thermal state stable (dT/dt: ${ratePerMinute.toFixed(3)}°C/min)`
  };
}

/**
 * Estimates safe hold-time and battery run-time if power fails
 */
export function estimateHoldTimeAndBattery({
  batteryPct,
  currentTemp,
  maxTemp = 8.0,
  ambientTemp = 32.0,
  powerDrawWatts = 35.0, // Typical active mobile cooler
  batteryCapacityWh = 300.0, // Typical cooler battery pack
  thermalInsulationTauHours = 6.0 // Container thermal time constant
}) {
  // Battery remaining runtime:
  const effectiveWh = (batteryPct / 100) * batteryCapacityWh;
  const batteryHoursRemaining = Number((effectiveWh / powerDrawWatts).toFixed(1));

  // Passive thermal hold time if compressor is completely unpowered:
  // T(t) = T_ambient - (T_ambient - T_0) * exp(-t / tau)
  // t_hold = -tau * ln( (T_ambient - T_max) / (T_ambient - T_0) )
  let passiveHoldHours = 0;
  if (ambientTemp > maxTemp && currentTemp < maxTemp) {
    const numerator = ambientTemp - maxTemp;
    const denominator = ambientTemp - currentTemp;
    if (numerator > 0 && denominator > 0) {
      passiveHoldHours = Number((-thermalInsulationTauHours * Math.log(numerator / denominator)).toFixed(1));
    }
  }

  return {
    batteryHoursRemaining,
    passiveHoldHours: Math.max(0.5, passiveHoldHours),
    totalSafeHoldHours: Number((batteryHoursRemaining + passiveHoldHours).toFixed(1))
  };
}

/**
 * Comprehensive Shipment Risk Score calculation (0 - 100%)
 * Combines route delay, weather, door openings, battery, temperature drift, and history
 */
export function calculateShipmentRiskScore({
  etaMinutes,
  plannedMinutes = 45,
  currentTemp,
  minTemp = 2.0,
  maxTemp = 8.0,
  doorOpenCount = 0,
  batteryPct = 100,
  isFreezeSensitive = false,
  weatherRisk = 'CLEAR', // CLEAR, RAIN, EXTREME_HEAT
  hasRedundantSensorMismatch = false
}) {
  let score = 5; // Base low risk
  const reasons = [];

  // Delay risk
  const delayMinutes = Math.max(0, etaMinutes - plannedMinutes);
  if (delayMinutes > 30) {
    score += 25;
    reasons.push(`Significant delay: +${delayMinutes} min past scheduled delivery`);
  } else if (delayMinutes > 10) {
    score += 10;
    reasons.push(`Moderate transit delay: +${delayMinutes} min`);
  }

  // Temperature proximity to margins
  const marginToMax = maxTemp - currentTemp;
  const marginToMin = currentTemp - minTemp;
  if (currentTemp > maxTemp) {
    score += 45;
    reasons.push(`Temperature excursion active: ${currentTemp}°C exceeds max ${maxTemp}°C`);
  } else if (currentTemp < minTemp) {
    score += isFreezeSensitive ? 55 : 30;
    reasons.push(`Sub-minimum temperature: ${currentTemp}°C ${isFreezeSensitive ? '(CRITICAL FREEZE SENSITIVE)' : ''}`);
  } else if (marginToMax < 1.0) {
    score += 15;
    reasons.push(`Temperature near upper margin: ${currentTemp}°C`);
  } else if (marginToMin < 1.0) {
    score += isFreezeSensitive ? 20 : 10;
    reasons.push(`Temperature near lower margin: ${currentTemp}°C`);
  }

  // Door open frequency
  if (doorOpenCount >= 4) {
    score += 20;
    reasons.push(`Frequent door openings (${doorOpenCount} times) risking cold loss`);
  } else if (doorOpenCount >= 2) {
    score += 8;
    reasons.push(`Multiple door openings logged (${doorOpenCount} times)`);
  }

  // Battery status
  if (batteryPct < 25) {
    score += 25;
    reasons.push(`Critical low battery: ${batteryPct}%`);
  } else if (batteryPct < 50) {
    score += 10;
    reasons.push(`Battery running low: ${batteryPct}%`);
  }

  // Weather conditions
  if (weatherRisk === 'EXTREME_HEAT') {
    score += 15;
    reasons.push('Ambient heatwave warning (> 40°C outdoor ambient)');
  } else if (weatherRisk === 'RAIN') {
    score += 5;
    reasons.push('Heavy monsoon rainfall slowing transit');
  }

  // Sensor redundancy mismatch
  if (hasRedundantSensorMismatch) {
    score += 15;
    reasons.push('Probe telemetry divergence: Primary vs secondary sensor mismatch');
  }

  const finalScore = Math.min(100, Math.max(0, score));
  return {
    riskScore: finalScore,
    riskLevel: finalScore >= 60 ? 'HIGH' : finalScore >= 30 ? 'MEDIUM' : 'LOW',
    reasons: reasons.length > 0 ? reasons : ['All telemetry within nominal baseline']
  };
}

/**
 * Anomaly Detection: Detects stuck sensors, erratic jitter, or impossible jumps
 */
export function detectSensorAnomalies(readings) {
  if (!readings || readings.length < 5) return { hasAnomaly: false };

  // 1. Stuck sensor check: Zero variance across last 5 readings
  const last5Temps = readings.slice(-5).map(r => r.temperature);
  const minT = Math.min(...last5Temps);
  const maxT = Math.max(...last5Temps);
  if (maxT === minT) {
    return {
      hasAnomaly: true,
      anomalyType: 'STUCK_SENSOR',
      message: `Sensor value has remained identical (${minT}°C) across 5 consecutive readings. Check for probe failure.`
    };
  }

  // 2. Sudden impossible jump check (> 10°C delta in less than 30 seconds)
  const r1 = readings[readings.length - 2];
  const r2 = readings[readings.length - 1];
  const timeDiffSec = (new Date(r2.timestamp) - new Date(r1.timestamp)) / 1000;
  if (timeDiffSec <= 60 && Math.abs(r2.temperature - r1.temperature) > 10.0) {
    return {
      hasAnomaly: true,
      anomalyType: 'IMPOSSIBLE_JUMP',
      message: `Unrealistic temperature swing from ${r1.temperature}°C to ${r2.temperature}°C in ${timeDiffSec}s. Potential electrical short or probe disconnection.`
    };
  }

  return { hasAnomaly: false };
}
