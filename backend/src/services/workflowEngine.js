import crypto from 'node:crypto';
import { col } from '../db/mongo.js';
import { logAuditEvent } from './auditHashChain.js';
import { triggerAlert } from './alertEngine.js';

/**
 * PROOF-GATED WORKFLOW ENGINE
 * Enforces: ACTION -> PROOF (Scan / Sensor / Photo / GPS) -> VERIFICATION -> NEXT STEP UNLOCKED
 */

/**
 * 1. SCAN VACCINE BARCODE (Blinkit-style picking)
 */
export async function scanVaccineBarcode({ shipmentId, scannedCode, userId }) {
  const shipment = await col('shipments').findOne({ $or: [{ _id: shipmentId }, { id: shipmentId }] });
  if (!shipment) throw new Error('Shipment not found.');

  // Find batch by batch_number or barcode
  const batch = await col('batches').findOne({ batch_number: scannedCode });

  if (!batch) {
    const eventId = crypto.randomUUID();
    const nowStr = new Date().toISOString();
    await col('scan_events').insertOne({
      _id: eventId,
      id: eventId,
      user_id: userId,
      event_type: 'VACCINE_PICK',
      scanned_code: scannedCode,
      entity_type: 'BATCH',
      entity_id: 'UNKNOWN',
      status: 'INVALID',
      message: `Barcode '${scannedCode}' not recognized in vaccine registry.`,
      timestamp: nowStr
    });
    return {
      success: false,
      status: 'INVALID',
      message: `Barcode '${scannedCode}' not recognized. Please scan a valid registered vaccine vial barcode.`
    };
  }

  // Get vaccine details
  const vaccine = await col('vaccines').findOne({ $or: [{ _id: batch.vaccine_id }, { id: batch.vaccine_id }] });
  const batchWithVaccine = {
    ...batch,
    vaccine_name: vaccine ? vaccine.name : 'Unknown Vaccine',
    min_temp: vaccine ? vaccine.min_temp : 2.0,
    max_temp: vaccine ? vaccine.max_temp : 8.0,
    freeze_sensitive: vaccine ? vaccine.freeze_sensitive : 0,
    compatible_container_types: vaccine ? vaccine.compatible_container_types : []
  };

  // Check 1: Expiry validation
  const now = new Date();
  const expiryDate = new Date(batch.expiry_date);
  if (expiryDate < now) {
    const eventId = crypto.randomUUID();
    const nowStr = now.toISOString();
    await col('scan_events').insertOne({
      _id: eventId,
      id: eventId,
      user_id: userId,
      event_type: 'VACCINE_PICK',
      scanned_code: scannedCode,
      entity_type: 'BATCH',
      entity_id: batch.id || batch._id,
      status: 'EXPIRED',
      message: `CRITICAL: Batch ${batch.batch_number} expired on ${batch.expiry_date}. Dispensing blocked.`,
      timestamp: nowStr
    });

    await triggerAlert({
      alertType: 'WRONG_SCAN',
      severity: 'CRITICAL',
      entityType: 'BATCH',
      entityId: batch.id || batch._id,
      shipmentId,
      title: `Expired Vaccine Scan Attempt: ${batch.batch_number}`,
      message: `User attempted to pick expired batch ${batch.batch_number} (Expired: ${batch.expiry_date}). Dispensing automatically blocked.`,
      currentReading: `Expiry: ${batch.expiry_date}`
    });

    return {
      success: false,
      status: 'EXPIRED',
      message: `BLOCKED: Batch ${batch.batch_number} (${batchWithVaccine.vaccine_name}) expired on ${batch.expiry_date}. Dispensing strictly prohibited by regulatory compliance.`,
      batch: batchWithVaccine
    };
  }

  // Check 2: Near Expiry & FEFO (First-Expired, First-Out) Recommendation
  const daysToExpiry = Math.round((expiryDate - now) / (1000 * 60 * 60 * 24));
  const otherBatches = await col('batches')
    .find({
      vaccine_id: batch.vaccine_id,
      _id: { $ne: batch._id },
      expiry_date: { $gt: now.toISOString().slice(0, 10) },
      remaining_quantity: { $gt: 0 }
    })
    .sort({ expiry_date: 1 })
    .limit(1)
    .toArray();

  let fefoAdvice = null;
  if (otherBatches.length > 0) {
    const earlierBatch = otherBatches[0];
    if (new Date(earlierBatch.expiry_date) < expiryDate) {
      fefoAdvice = `FEFO Recommendation: Batch ${earlierBatch.batch_number} expires earlier (${earlierBatch.expiry_date}) than scanned batch (${batch.expiry_date}). Consider picking ${earlierBatch.batch_number} first to prevent warehouse stock expiration.`;
    }
  }

  // Update picked count on shipment items
  const currentShipmentId = shipment.id || shipment._id;
  const item = await col('shipment_items').findOne({
    shipment_id: currentShipmentId,
    vaccine_id: batch.vaccine_id
  });

  if (item) {
    const newQty = Math.min(item.quantity_requested, (item.quantity_picked || 0) + 10);
    const itemStatus = newQty >= item.quantity_requested ? 'PICKED' : 'PENDING';
    await col('shipment_items').updateOne(
      { _id: item._id },
      { $set: { quantity_picked: newQty, batch_id: batch.id || batch._id, status: itemStatus } }
    );
  }

  // Log successful scan event
  await col('scan_events').insertOne({
    _id: crypto.randomUUID(),
    id: crypto.randomUUID(),
    user_id: userId,
    event_type: 'VACCINE_PICK',
    scanned_code: scannedCode,
    entity_type: 'BATCH',
    entity_id: batch.id || batch._id,
    status: 'SUCCESS',
    message: `Successfully picked ${batchWithVaccine.vaccine_name} (Batch: ${batch.batch_number}).`,
    timestamp: new Date().toISOString()
  });

  // Check if all items in shipment are picked
  const pendingItems = await col('shipment_items')
    .find({ shipment_id: currentShipmentId, status: { $ne: 'PICKED' } })
    .toArray();

  if (pendingItems.length === 0) {
    await col('shipments').updateOne(
      { _id: shipment._id },
      { $set: { current_step: 'CONTAINER_ASSIGNMENT' } }
    );
  }

  return {
    success: true,
    status: 'SUCCESS',
    message: `Verified: ${batchWithVaccine.vaccine_name} (Batch: ${batch.batch_number}, Expires: ${batch.expiry_date}). ${fefoAdvice || ''}`,
    batch: batchWithVaccine,
    daysToExpiry,
    isNearExpiry: daysToExpiry <= 90,
    fefoAdvice,
    allPicked: pendingItems.length === 0
  };
}

/**
 * 2. SCAN & VALIDATE CONTAINER QR (Compatibility & Temperature check)
 */
export async function validateContainerScan({ shipmentId, scannedCode, userId }) {
  const shipment = await col('shipments').findOne({ $or: [{ _id: shipmentId }, { id: shipmentId }] });
  if (!shipment) throw new Error('Shipment not found.');

  // Find container by code or QR
  const container = await col('containers').findOne({
    $or: [{ container_code: scannedCode }, { qr_code: scannedCode }]
  });

  if (!container) {
    return {
      success: false,
      status: 'INVALID',
      message: `Container '${scannedCode}' not found. Please scan an authentic container QR code.`
    };
  }

  // Get required vaccines in this shipment
  const currentShipmentId = shipment.id || shipment._id;
  const items = await col('shipment_items').find({ shipment_id: currentShipmentId }).toArray();

  const vaccineIds = items.map(i => i.vaccine_id);
  const vaccines = await col('vaccines').find({
    $or: [{ _id: { $in: vaccineIds } }, { id: { $in: vaccineIds } }]
  }).toArray();

  // Check compatibility of container with ALL shipment vaccines
  for (const vaccine of vaccines) {
    const allowedTypes = Array.isArray(vaccine.compatible_container_types)
      ? vaccine.compatible_container_types
      : JSON.parse(vaccine.compatible_container_types || '[]');

    const isTypeCompatible = allowedTypes.includes(container.container_type);
    const isTempCompatible = container.min_temp <= vaccine.min_temp && container.max_temp >= vaccine.max_temp;
    const isCurrentTempValid = container.current_temp >= vaccine.min_temp && container.current_temp <= vaccine.max_temp;

    if (!isTypeCompatible || !isTempCompatible) {
      // Find compatible containers in depot
      const compatibleList = await col('containers')
        .find({
          status: 'AVAILABLE',
          min_temp: { $lte: vaccine.min_temp },
          max_temp: { $gte: vaccine.max_temp }
        })
        .toArray();

      const suggestions = compatibleList.map(c => `${c.container_code} (${c.container_type}, ${c.current_temp}°C)`).join(', ');

      // Record wrong scan event
      await col('scan_events').insertOne({
        _id: crypto.randomUUID(),
        id: crypto.randomUUID(),
        user_id: userId,
        event_type: 'CONTAINER_CHECK',
        scanned_code: scannedCode,
        expected_code: 'COMPATIBLE_CONTAINER',
        entity_type: 'CONTAINER',
        entity_id: container.id || container._id,
        status: 'INCOMPATIBLE',
        message: `Incompatible container ${container.container_code} scanned for ${vaccine.name}. Required: ${vaccine.min_temp}°C to ${vaccine.max_temp}°C.`,
        timestamp: new Date().toISOString()
      });

      await triggerAlert({
        alertType: 'WRONG_SCAN',
        severity: 'WARNING',
        entityType: 'CONTAINER',
        entityId: container.id || container._id,
        shipmentId: currentShipmentId,
        title: `Wrong Container Scanned: ${container.container_code}`,
        message: `Container ${container.container_code} (${container.min_temp}°C to ${container.max_temp}°C) cannot store ${vaccine.name} (Requires ${vaccine.min_temp}°C to ${vaccine.max_temp}°C). Guided recommendation: [${suggestions || 'None available'}]`,
        currentReading: `Container temp: ${container.current_temp}°C`
      });

      return {
        success: false,
        status: 'INCOMPATIBLE',
        message: `Wrong container! ${vaccine.name} requires ${vaccine.min_temp}°C to ${vaccine.max_temp}°C (${allowedTypes.join(', ')}). Scanned ${container.container_code} operates at ${container.min_temp}°C to ${container.max_temp}°C.`,
        guidance: `Please scan a compatible container: ${suggestions || 'Please alert warehouse manager to prep a compatible cold-box.'}`,
        compatibleContainers: compatibleList
      };
    }

    if (!isCurrentTempValid) {
      return {
        success: false,
        status: 'TEMP_OUT_OF_BOUNDS',
        message: `Container ${container.container_code} current temperature is ${container.current_temp}°C, which is outside required range (${vaccine.min_temp}°C - ${vaccine.max_temp}°C). Allow container to stabilize or choose another pre-cooled container.`,
        guidance: 'Check cooling unit power or select a pre-chilled container.'
      };
    }
  }

  // Container is valid and compatible!
  const containerIdStr = container.id || container._id;
  await col('shipments').updateOne(
    { _id: shipment._id },
    { $set: { container_id: containerIdStr, current_step: 'PUT_AWAY' } }
  );

  await col('containers').updateOne(
    { _id: container._id },
    { $set: { current_shipment_id: currentShipmentId, status: 'IN_USE' } }
  );

  const nowStr = new Date().toISOString();
  await col('checklists').updateOne(
    { shipment_id: currentShipmentId, item_key: 'container_scanned' },
    { $set: { passed: 1, verified_by: userId, verified_at: nowStr } }
  );

  await col('scan_events').insertOne({
    _id: crypto.randomUUID(),
    id: crypto.randomUUID(),
    user_id: userId,
    event_type: 'CONTAINER_CHECK',
    scanned_code: scannedCode,
    entity_type: 'CONTAINER',
    entity_id: containerIdStr,
    status: 'SUCCESS',
    message: `Compatible container ${container.container_code} validated.`,
    timestamp: nowStr
  });

  return {
    success: true,
    status: 'SUCCESS',
    message: `Compatible container ${container.container_code} verified! Operating range: ${container.min_temp}°C to ${container.max_temp}°C. Current temp: ${container.current_temp}°C. You may continue to Location Put-away.`,
    container
  };
}

/**
 * 3. LOCATION-VERIFIED PUT-AWAY
 */
export async function verifyLocationPutAway({ shipmentId, scannedLocationCode, expectedLocationId, userId }) {
  const scannedLoc = await col('storage_locations').findOne({
    $or: [{ code: scannedLocationCode }, { qr_code: scannedLocationCode }]
  });

  const expectedLoc = await col('storage_locations').findOne({
    $or: [{ _id: expectedLocationId }, { id: expectedLocationId }]
  });

  if (!scannedLoc) {
    return {
      success: false,
      status: 'INVALID',
      message: `Location QR '${scannedLocationCode}' not found.`
    };
  }

  const expectedIdStr = expectedLoc ? (expectedLoc.id || expectedLoc._id) : expectedLocationId;
  const scannedIdStr = scannedLoc.id || scannedLoc._id;

  if (scannedIdStr !== expectedIdStr) {
    await col('scan_events').insertOne({
      _id: crypto.randomUUID(),
      id: crypto.randomUUID(),
      user_id: userId,
      event_type: 'LOCATION_PUTAWAY',
      scanned_code: scannedLocationCode,
      expected_code: expectedLoc ? expectedLoc.code : expectedLocationId,
      entity_type: 'STORAGE_LOCATION',
      entity_id: scannedIdStr,
      status: 'MISMATCH',
      message: `Wrong location scanned: Expected ${expectedLoc ? expectedLoc.code : expectedLocationId} but scanned ${scannedLoc.code}.`,
      timestamp: new Date().toISOString()
    });

    return {
      success: false,
      status: 'MISMATCH',
      message: `Wrong location! Expected ${expectedLoc ? expectedLoc.code : expectedLocationId} (${expectedLoc?.cold_room}, ${expectedLoc?.rack}, ${expectedLoc?.slot}), but scanned ${scannedLoc.code}. Please place item in ${expectedLoc?.code || expectedLocationId} and scan its QR code.`,
      expected: expectedLoc,
      scanned: scannedLoc
    };
  }

  const shipment = await col('shipments').findOne({ $or: [{ _id: shipmentId }, { id: shipmentId }] });
  if (shipment) {
    await col('shipments').updateOne(
      { _id: shipment._id },
      { $set: { current_step: 'LOADING_CHECKLIST' } }
    );
  }

  await col('scan_events').insertOne({
    _id: crypto.randomUUID(),
    id: crypto.randomUUID(),
    user_id: userId,
    event_type: 'LOCATION_PUTAWAY',
    scanned_code: scannedLocationCode,
    entity_type: 'STORAGE_LOCATION',
    entity_id: scannedIdStr,
    status: 'SUCCESS',
    message: `Location ${scannedLoc.code} verified for put-away.`,
    timestamp: new Date().toISOString()
  });

  return {
    success: true,
    status: 'SUCCESS',
    message: `Location verified! Staged in ${scannedLoc.cold_room}, ${scannedLoc.rack}, ${scannedLoc.slot}. Proceeding to Digital Loading Checklist.`,
    location: scannedLoc
  };
}

/**
 * 4. UPDATE DIGITAL LOADING CHECKLIST ITEM
 */
export async function updateChecklistItem({ shipmentId, itemKey, passed, userId, notes = '' }) {
  const shipment = await col('shipments').findOne({ $or: [{ _id: shipmentId }, { id: shipmentId }] });
  const currentShipmentId = shipment ? (shipment.id || shipment._id) : shipmentId;
  const nowStr = new Date().toISOString();

  await col('checklists').updateOne(
    { shipment_id: currentShipmentId, item_key: itemKey },
    { $set: { passed: passed ? 1 : 0, verified_by: userId, verified_at: nowStr, notes } }
  );

  const items = await col('checklists').find({ shipment_id: currentShipmentId }).toArray();
  const allMandatoryPassed = items.filter(i => i.is_mandatory).every(i => i.passed === 1);

  if (allMandatoryPassed && shipment) {
    await col('shipments').updateOne(
      { _id: shipment._id },
      { $set: { current_step: 'DOOR_VERIFICATION', status: 'LOADED' } }
    );
  }

  return {
    items,
    allMandatoryPassed,
    nextStepUnlocked: allMandatoryPassed ? 'DOOR_VERIFICATION' : 'CHECKLIST_INCOMPLETE'
  };
}

/**
 * 5. VERIFICATION STAFF DOOR SEAL & PHOTO VERIFICATION
 */
export async function verifyDoorClosure({ shipmentId, proofFileId, userId }) {
  const shipment = await col('shipments').findOne({ $or: [{ _id: shipmentId }, { id: shipmentId }] });
  if (!shipment) throw new Error('Shipment not found.');

  const container = await col('containers').findOne({ $or: [{ _id: shipment.container_id }, { id: shipment.container_id }] });
  if (!container) throw new Error('Container not linked to shipment.');

  if (container.door_status !== 'CLOSED') {
    return {
      success: false,
      status: 'DOOR_STILL_OPEN',
      message: `VERIFICATION BLOCKED: Container door sensor currently reads '${container.door_status}'. Door must be physically latched and closed before verification can unlock.`
    };
  }

  const proof = await col('proof_files').findOne({ $or: [{ _id: proofFileId }, { id: proofFileId }] });
  if (!proof) {
    return {
      success: false,
      status: 'PHOTO_PROOF_REQUIRED',
      message: 'VERIFICATION BLOCKED: Timestamped camera photo proof of closed container latch is mandatory.'
    };
  }

  await col('shipments').updateOne(
    { _id: shipment._id },
    { $set: { current_step: 'DISPATCH_READY', status: 'DOOR_VERIFIED' } }
  );

  const nowStr = new Date().toISOString();
  await col('checklists').updateOne(
    { shipment_id: shipment.id || shipment._id, item_key: 'door_closed' },
    { $set: { passed: 1, verified_by: userId, verified_at: nowStr, proof_file_id: proofFileId } }
  );

  await logAuditEvent({
    userId,
    userRole: 'Verification Staff',
    action: 'DOOR_SEAL_VERIFIED',
    entityType: 'SHIPMENT',
    entityId: shipment.id || shipment._id,
    details: { containerId: container.id || container._id, proofFileId, doorStatus: container.door_status }
  });

  const updated = await col('shipments').findOne({ _id: shipment._id });

  return {
    success: true,
    status: 'SUCCESS',
    message: 'Door closure physically verified & documented with photo proof. Next Stage UNLOCKED: Ready for Dispatch!',
    shipment: updated
  };
}

/**
 * 6. DISPATCH SHIPMENT
 */
export async function dispatchShipment({ shipmentId, userId }) {
  const shipment = await col('shipments').findOne({ $or: [{ _id: shipmentId }, { id: shipmentId }] });
  if (!shipment) throw new Error('Shipment not found.');

  if (shipment.current_step !== 'DISPATCH_READY' && shipment.status !== 'DOOR_VERIFIED') {
    throw new Error(`Cannot dispatch shipment: Current stage is '${shipment.current_step}'. All preceding proof-gated verifications must pass first.`);
  }

  const nowStr = new Date().toISOString();
  await col('shipments').updateOne(
    { _id: shipment._id },
    { $set: { status: 'IN_TRANSIT', current_step: 'GPS_TRACKING', dispatched_at: nowStr } }
  );

  if (shipment.vehicle_id) {
    await col('vehicles').updateOne(
      { $or: [{ _id: shipment.vehicle_id }, { id: shipment.vehicle_id }] },
      { $set: { status: 'IN_TRANSIT' } }
    );
  }

  await logAuditEvent({
    userId,
    userRole: 'Warehouse/Driver',
    action: 'SHIPMENT_DISPATCHED',
    entityType: 'SHIPMENT',
    entityId: shipment.id || shipment._id,
    details: { shipmentNumber: shipment.shipment_number, vehicleId: shipment.vehicle_id }
  });

  return await col('shipments').findOne({ _id: shipment._id });
}

/**
 * 7. DRIVER DELIVERY PROOF SUBMISSION
 */
export async function submitDeliveryProof({
  shipmentId,
  receiverName,
  receiverPhone,
  receiverSignatureUrl,
  otpCode,
  gpsLatitude,
  gpsLongitude,
  destinationPhotoId,
  packagePhotoId,
  userId
}) {
  const shipment = await col('shipments').findOne({ $or: [{ _id: shipmentId }, { id: shipmentId }] });
  if (!shipment) throw new Error('Shipment not found.');

  const hospital = await col('hospitals').findOne({ $or: [{ _id: shipment.destination_hospital_id }, { id: shipment.destination_hospital_id }] });

  if (!destinationPhotoId || !packagePhotoId) {
    throw new Error('Mandatory delivery photos missing: Both destination facade and package delivery photos are required.');
  }

  if (!receiverName || (!receiverSignatureUrl && !otpCode)) {
    throw new Error('Receiver identity confirmation missing: Receiver name and either digital signature or OTP verification is mandatory.');
  }

  const destLat = hospital ? hospital.latitude : 13.0567;
  const destLng = hospital ? hospital.longitude : 80.2520;

  const dLat = (gpsLatitude - destLat) * Math.PI / 180;
  const dLon = (gpsLongitude - destLng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(destLat * Math.PI / 180) * Math.cos(gpsLatitude * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceMeters = Math.round(6371000 * c);

  const deliveryConfId = crypto.randomUUID();
  const nowStr = new Date().toISOString();

  await col('delivery_confirmations').insertOne({
    _id: deliveryConfId,
    id: deliveryConfId,
    shipment_id: shipment.id || shipment._id,
    receiver_name: receiverName,
    receiver_phone: receiverPhone,
    receiver_signature_url: receiverSignatureUrl,
    otp_code: otpCode || 'OTP-VERIFIED',
    otp_verified: 1,
    gps_latitude: gpsLatitude,
    gps_longitude: gpsLongitude,
    distance_from_hospital_meters: distanceMeters,
    destination_photo_id: destinationPhotoId,
    package_photo_id: packagePhotoId,
    confirmed_at: nowStr
  });

  await col('shipments').updateOne(
    { _id: shipment._id },
    { $set: { status: 'DELIVERED', current_step: 'HOSPITAL_VERIFICATION', delivered_at: nowStr } }
  );

  await logAuditEvent({
    userId,
    userRole: 'Driver',
    action: 'DELIVERY_PROOF_SUBMITTED',
    entityType: 'SHIPMENT',
    entityId: shipment.id || shipment._id,
    details: { receiverName, distanceMeters, deliveryConfId }
  });

  return {
    success: true,
    message: 'Delivery proof successfully verified and recorded! Forwarded to Hospital Receiving Portal.',
    deliveryConfirmationId: deliveryConfId,
    distanceMeters
  };
}

/**
 * 8. HOSPITAL RECEIVER ACCEPT / REJECT
 */
export async function recordHospitalDecision({ shipmentId, decision, rejectionReason = '', userId }) {
  const shipment = await col('shipments').findOne({ $or: [{ _id: shipmentId }, { id: shipmentId }] });
  if (!shipment) throw new Error('Shipment not found.');

  const isAccepted = decision === 'ACCEPT';
  const newStatus = isAccepted ? 'COMPLETED' : 'REJECTED';
  const nowStr = new Date().toISOString();

  await col('shipments').updateOne(
    { _id: shipment._id },
    { $set: { status: newStatus, current_step: newStatus, completed_at: nowStr } }
  );

  if (isAccepted && shipment.container_id) {
    await col('containers').updateOne(
      { $or: [{ _id: shipment.container_id }, { id: shipment.container_id }] },
      { $set: { status: 'AVAILABLE', current_shipment_id: null } }
    );
  }

  await logAuditEvent({
    userId,
    userRole: 'Hospital Receiver',
    action: `HOSPITAL_SHIPMENT_${decision}`,
    entityType: 'SHIPMENT',
    entityId: shipment.id || shipment._id,
    details: { decision, rejectionReason }
  });

  return await col('shipments').findOne({ _id: shipment._id });
}
