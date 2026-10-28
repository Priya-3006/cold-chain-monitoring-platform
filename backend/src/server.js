import express from 'express';
import http from 'node:http';
import path from 'node:path';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';

dotenv.config();

import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import warehouseRoutes from './routes/warehouseRoutes.js';
import monitoringRoutes from './routes/monitoringRoutes.js';
import alertRoutes from './routes/alertRoutes.js';
import shipmentRoutes from './routes/shipmentRoutes.js';
import traceabilityRoutes from './routes/traceabilityRoutes.js';
import simulatorRoutes from './routes/simulatorRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';

import { initWebSocketServer, broadcast } from './websocket/socketServer.js';
import { startSimulator, registerBroadcastCallback } from './services/simulatorService.js';
import { checkAndEscalateAlerts } from './services/alertEngine.js';
import { connectMongo } from './db/mongo.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// Middlewares
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Static proof uploads directory
const uploadsDir = path.resolve(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsDir));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'HEALTHY',
    service: 'Smart Cold-Chain Platform Core API',
    database: 'MongoDB Atlas / Local',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Mount Module Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/warehouse', warehouseRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/shipments', shipmentRoutes);
app.use('/api/traceability', traceabilityRoutes);
app.use('/api/simulator', simulatorRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/upload', uploadRoutes);

// Global Express Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled API Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'An unexpected internal server error occurred.'
  });
});

async function startServer() {
  try {
    // 1. Await MongoDB Connection
    console.log('Connecting to MongoDB database...');
    await connectMongo();

    // 2. WebSocket Setup
    initWebSocketServer(server);

    // 3. Connect IoT Simulator to WebSocket Broadcast
    registerBroadcastCallback((payload) => {
      broadcast(payload);
    });

    // 4. Start IoT Telemetry Engine
    startSimulator(4000);

    // 5. Background SLA Timer Escalation Loop (every 15s)
    setInterval(async () => {
      try {
        const escalated = await checkAndEscalateAlerts();
        if (escalated && escalated.length > 0) {
          broadcast({
            type: 'ALERT_ESCALATED',
            escalatedAlertIds: escalated,
            timestamp: new Date().toISOString()
          });
        }
      } catch (err) {
        console.error('SLA Escalation loop error:', err);
      }
    }, 15000);

    // 6. Start HTTP Server
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`==================================================================`);
      console.log(`🚀 Smart Cold-Chain Backend running at: http://localhost:${PORT}`);
      console.log(`📡 WebSocket Live Telemetry stream at: ws://localhost:${PORT}/ws`);
      console.log(`==================================================================`);
    });
  } catch (err) {
    console.error('FATAL: Server startup failed due to database connection error:', err);
    process.exit(1);
  }
}

// Execute startup sequence if run directly
startServer();

export { app, server, startServer };
