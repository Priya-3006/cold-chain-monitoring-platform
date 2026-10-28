import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/coldchain';
const DB_NAME = process.env.DB_NAME || 'coldchain';

let client = null;
let db = null;

/**
 * Connects to MongoDB Atlas / local database
 */
export async function connectMongo() {
  if (db) return db;

  try {
    client = new MongoClient(MONGODB_URI, {
      maxPoolSize: 20,
      serverSelectionTimeoutMS: 5000,
    });

    await client.connect();
    db = client.db(DB_NAME);
    console.log(`--- Connected to MongoDB Database: '${DB_NAME}' ---`);

    await createMongoIndexes();
    return db;
  } catch (err) {
    console.error('MongoDB Connection Error:', err);
    throw err;
  }
}

/**
 * Gets active MongoDB database instance
 */
export function getDb() {
  if (!db) {
    throw new Error('MongoDB not initialized. Call connectMongo() before accessing database.');
  }
  return db;
}

/**
 * Convenience helper to get a typed collection
 */
export function col(collectionName) {
  return getDb().collection(collectionName);
}

/**
 * Creates MongoDB indexes for high-frequency queries
 */
export async function createMongoIndexes() {
  try {
    const database = getDb();

    // 1. Users
    await database.collection('users').createIndex({ email: 1 }, { unique: true });
    await database.collection('users').createIndex({ employee_id: 1 }, { unique: true });

    // 2. Vaccines & Batches
    await database.collection('vaccines').createIndex({ vaccine_code: 1 }, { unique: true });
    await database.collection('batches').createIndex({ batch_number: 1 }, { unique: true });
    await database.collection('batches').createIndex({ vaccine_id: 1 });

    // 3. Containers & Storage Locations
    await database.collection('containers').createIndex({ container_code: 1 }, { unique: true });
    await database.collection('containers').createIndex({ qr_code: 1 }, { unique: true });
    await database.collection('storage_locations').createIndex({ code: 1 }, { unique: true });
    await database.collection('storage_locations').createIndex({ qr_code: 1 }, { unique: true });

    // 4. Vehicles & Hospitals
    await database.collection('vehicles').createIndex({ vehicle_number: 1 }, { unique: true });
    await database.collection('hospitals').createIndex({ code: 1 }, { unique: true });

    // 5. Shipments
    await database.collection('shipments').createIndex({ shipment_number: 1 }, { unique: true });
    await database.collection('shipments').createIndex({ status: 1 });
    await database.collection('shipments').createIndex({ driver_id: 1 });
    await database.collection('shipment_items').createIndex({ shipment_id: 1 });

    // 6. Alerts & SOPs
    await database.collection('alerts').createIndex({ alert_code: 1 }, { unique: true });
    await database.collection('alerts').createIndex({ status: 1, severity: 1 });
    await database.collection('alerts').createIndex({ entity_id: 1, entity_type: 1 });
    await database.collection('sop_library').createIndex({ alert_type: 1 }, { unique: true });

    // 7. Telemetry Collections
    await database.collection('temperature_logs').createIndex({ entity_id: 1, timestamp: -1 });
    await database.collection('gps_logs').createIndex({ vehicle_id: 1, timestamp: -1 });
    await database.collection('sensor_logs').createIndex({ entity_id: 1 });

    // 8. Audit & Events
    await database.collection('audit_logs').createIndex({ sequence_number: 1 }, { unique: true });
    await database.collection('scan_events').createIndex({ timestamp: -1 });
    await database.collection('checklists').createIndex({ shipment_id: 1 });

    console.log('--- MongoDB Indexes Initialized Successfully ---');
  } catch (err) {
    console.warn('Index creation warning (indexes may already exist):', err.message);
  }
}

/**
 * Helper to close connection
 */
export async function closeMongo() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

export default {
  connectMongo,
  getDb,
  col,
  closeMongo
};
