import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { connectMongo, closeMongo } from './mongo.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = process.env.DB_PATH || path.resolve(__dirname, '../../coldchain.db');

export async function migrateSqliteToMongo() {
  console.log('==================================================================');
  console.log('🚀 STARTING SQLITE TO MONGODB AUTOMATED DATA MIGRATION');
  console.log('==================================================================');
  console.log(`📁 Source SQLite DB Path: ${DB_PATH}`);

  if (!fs.existsSync(DB_PATH)) {
    console.error(`❌ SQLite database file not found at: ${DB_PATH}`);
    throw new Error(`SQLite database file not found at ${DB_PATH}`);
  }

  const sqliteDb = new DatabaseSync(DB_PATH);
  const mongoDb = await connectMongo();

  const tables = [
    'roles', 'users', 'warehouses', 'storage_locations', 'hospitals',
    'vaccines', 'batches', 'containers', 'container_vaccines', 'vehicles',
    'shipments', 'shipment_items', 'proof_files', 'temperature_logs',
    'gps_logs', 'sensor_logs', 'scan_events', 'sop_library', 'alerts',
    'alert_actions', 'checklists', 'delivery_confirmations',
    'excursion_decisions', 'notifications', 'chat_logs', 'audit_logs'
  ];

  const migrationSummary = {};

  for (const table of tables) {
    try {
      const rows = sqliteDb.prepare(`SELECT * FROM ${table}`).all();
      if (!rows || rows.length === 0) {
        migrationSummary[table] = { sqliteCount: 0, migratedCount: 0, status: 'EMPTY_IN_SQLITE' };
        console.log(`[${table}] 0 records found in SQLite.`);
        continue;
      }

      const collection = mongoDb.collection(table);
      const bulkOps = rows.map(row => {
        const id = row.id || row.code || (row.sequence_number !== undefined ? row.sequence_number.toString() : crypto.randomUUID());
        const doc = {
          ...row,
          _id: id,
          id: id
        };

        return {
          updateOne: {
            filter: { _id: doc._id },
            update: { $set: doc },
            upsert: true
          }
        };
      });

      const result = await collection.bulkWrite(bulkOps);
      const count = (result.upsertedCount || 0) + (result.modifiedCount || 0) + (result.matchedCount || 0);
      migrationSummary[table] = {
        sqliteCount: rows.length,
        migratedCount: count,
        upserted: result.upsertedCount || 0,
        modified: result.modifiedCount || 0,
        matched: result.matchedCount || 0,
        status: 'SUCCESS'
      };
      console.log(`✓ [${table}] Migrated ${rows.length} SQLite records -> MongoDB collection '${table}' (Total documents matched/upserted: ${count}).`);
    } catch (err) {
      console.error(`❌ Error migrating collection '${table}':`, err.message);
      migrationSummary[table] = { sqliteCount: 0, migratedCount: 0, status: `ERROR: ${err.message}` };
    }
  }

  console.log('==================================================================');
  console.log('🎉 SQLITE TO MONGODB MIGRATION COMPLETE SUMMARY REPORT:');
  console.log(JSON.stringify(migrationSummary, null, 2));
  console.log('==================================================================');

  return migrationSummary;
}

// Allow direct CLI execution: node src/db/migrateSqliteToMongo.js
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` || process.argv[1].endsWith('migrateSqliteToMongo.js')) {
  migrateSqliteToMongo().then(() => {
    closeMongo().then(() => process.exit(0));
  }).catch(err => {
    console.error('Migration execution failed:', err);
    process.exit(1);
  });
}
