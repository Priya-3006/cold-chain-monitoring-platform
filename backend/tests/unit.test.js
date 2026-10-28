import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateMKT, calculateExcursionStats, evaluateExcursionSafety, calculateShipmentRiskScore } from '../src/services/safetyAnalytics.js';
import { logAuditEvent, verifyAuditIntegrity, calculateHash } from '../src/services/auditHashChain.js';
import { scanVaccineBarcode, validateContainerScan, verifyLocationPutAway, verifyDoorClosure, submitDeliveryProof } from '../src/services/workflowEngine.js';
import { triggerAlert, checkAndEscalateAlerts } from '../src/services/alertEngine.js';
import { connectMongo, col } from '../src/db/mongo.js';
import { seedDatabase } from '../src/db/seed.js';
import { migrateSqliteToMongo } from '../src/db/migrateSqliteToMongo.js';

test.before(async () => {
  await seedDatabase();
  await connectMongo();
  await migrateSqliteToMongo();
});

test('1. Mean Kinetic Temperature (MKT) - Arrhenius Kinetics Calculation', () => {
  // Constant temperature 5.0 C should yield MKT = 5.0 C
  const stableTemps = [5.0, 5.0, 5.0, 5.0, 5.0];
  const mktStable = calculateMKT(stableTemps);
  assert.equal(mktStable, 5.0);

  // Fluctuating temperatures with spike: MKT is weighted exponentially higher than arithmetic mean
  const fluctuating = [2.0, 4.0, 6.0, 12.0, 15.0];
  const arithmeticMean = fluctuating.reduce((a, b) => a + b, 0) / fluctuating.length; // 7.8 C
  const mkt = calculateMKT(fluctuating);

  // By Arrhenius equation, higher temperatures contribute exponentially more degradation
  assert.ok(mkt > arithmeticMean, `MKT (${mkt}) must be greater than arithmetic mean (${arithmeticMean})`);
  assert.ok(mkt > 7.8 && mkt < 13.0, `Calculated MKT ${mkt} within expected thermodynamic range`);
});

test('2. Product-Safety Logic - Freeze Sensitivity & Excursion Recommendations', () => {
  // Freeze-sensitive vaccine hitting sub-zero
  const freezeResult = evaluateExcursionSafety({
    mkt: 3.5,
    timeOutOfRangeSeconds: 600,
    isFreezeSensitive: true,
    minAllowedTemp: 2.0,
    maxAllowedTemp: 8.0,
    lowestTempEncountered: -1.2,
    highestTempEncountered: 5.0
  });
  assert.equal(freezeResult.recommendation, 'DISCARD');
  assert.ok(freezeResult.reasoning.includes('Freeze-sensitive vaccine experienced sub-zero'));

  // Minor transient heat excursion within stability margin
  const transientResult = evaluateExcursionSafety({
    mkt: 6.2,
    timeOutOfRangeSeconds: 1200, // 20 min
    isFreezeSensitive: false,
    minAllowedTemp: 2.0,
    maxAllowedTemp: 8.0,
    lowestTempEncountered: 3.0,
    highestTempEncountered: 9.5
  });
  assert.equal(transientResult.recommendation, 'SAFE_TO_USE');

  // Prolonged severe heat excursion
  const severeResult = evaluateExcursionSafety({
    mkt: 18.5,
    timeOutOfRangeSeconds: 18000, // 5 hours
    isFreezeSensitive: false,
    minAllowedTemp: 2.0,
    maxAllowedTemp: 8.0,
    lowestTempEncountered: 4.0,
    highestTempEncountered: 27.0
  });
  assert.equal(severeResult.recommendation, 'DISCARD');
});

test('3. Container Compatibility Validation - Rejects Incompatible & Guides User', async () => {
  // VC1024 contains Covaxin & Covishield (2 to 8 C).
  // Attempt to scan C003 (Ultra-Cold -80 to -60 C)
  const result = await validateContainerScan({
    shipmentId: 'shp-vc1024',
    scannedCode: 'CONT-C003',
    userId: 'usr-warehouse'
  });

  assert.equal(result.success, false);
  assert.equal(result.status, 'INCOMPATIBLE');
  assert.ok(result.message.includes('Wrong container'));
  assert.ok(result.guidance.includes('compatible container'));
  assert.ok(result.compatibleContainers.length > 0, 'Must guide user with list of compatible containers');

  // Now scan compatible container C015 (2 to 8 C)
  const validResult = await validateContainerScan({
    shipmentId: 'shp-vc1024',
    scannedCode: 'CONT-C015',
    userId: 'usr-warehouse'
  });
  assert.equal(validResult.success, true);
  assert.equal(validResult.status, 'SUCCESS');
  assert.ok(validResult.message.includes('verified'));
});

test('4. Warehouse Location Put-Away Validation', async () => {
  const expectedLocId = 'loc-chn-cra-r01-s01'; // CHN-CR-A-R01-S01

  // Wrong location scan
  const mismatchResult = await verifyLocationPutAway({
    shipmentId: 'shp-vc1024',
    scannedLocationCode: 'LOC-CHN-CR-A-R01-S02',
    expectedLocationId: expectedLocId,
    userId: 'usr-warehouse'
  });
  assert.equal(mismatchResult.success, false);
  assert.equal(mismatchResult.status, 'MISMATCH');
  assert.ok(mismatchResult.message.includes('Expected CHN-CR-A-R01-S01'));

  // Correct location scan
  const correctResult = await verifyLocationPutAway({
    shipmentId: 'shp-vc1024',
    scannedLocationCode: 'LOC-CHN-CR-A-R01-S01',
    expectedLocationId: expectedLocId,
    userId: 'usr-warehouse'
  });
  assert.equal(correctResult.success, true);
  assert.equal(correctResult.status, 'SUCCESS');
  assert.ok(correctResult.message.includes('Location verified'));
});

test('5. Proof-Gating Rules - Verification Staff Door Closure', async () => {
  // Test A: Door is OPEN -> blocked even if photo is provided
  await col('containers').updateOne(
    { $or: [{ _id: 'cnt-c015' }, { id: 'cnt-c015' }] },
    { $set: { door_status: 'OPEN' } }
  );

  // Create dummy proof file
  const proofId = 'test-proof-photo';
  await col('proof_files').updateOne(
    { $or: [{ _id: proofId }, { id: proofId }] },
    { $set: { _id: proofId, id: proofId, file_path: '/uploads/test.jpg', file_type: 'PHOTO_DOOR', uploaded_by: 'usr-verifier' } },
    { upsert: true }
  );

  const blockedResult = await verifyDoorClosure({
    shipmentId: 'shp-vc1024',
    proofFileId: proofId,
    userId: 'usr-verifier'
  });
  assert.equal(blockedResult.success, false);
  assert.equal(blockedResult.status, 'DOOR_STILL_OPEN');

  // Test B: Door is CLOSED, but photo is missing -> blocked
  await col('containers').updateOne(
    { $or: [{ _id: 'cnt-c015' }, { id: 'cnt-c015' }] },
    { $set: { door_status: 'CLOSED' } }
  );
  const missingPhotoResult = await verifyDoorClosure({
    shipmentId: 'shp-vc1024',
    proofFileId: 'non-existent-proof',
    userId: 'usr-verifier'
  });
  assert.equal(missingPhotoResult.success, false);
  assert.equal(missingPhotoResult.status, 'PHOTO_PROOF_REQUIRED');

  // Test C: Door is CLOSED AND Photo is provided -> UNLOCKS next stage!
  const unlockedResult = await verifyDoorClosure({
    shipmentId: 'shp-vc1024',
    proofFileId: proofId,
    userId: 'usr-verifier'
  });
  assert.equal(unlockedResult.success, true);
  assert.equal(unlockedResult.status, 'SUCCESS');
  assert.equal(unlockedResult.shipment.status, 'DOOR_VERIFIED');
});

test('6. Tamper-Evident SHA-256 Audit Chain Integrity & Tamper Detection', async () => {
  // Step 1: Initial chain should be 100% valid
  const initialVerification = await verifyAuditIntegrity();
  assert.equal(initialVerification.isValid, true);
  assert.ok(initialVerification.totalEntries > 0);

  // Step 2: Log a new event
  const newEntry = await logAuditEvent({
    userId: 'usr-admin',
    userRole: 'Admin',
    action: 'TEST_TAMPER_AUDIT_ACTION',
    entityType: 'CONTAINER',
    entityId: 'cnt-c015',
    details: { test: true }
  });
  assert.ok(newEntry.currentHash);

  // Step 3: Verify chain is still valid
  const postLogVerification = await verifyAuditIntegrity();
  assert.equal(postLogVerification.isValid, true);

  // Step 4: Simulate malicious tampering in database
  await col('audit_logs').updateOne(
    { $or: [{ _id: newEntry.id }, { id: newEntry.id }] },
    { $set: { action: 'MALICIOUS_TAMPERED_ACTION' } }
  );

  // Step 5: Verify integrity detects tampering!
  const tamperedVerification = await verifyAuditIntegrity();
  assert.equal(tamperedVerification.isValid, false);
  assert.ok(tamperedVerification.error.includes('Tampering detected'));

  // Step 6: Restore correct action for subsequent tests
  await col('audit_logs').updateOne(
    { $or: [{ _id: newEntry.id }, { id: newEntry.id }] },
    { $set: { action: 'TEST_TAMPER_AUDIT_ACTION' } }
  );
  const restoredVerification = await verifyAuditIntegrity();
  assert.equal(restoredVerification.isValid, true);
});

test('7. Alert Engine - Triggering, Deduplication, and SLA Escalation', async () => {
  // Clear any pre-existing seeded alerts for cnt-c015 to test fresh alert creation
  await col('alerts').deleteMany({ entity_id: 'cnt-c015' });

  // Trigger alert
  const alert1 = await triggerAlert({
    alertType: 'TEMP_HIGH',
    severity: 'CRITICAL',
    entityType: 'CONTAINER',
    entityId: 'cnt-c015',
    title: 'High Temp Alert',
    message: '9.2 C reached',
    currentReading: '9.2 C'
  });
  assert.ok(alert1.alert);

  // Trigger same alert again -> should update reading rather than duplicate
  const alert2 = await triggerAlert({
    alertType: 'TEMP_HIGH',
    severity: 'CRITICAL',
    entityType: 'CONTAINER',
    entityId: 'cnt-c015',
    title: 'High Temp Alert',
    message: '9.5 C reached',
    currentReading: '9.5 C'
  });
  assert.equal(alert2.isNew, false);
  assert.equal(alert1.alert.id, alert2.alert.id);

  const targetAlertId = alert1.alert.id || alert1.alert._id;

  // Force SLA deadline into the past to test escalation
  await col('alerts').updateOne(
    { $or: [{ _id: targetAlertId }, { id: targetAlertId }] },
    { $set: { sla_deadline: new Date(Date.now() - 600000).toISOString(), status: 'ASSIGNED', escalation_level: 1 } }
  );

  const escalated = await checkAndEscalateAlerts();
  assert.ok(escalated.includes(targetAlertId), 'Alert must be escalated when SLA breaches');

  const escalatedAlert = await col('alerts').findOne({ $or: [{ _id: targetAlertId }, { id: targetAlertId }] });
  assert.equal(escalatedAlert.escalation_level, 2);
  assert.equal(escalatedAlert.assigned_role, 'Verification Supervisor');
});
