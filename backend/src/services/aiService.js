import { col } from '../db/mongo.js';
import { acknowledgeAlert, resolveAlert } from './alertEngine.js';

/**
 * AI Tool Implementations (Grounded DB Lookups & Actions)
 */
export const coldChainTools = {
  get_shipments_at_risk: async () => {
    const list = await col('shipments')
      .find({ $or: [{ risk_score: { $gt: 20 } }, { status: 'IN_TRANSIT' }] })
      .sort({ risk_score: -1 })
      .toArray();

    const enriched = [];
    for (const s of list) {
      const hospital = await col('hospitals').findOne({ $or: [{ _id: s.destination_hospital_id }, { id: s.destination_hospital_id }] });
      const container = await col('containers').findOne({ $or: [{ _id: s.container_id }, { id: s.container_id }] });
      enriched.push({
        ...s,
        destination: hospital ? hospital.name : 'Unknown Hospital',
        container_code: container ? container.container_code : 'N/A',
        current_temp: container ? container.current_temp : null,
        battery_pct: container ? container.battery_pct : null
      });
    }

    return { shipmentsAtRisk: enriched };
  },

  get_container_telemetry: async ({ containerCode }) => {
    const container = await col('containers').findOne({
      $or: [{ container_code: containerCode }, { _id: containerCode }, { id: containerCode }]
    });

    if (!container) return { error: `Container ${containerCode} not found.` };

    const activeAlerts = await col('alerts')
      .find({
        entity_id: container.id || container._id,
        status: { $ne: 'RESOLVED' }
      })
      .toArray();

    return {
      container,
      activeAlerts
    };
  },

  trace_batch_location: async ({ batchNumber }) => {
    const batch = await col('batches').findOne({ batch_number: batchNumber });

    if (!batch) return { error: `Batch '${batchNumber}' not found in registry.` };

    const vaccine = await col('vaccines').findOne({ $or: [{ _id: batch.vaccine_id }, { id: batch.vaccine_id }] });
    const batchDetails = {
      ...batch,
      vaccine_name: vaccine ? vaccine.name : 'Unknown Vaccine',
      min_temp: vaccine ? vaccine.min_temp : 2.0,
      max_temp: vaccine ? vaccine.max_temp : 8.0
    };

    const containerVaccines = await col('container_vaccines')
      .find({ batch_id: batch.id || batch._id })
      .toArray();

    const locations = [];
    for (const cv of containerVaccines) {
      const container = await col('containers').findOne({ $or: [{ _id: cv.container_id }, { id: cv.container_id }] });
      if (!container) continue;

      const loc = container.current_location_id
        ? await col('storage_locations').findOne({ $or: [{ _id: container.current_location_id }, { id: container.current_location_id }] })
        : null;

      const warehouse = loc
        ? await col('warehouses').findOne({ $or: [{ _id: loc.warehouse_id }, { id: loc.warehouse_id }] })
        : null;

      const vehicle = container.current_vehicle_id
        ? await col('vehicles').findOne({ $or: [{ _id: container.current_vehicle_id }, { id: container.current_vehicle_id }] })
        : null;

      const shipment = container.current_shipment_id
        ? await col('shipments').findOne({ $or: [{ _id: container.current_shipment_id }, { id: container.current_shipment_id }] })
        : null;

      locations.push({
        container_code: container.container_code,
        current_temp: container.current_temp,
        status: container.status,
        quantity: cv.quantity,
        location_code: loc ? loc.code : null,
        cold_room: loc ? loc.cold_room : null,
        rack: loc ? loc.rack : null,
        slot: loc ? loc.slot : null,
        warehouse_name: warehouse ? warehouse.name : null,
        vehicle_number: vehicle ? vehicle.vehicle_number : null,
        shipment_number: shipment ? shipment.shipment_number : null,
        shipment_status: shipment ? shipment.status : null
      });
    }

    return {
      batch: batchDetails,
      currentLocations: locations
    };
  },

  get_sop_procedure: async ({ alertType }) => {
    const sop = await col('sop_library').findOne({
      $or: [{ alert_type: alertType }, { _id: alertType }, { id: alertType }]
    });

    if (!sop) {
      const allSops = await col('sop_library').find({}).toArray();
      return { error: `No SOP found for '${alertType}'. Available SOPs:`, allSops };
    }

    return {
      sop: {
        ...sop,
        instructions: Array.isArray(sop.step_by_step_instructions)
          ? sop.step_by_step_instructions
          : JSON.parse(sop.step_by_step_instructions || '[]')
      }
    };
  },

  list_active_alerts: async ({ severity = null }) => {
    const query = { status: { $ne: 'RESOLVED' } };
    if (severity) query.severity = severity;

    const alerts = await col('alerts')
      .find(query)
      .sort({ created_at: -1 })
      .limit(10)
      .toArray();

    return { activeAlerts: alerts };
  },

  acknowledge_alert_action: async ({ alertId, userId, userRole }) => {
    try {
      const updated = await acknowledgeAlert(alertId, userId);
      return { success: true, alert: updated };
    } catch (e) {
      return { error: e.message };
    }
  },

  resolve_alert_action: async ({ alertId, userId, userRole, notes }) => {
    if (userRole !== 'Manager' && userRole !== 'Admin') {
      return { error: `Access Denied: Resolving an alert requires Manager or Admin privileges. Current role is ${userRole}.` };
    }
    try {
      const updated = await resolveAlert(alertId, userId, notes || 'Resolved via ColdChain Assistant');
      return { success: true, alert: updated };
    } catch (e) {
      return { error: e.message };
    }
  }
};

/**
 * ColdChain Assistant Query Handler
 */
export async function processChatQuery({ query, user, language = 'en' }) {
  const q = query.trim().toLowerCase();
  const isTamil = language === 'ta' || /[\u0B80-\u0BFF]/.test(query);

  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    try {
      const geminiResponse = await callGeminiWithTools(query, user, isTamil, apiKey);
      if (geminiResponse) return geminiResponse;
    } catch (err) {
      console.warn('Gemini API call failed, falling back to rule engine:', err.message);
    }
  }

  return await executeRuleBasedFallback(q, query, user, isTamil);
}

/**
 * Rule-Based Query Execution Engine
 */
async function executeRuleBasedFallback(q, rawQuery, user, isTamil) {
  // A. Risk & In-Transit Shipments
  if (q.includes('risk') || q.includes('delayed') || q.includes('பாதிப்பு') || q.includes('ஆபத்து')) {
    const data = await coldChainTools.get_shipments_at_risk();
    if (data.shipmentsAtRisk.length === 0) {
      return {
        text: isTamil
          ? 'தற்போது எந்தவொரு ஏற்றுமதியும் அதிக ஆபத்தில் இல்லை. அனைத்து விநியோகங்களும் பாதுகாப்பான வரம்பிற்குள் உள்ளன.'
          : 'All shipments are operating normally. No high-risk thermal or transport deviations detected.',
        data: data.shipmentsAtRisk
      };
    }
    const lines = data.shipmentsAtRisk.map(
      s => `• Shipment **${s.shipment_number}** to ${s.destination} (Risk Score: **${s.risk_score}%**). Container: ${s.container_code}, Temp: ${s.current_temp}°C, Battery: ${s.battery_pct}%. Reasons: ${typeof s.risk_reasons === 'string' ? s.risk_reasons : JSON.stringify(s.risk_reasons)}`
    ).join('\n');

    return {
      text: isTamil
        ? `தற்போது ஆபத்தில் உள்ள ஏற்றுமதிகள் (${data.shipmentsAtRisk.length}):\n\n${lines}`
        : `Here are the active shipments currently flagged with risk factors (${data.shipmentsAtRisk.length}):\n\n${lines}`,
      data: data.shipmentsAtRisk
    };
  }

  // B. Trace Batch Location ("Where is batch VA2026-001?")
  const batchMatch = rawQuery.match(/VA\d{4}-\w+|[A-Z]{2}\d{4}-\d+|batch\s+([A-Za-z0-9\-]+)/i);
  if (batchMatch || q.includes('where is batch') || q.includes('பேட்ச் எங்கே')) {
    const batchNum = batchMatch ? (batchMatch[1] || batchMatch[0]).toUpperCase() : 'VA2026-001';
    const result = await coldChainTools.trace_batch_location({ batchNumber: batchNum });

    if (result.error) {
      return { text: isTamil ? `பிழை: பேட்ச் ${batchNum} கிடைக்கவில்லை.` : result.error };
    }

    const { batch, currentLocations } = result;
    const locText = currentLocations.length > 0
      ? currentLocations.map(l =>
          `• Container **${l.container_code}** (${l.current_temp}°C) at **${l.warehouse_name || 'In-Transit'}** [${l.cold_room || ''} ${l.slot || ''}] - Qty: ${l.quantity} vials. ${l.shipment_number ? `(Shipment: ${l.shipment_number})` : ''}`
        ).join('\n')
      : 'No active stock in containers currently.';

    return {
      text: isTamil
        ? `📦 **பேட்ச் கண்டறியும் அறிக்கை**: ${batch.batch_number} (${batch.vaccine_name})\n- தற்போதைய நிலை: ${batch.safety_status}\n- காலாவதி: ${batch.expiry_date}\n- MKT: ${batch.mkt_cached}°C\n\nஇருப்பிடங்கள்:\n${locText}`
        : `📦 **Traceability Report for Batch ${batch.batch_number}** (${batch.vaccine_name}):\n- **Safety Status**: ${batch.safety_status}\n- **Storage Requirement**: ${batch.min_temp}°C to ${batch.max_temp}°C\n- **Expiry**: ${batch.expiry_date} | **VVM Stage**: ${batch.vvm_stage}\n- **Cached MKT**: ${batch.mkt_cached}°C\n\n**Current Custody & Locations:**\n${locText}`,
      data: result
    };
  }

  // C. Container Specific Query ("Why did container C015 alarm?" / "Status of C002")
  const containerMatch = rawQuery.match(/C\d{3}|CONT-[A-Za-z0-9]+/i);
  if (containerMatch || q.includes('container')) {
    const code = containerMatch ? containerMatch[0].toUpperCase() : 'C015';
    const result = await coldChainTools.get_container_telemetry({ containerCode: code });

    if (result.error) return { text: result.error };

    const c = result.container;
    const alerts = result.activeAlerts;
    const alertDesc = alerts.length > 0
      ? alerts.map(a => `⚠️ **${a.title}** (${a.severity}): ${a.message}`).join('\n')
      : 'No active alarms for this container.';

    return {
      text: isTamil
        ? `❄️ **கன்டெய்னர் விவரம் ${c.container_code}**:\n- வெப்பநிலை: ${c.current_temp}°C (வரம்பு: ${c.min_temp}°C முதல் ${c.max_temp}°C)\n- கதவு: ${c.door_status}\n- பேட்டரி: ${c.battery_pct}%\n- நிலை: ${c.status}\n\nஎச்சரிக்கைகள்:\n${alertDesc}`
        : `❄️ **Container Status: ${c.container_code}** (${c.container_type})\n- **Current Temp**: ${c.current_temp}°C (Operating Range: ${c.min_temp}°C to ${c.max_temp}°C)\n- **Door Status**: ${c.door_status}\n- **Power / Battery**: ${c.power_status} (${c.battery_pct}%)\n- **Operational Status**: ${c.status}\n\n**Active Alarms & Diagnosis:**\n${alertDesc}`,
      data: result
    };
  }

  // D. SOP & Emergency Guidance ("Power failed, what do I do?" / "Door open")
  if (q.includes('power') || q.includes('மின்சாரம்') || q.includes('door') || q.includes('freeze') || q.includes('sop') || q.includes('what do i do')) {
    let type = 'POWER_FAILURE';
    if (q.includes('door')) type = 'DOOR_OPEN_TOO_LONG';
    if (q.includes('freeze')) type = 'FREEZE_RISK';
    if (q.includes('temp') || q.includes('high')) type = 'TEMP_HIGH';

    const sopResult = await coldChainTools.get_sop_procedure({ alertType: type });
    if (sopResult.sop) {
      const s = sopResult.sop;
      const steps = s.instructions.map(st => `• ${st}`).join('\n');
      return {
        text: isTamil
          ? `📋 **செயல்முறை வழிகாட்டல் (SOP)**: ${s.title}\nதூண்டுதல்: ${s.trigger_condition}\n\nபடிநிலைகள்:\n${steps}`
          : `📋 **Standard Operating Procedure (SOP)**: **${s.title}**\n- **Trigger**: ${s.trigger_condition}\n- **Root Cause Category**: ${s.root_cause_category}\n- **Escalation Window**: ${s.escalation_minutes} minutes\n\n**Actionable Step-by-Step Guidance:**\n${steps}`,
        data: s
      };
    }
  }

  // E. Excursions / Alerts List
  if (q.includes('alert') || q.includes('excursion') || q.includes('எச்சரிக்கை')) {
    const list = await coldChainTools.list_active_alerts({});
    const lines = list.activeAlerts.map(a => `• [${a.severity}] **${a.alert_code}**: ${a.title} (Status: ${a.status}, Role: ${a.assigned_role})`).join('\n');
    return {
      text: isTamil
        ? `செயலில் உள்ள எச்சரிக்கைகள் (${list.activeAlerts.length}):\n\n${lines}`
        : `Active Cold-Chain Alerts (${list.activeAlerts.length}):\n\n${lines || 'No active alerts in the system.'}`,
      data: list
    };
  }

  // General Guidance
  return {
    text: isTamil
      ? 'வணக்கம்! நான் கோல்ட்செயின் உதவியாளர் (ColdChain Assistant). நீங்கள் வெப்பநிலை நிலவரம், விநியோக ஆபத்து, பேட்ச் இருப்பிடம் (எ.கா: "Where is batch VA2026-001?"), அல்லது SOP வழிகாட்டல்களை என்னிடம் கேட்கலாம்.'
      : 'Hello! I am your ColdChain Assistant. You can ask me:\n- *"Which shipments are at risk right now?"*\n- *"Where is batch VA2026-001?"*\n- *"Why did container C015 alarm?"*\n- *"Power failed in Cold Room, what is the SOP?"*\n- *"Show active alerts"*',
    data: null
  };
}

async function callGeminiWithTools(query, user, isTamil, apiKey) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [{ text: `You are the ColdChain Assistant for a smart vaccine monitoring platform. Ground your response STRICTLY in the following tool capabilities. User query: ${query}. User role: ${user.role}. Language: ${isTamil ? 'Tamil' : 'English'}` }]
      }]
    })
  });

  if (!response.ok) return null;
  const json = await response.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  return text ? { text, data: null } : null;
}
