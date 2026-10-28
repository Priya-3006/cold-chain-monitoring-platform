import crypto from 'node:crypto';
import { col } from '../db/mongo.js';
import { logAuditEvent } from './auditHashChain.js';

/**
 * Creates or updates an active alert in the system
 * Enforces de-duplication, SOP association, and auto-assignment
 */
export async function triggerAlert({
  alertType,
  severity = 'WARNING',
  entityType,
  entityId,
  shipmentId = null,
  title,
  message,
  currentReading = null
}) {
  // 1. Check for existing active alert for this entity & type (De-duplication)
  const existing = await col('alerts')
    .find({
      entity_type: entityType,
      entity_id: entityId,
      alert_type: alertType,
      status: { $ne: 'RESOLVED' }
    })
    .sort({ created_at: -1 })
    .limit(1)
    .next();

  if (existing) {
    // Update existing active alert with latest reading
    await col('alerts').updateOne(
      { _id: existing._id },
      { $set: { current_reading: currentReading, message, severity } }
    );
    const updated = await col('alerts').findOne({ _id: existing._id });
    return { alert: updated, isNew: false };
  }

  // 2. Fetch corresponding SOP from library
  const sop = await col('sop_library').findOne({ alert_type: alertType });
  const sopId = sop ? (sop.id || sop._id) : null;
  const escalationMinutes = sop ? (sop.escalation_minutes || 30) : 30;

  // 3. Determine auto-assignment by role
  let assignedRole = 'Warehouse Employee';
  let assignedUserId = 'usr-warehouse';

  if (alertType === 'ROUTE_DEVIATION' || alertType === 'TRANSPORT_DELAY') {
    assignedRole = 'Driver';
    assignedUserId = 'usr-driver';
  } else if (alertType === 'DOOR_OPEN_TOO_LONG') {
    assignedRole = 'Verification Staff';
    assignedUserId = 'usr-verifier';
  } else if (severity === 'CRITICAL' || severity === 'EMERGENCY' || alertType === 'FREEZE_RISK') {
    assignedRole = 'Manager';
    assignedUserId = 'usr-manager';
  }

  const alertId = `alt-${crypto.randomUUID().slice(0, 8)}`;
  const alertCode = `ALT-${Date.now().toString().slice(-6)}`;
  const slaDeadline = new Date(Date.now() + escalationMinutes * 60000).toISOString();
  const createdAt = new Date().toISOString();

  const alertDoc = {
    _id: alertId,
    id: alertId,
    alert_code: alertCode,
    alert_type: alertType,
    severity,
    entity_type: entityType,
    entity_id: entityId,
    shipment_id: shipmentId,
    title,
    message,
    current_reading: currentReading,
    sop_id: sopId,
    status: 'ASSIGNED',
    assigned_user_id: assignedUserId,
    assigned_role: assignedRole,
    escalation_level: 1,
    sla_deadline: slaDeadline,
    created_at: createdAt
  };

  await col('alerts').insertOne(alertDoc);

  // 4. Send multi-channel notification (In-app real, SMS/WhatsApp/Email simulated)
  await dispatchNotifications({
    userId: assignedUserId,
    role: assignedRole,
    title: `[${severity}] ${title}`,
    body: `${message}. SOP: ${sop ? sop.title : 'Standard procedure'}. Current reading: ${currentReading || 'N/A'}`
  });

  // 5. Record in Tamper-Proof Audit Chain
  await logAuditEvent({
    userId: 'SYSTEM',
    userRole: 'Monitoring Engine',
    action: 'ALERT_TRIGGERED',
    entityType: 'ALERT',
    entityId: alertId,
    details: { alertCode, alertType, severity, entityType, entityId, currentReading }
  });

  const createdAlert = await col('alerts').findOne({ _id: alertId });
  return { alert: createdAlert, isNew: true };
}

/**
 * Multi-channel dispatch (In-App real + Simulated External Adapters)
 */
export async function dispatchNotifications({ userId, role, title, body }) {
  const sentAt = new Date().toISOString();

  await col('notifications').insertMany([
    {
      _id: crypto.randomUUID(),
      id: crypto.randomUUID(),
      user_id: userId,
      role,
      channel: 'IN_APP',
      title,
      body,
      is_read: 0,
      sent_at: sentAt
    },
    {
      _id: crypto.randomUUID(),
      id: crypto.randomUUID(),
      user_id: userId,
      role,
      channel: 'SMS_MOCK',
      title: `[SIMULATED SMS to +91-9840XXXXXX] ${title}`,
      body,
      is_read: 0,
      sent_at: sentAt
    },
    {
      _id: crypto.randomUUID(),
      id: crypto.randomUUID(),
      user_id: userId,
      role,
      channel: 'WHATSAPP_MOCK',
      title: `[SIMULATED WhatsApp] ${title}`,
      body,
      is_read: 0,
      sent_at: sentAt
    }
  ]);
}

/**
 * Workflow Action: Acknowledge Alert
 */
export async function acknowledgeAlert(alertId, userId) {
  const alert = await col('alerts').findOne({ $or: [{ _id: alertId }, { id: alertId }] });
  if (!alert) throw new Error('Alert not found.');

  const now = new Date().toISOString();
  await col('alerts').updateOne(
    { _id: alert._id },
    { $set: { status: 'ACKNOWLEDGED', acknowledged_at: now } }
  );

  await logAuditEvent({
    userId,
    userRole: 'Operator',
    action: 'ALERT_ACKNOWLEDGED',
    entityType: 'ALERT',
    entityId: alert.id || alert._id,
    details: { alertCode: alert.alert_code }
  });

  return await col('alerts').findOne({ _id: alert._id });
}

/**
 * Workflow Action: Record Action Taken with Root Cause & Proof
 */
export async function recordAlertAction({ alertId, userId, actionTaken, rootCause, proofFileId = null, notes = '' }) {
  const alert = await col('alerts').findOne({ $or: [{ _id: alertId }, { id: alertId }] });
  if (!alert) throw new Error('Alert not found.');

  const actionId = crypto.randomUUID();
  const now = new Date().toISOString();

  await col('alert_actions').insertOne({
    _id: actionId,
    id: actionId,
    alert_id: alert.id || alert._id,
    user_id: userId,
    action_taken: actionTaken,
    root_cause: rootCause,
    proof_file_id: proofFileId,
    notes,
    timestamp: now
  });

  await col('alerts').updateOne(
    { _id: alert._id },
    { $set: { status: 'ACTION_TAKEN', action_taken_at: now } }
  );

  await logAuditEvent({
    userId,
    userRole: 'Staff',
    action: 'ALERT_ACTION_TAKEN',
    entityType: 'ALERT',
    entityId: alert.id || alert._id,
    details: { actionTaken, rootCause, proofFileId }
  });

  return await col('alerts').findOne({ _id: alert._id });
}

/**
 * Workflow Action: Resolve Alert
 */
export async function resolveAlert(alertId, userId, resolutionNotes = '') {
  const alert = await col('alerts').findOne({ $or: [{ _id: alertId }, { id: alertId }] });
  if (!alert) throw new Error('Alert not found.');

  const now = new Date().toISOString();
  await col('alerts').updateOne(
    { _id: alert._id },
    { $set: { status: 'RESOLVED', resolved_at: now, resolved_by: userId } }
  );

  await logAuditEvent({
    userId,
    userRole: 'Supervisor/Manager',
    action: 'ALERT_RESOLVED',
    entityType: 'ALERT',
    entityId: alert.id || alert._id,
    details: { alertCode: alert.alert_code, resolutionNotes }
  });

  return await col('alerts').findOne({ _id: alert._id });
}

/**
 * SLA Escalation Evaluator
 * Runs periodically to check overdue alerts and escalate: Operator -> Supervisor -> Manager
 */
export async function checkAndEscalateAlerts() {
  const now = new Date().toISOString();
  const overdueAlerts = await col('alerts')
    .find({
      status: { $in: ['ASSIGNED', 'ACKNOWLEDGED'] },
      sla_deadline: { $ne: null, $lt: now },
      escalation_level: { $lt: 3 }
    })
    .toArray();

  const escalated = [];

  for (const alert of overdueAlerts) {
    const nextLevel = alert.escalation_level + 1;
    let nextRole = nextLevel === 2 ? 'Verification Supervisor' : 'Operations Manager';
    let nextUser = nextLevel === 2 ? 'usr-verifier' : 'usr-manager';

    const newDeadline = new Date(Date.now() + 15 * 60000).toISOString();
    const newSeverity = alert.severity === 'WARNING' ? 'CRITICAL' : alert.severity;

    await col('alerts').updateOne(
      { _id: alert._id },
      {
        $set: {
          escalation_level: nextLevel,
          assigned_role: nextRole,
          assigned_user_id: nextUser,
          sla_deadline: newDeadline,
          severity: newSeverity
        }
      }
    );

    await dispatchNotifications({
      userId: nextUser,
      role: nextRole,
      title: `[ESCALATION L${nextLevel}] Alert ${alert.alert_code} Overdue!`,
      body: `Alert '${alert.title}' breached SLA deadline. Escalated to ${nextRole}. Immediate intervention required.`
    });

    await logAuditEvent({
      userId: 'SYSTEM',
      userRole: 'Escalation Engine',
      action: `ALERT_ESCALATED_L${nextLevel}`,
      entityType: 'ALERT',
      entityId: alert.id || alert._id,
      details: { previousLevel: alert.escalation_level, nextLevel, nextRole }
    });

    escalated.push(alert.id || alert._id);
  }

  return escalated;
}
