import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectMongo, getDb, col, closeMongo } from './mongo.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = process.env.DB_PATH || path.resolve(__dirname, '../../coldchain.db');

export let db = null;
try {
  db = new DatabaseSync(DB_PATH);
} catch (e) {
  console.warn('SQLite file reference warning:', e.message);
}

export function execute(sql, params = []) {
  if (!db) return;
  return db.prepare(sql).run(...params);
}

export function queryOne(sql, params = []) {
  if (!db) return null;
  return db.prepare(sql).get(...params);
}

export function queryAll(sql, params = []) {
  if (!db) return [];
  return db.prepare(sql).all(...params);
}

export function initSchema() {}

export { connectMongo, getDb, col, closeMongo };

export default {
  connectMongo,
  getDb,
  col,
  closeMongo
};
