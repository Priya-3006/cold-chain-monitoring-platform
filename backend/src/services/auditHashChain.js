import crypto from 'node:crypto';
import { col } from '../db/mongo.js';

const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Calculates SHA-256 hash for an audit ledger entry
 */
export function calculateHash(prevHash, timestamp, userId, userRole, action, entityType, entityId, detailsJson) {
  const content = `${prevHash}|${timestamp}|${userId || 'SYSTEM'}|${userRole || 'SYSTEM'}|${action}|${entityType}|${entityId}|${detailsJson || ''}`;
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Records a new immutable, tamper-evident audit record in the hash chain
 */
export async function logAuditEvent({
  userId = 'SYSTEM',
  userRole = 'SYSTEM',
  action,
  entityType,
  entityId,
  details = {}
}) {
  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const detailsJson = typeof details === 'string' ? details : JSON.stringify(details);

  // Get the latest block in chain
  const lastRecord = await col('audit_logs')
    .find({})
    .sort({ sequence_number: -1 })
    .limit(1)
    .next();

  const sequenceNumber = lastRecord ? lastRecord.sequence_number + 1 : 1;
  const prevHash = lastRecord ? lastRecord.current_hash : GENESIS_HASH;

  const currentHash = calculateHash(
    prevHash,
    timestamp,
    userId,
    userRole,
    action,
    entityType,
    entityId,
    detailsJson
  );

  const doc = {
    _id: id,
    id,
    sequence_number: sequenceNumber,
    timestamp,
    user_id: userId,
    user_role: userRole,
    action,
    entity_type: entityType,
    entity_id: entityId,
    details_json: detailsJson,
    prev_hash: prevHash,
    current_hash: currentHash
  };

  await col('audit_logs').insertOne(doc);

  return {
    id,
    sequenceNumber,
    timestamp,
    action,
    entityType,
    entityId,
    prevHash,
    currentHash
  };
}

/**
 * Verifies the integrity of the entire audit hash chain
 * Detects any tampering, deletion, or modified fields
 */
export async function verifyAuditIntegrity() {
  const logs = await col('audit_logs')
    .find({})
    .sort({ sequence_number: 1 })
    .toArray();

  if (logs.length === 0) {
    return {
      isValid: true,
      totalEntries: 0,
      message: 'Audit ledger is empty (Genesis state).'
    };
  }

  let expectedPrevHash = GENESIS_HASH;
  let expectedSeq = 1;

  for (let i = 0; i < logs.length; i++) {
    const entry = logs[i];

    // Check sequence continuity
    if (entry.sequence_number !== expectedSeq) {
      return {
        isValid: false,
        brokenAtSequence: entry.sequence_number,
        entryId: entry.id || entry._id,
        error: `Sequence gap detected: expected #${expectedSeq} but found #${entry.sequence_number}`
      };
    }

    // Check prev_hash pointer
    if (entry.prev_hash !== expectedPrevHash) {
      return {
        isValid: false,
        brokenAtSequence: entry.sequence_number,
        entryId: entry.id || entry._id,
        error: `Previous hash pointer mismatch at entry #${entry.sequence_number}. Data may have been tampered or deleted.`
      };
    }

    // Recalculate hash of this block
    const recalculatedHash = calculateHash(
      entry.prev_hash,
      entry.timestamp,
      entry.user_id,
      entry.user_role,
      entry.action,
      entry.entity_type,
      entry.entity_id,
      entry.details_json
    );

    if (entry.current_hash !== recalculatedHash) {
      return {
        isValid: false,
        brokenAtSequence: entry.sequence_number,
        entryId: entry.id || entry._id,
        error: `Tampering detected at entry #${entry.sequence_number}. Hash checksum invalid. Recalculated: ${recalculatedHash}, Stored: ${entry.current_hash}`
      };
    }

    expectedPrevHash = entry.current_hash;
    expectedSeq++;
  }

  return {
    isValid: true,
    totalEntries: logs.length,
    latestHash: expectedPrevHash,
    message: `All ${logs.length} audit entries verified successfully. Cryptographic chain is authentic and uncompromised.`
  };
}
