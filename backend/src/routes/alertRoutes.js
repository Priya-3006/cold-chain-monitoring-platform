import express from 'express';
import crypto from 'node:crypto';
import { col } from '../db/mongo.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import {
  acknowledgeAlert,
  recordAlertAction,
  resolveAlert
} from '../services/alertEngine.js';
import { logAuditEvent } from '../services/auditHashChain.js';

const router = express.Router();
router.use(authenticateToken);

/**
 * GET /api/alerts
 * List all alerts with SOP linkage and escalation status
 */
router.get('/', async (req, res) => {
  try {
    const { status, severity } = req.query;
    const query = {};

    if (status) query.status = status;
    if (severity) query.severity = severity;

    const alerts = await col('alerts')
      .find(query)
      .sort({ created_at: -1 })
      .toArray();

    const formatted = [];
    for (const a of alerts) {
      const alertIdStr = a.id || a._id;
      const sop = a.sop_id
        ? await col('sop_library').findOne({ $or: [{ _id: a.sop_id }, { id: a.sop_id }] })
        : null;

      const assignedUser = a.assigned_user_id
        ? await col('users').findOne({ $or: [{ _id: a.assigned_user_id }, { id: a.assigned_user_id }] })
        : null;

      const resolvedUser = a.resolved_by
        ? await col('users').findOne({ $or: [{ _id: a.resolved_by }, { id: a.resolved_by }] })
        : null;

      formatted.push({
        ...a,
        id: alertIdStr,
        sop_title: sop ? sop.title : null,
        trigger_condition: sop ? sop.trigger_condition : null,
        root_cause_category: sop ? sop.root_cause_category : null,
        required_proof_type: sop ? sop.required_proof_type : null,
        assigned_user_name: assignedUser ? assignedUser.name : null,
        resolved_by_name: resolvedUser ? resolvedUser.name : null,
        sop_steps: sop
          ? (Array.isArray(sop.step_by_step_instructions)
              ? sop.step_by_step_instructions
              : JSON.parse(sop.step_by_step_instructions || '[]'))
          : []
      });
    }

    res.json({ alerts: formatted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/alerts/:id/details
 * Detailed alert view with incident history and recorded actions
 */
router.get('/:id/details', async (req, res) => {
  try {
    const alertIdParam = req.params.id;
    const alert = await col('alerts').findOne({
      $or: [{ _id: alertIdParam }, { id: alertIdParam }]
    });

    if (!alert) return res.status(404).json({ error: 'Alert not found.' });

    const alertIdStr = alert.id || alert._id;
    const sop = alert.sop_id
      ? await col('sop_library').findOne({ $or: [{ _id: alert.sop_id }, { id: alert.sop_id }] })
      : null;

    const assignedUser = alert.assigned_user_id
      ? await col('users').findOne({ $or: [{ _id: alert.assigned_user_id }, { id: alert.assigned_user_id }] })
      : null;

    const resolvedUser = alert.resolved_by
      ? await col('users').findOne({ $or: [{ _id: alert.resolved_by }, { id: alert.resolved_by }] })
      : null;

    const rawActions = await col('alert_actions')
      .find({ alert_id: alertIdStr })
      .sort({ timestamp: -1 })
      .toArray();

    const actions = [];
    for (const act of rawActions) {
      const user = await col('users').findOne({ $or: [{ _id: act.user_id }, { id: act.user_id }] });
      const proof = act.proof_file_id
        ? await col('proof_files').findOne({ $or: [{ _id: act.proof_file_id }, { id: act.proof_file_id }] })
        : null;

      actions.push({
        ...act,
        id: act.id || act._id,
        user_name: user ? user.name : 'Unknown',
        file_path: proof ? proof.file_path : null,
        original_name: proof ? proof.original_name : null
      });
    }

    const excursionDecision = await col('excursion_decisions').findOne({ alert_id: alertIdStr });
    let decisionFormatted = null;
    if (excursionDecision) {
      const decUser = excursionDecision.decided_by
        ? await col('users').findOne({ $or: [{ _id: excursionDecision.decided_by }, { id: excursionDecision.decided_by }] })
        : null;
      decisionFormatted = {
        ...excursionDecision,
        id: excursionDecision.id || excursionDecision._id,
        decided_by_name: decUser ? decUser.name : null
      };
    }

    res.json({
      alert: {
        ...alert,
        id: alertIdStr,
        sop_title: sop ? sop.title : null,
        trigger_condition: sop ? sop.trigger_condition : null,
        root_cause_category: sop ? sop.root_cause_category : null,
        required_proof_type: sop ? sop.required_proof_type : null,
        assigned_user_name: assignedUser ? assignedUser.name : null,
        resolved_by_name: resolvedUser ? resolvedUser.name : null,
        sop_steps: sop
          ? (Array.isArray(sop.step_by_step_instructions)
              ? sop.step_by_step_instructions
              : JSON.parse(sop.step_by_step_instructions || '[]'))
          : []
      },
      actions,
      excursionDecision: decisionFormatted
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/alerts/:id/acknowledge
 */
router.post('/:id/acknowledge', async (req, res) => {
  try {
    const updated = await acknowledgeAlert(req.params.id, req.user.id);
    res.json({ message: 'Alert acknowledged', alert: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/alerts/:id/action
 * Submit action taken with root cause and optional proof file
 */
router.post('/:id/action', async (req, res) => {
  try {
    const { actionTaken, rootCause, proofFileId, notes } = req.body;
    if (!actionTaken || !rootCause) {
      return res.status(400).json({ error: 'actionTaken and rootCause are required.' });
    }

    const updated = await recordAlertAction({
      alertId: req.params.id,
      userId: req.user.id,
      actionTaken,
      rootCause,
      proofFileId,
      notes
    });

    res.json({ message: 'Action recorded successfully', alert: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/alerts/:id/resolve
 * Resolve alert (requires Supervisor, Manager, or Admin)
 */
router.post('/:id/resolve', requireRole(['Manager', 'Verification Staff', 'Admin']), async (req, res) => {
  try {
    const { notes } = req.body;
    const updated = await resolveAlert(req.params.id, req.user.id, notes);
    res.json({ message: 'Alert resolved successfully', alert: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/alerts/:id/excursion-decision
 * Manager Excursion Decision (Safe to Use / Quarantine / Discard)
 */
router.post('/:id/excursion-decision', requireRole(['Manager', 'Admin']), async (req, res) => {
  try {
    const { batchId, shipmentId, mkt, outOfRangeSecs, recommendation, managerDecision, reasoning } = req.body;

    const id = crypto.randomUUID();
    const nowStr = new Date().toISOString();

    await col('excursion_decisions').insertOne({
      _id: id,
      id,
      alert_id: req.params.id,
      batch_id: batchId,
      shipment_id: shipmentId || null,
      mkt_at_decision: mkt || 4.5,
      cumulative_out_of_range_secs: outOfRangeSecs || 0,
      recommendation: recommendation || 'QUARANTINE',
      manager_decision: managerDecision,
      reasoning: reasoning || 'Approved per stability protocol',
      decided_by: req.user.id,
      decided_at: nowStr
    });

    let safetyStatus = 'SAFE';
    if (managerDecision === 'APPROVED_QUARANTINE') safetyStatus = 'QUARANTINE';
    if (managerDecision === 'APPROVED_DISCARD') safetyStatus = 'DISCARD';

    await col('batches').updateOne(
      { $or: [{ _id: batchId }, { id: batchId }] },
      { $set: { safety_status: safetyStatus } }
    );

    await logAuditEvent({
      userId: req.user.id,
      userRole: req.user.role,
      action: 'EXCURSION_DECISION_SUBMITTED',
      entityType: 'EXCURSION_DECISION',
      entityId: id,
      details: { batchId, managerDecision, safetyStatus }
    });

    res.json({ message: 'Excursion decision recorded and batch safety status updated.', decisionId: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
