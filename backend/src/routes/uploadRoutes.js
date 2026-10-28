import express from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { col } from '../db/mongo.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

const uploadDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `proof-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

/**
 * POST /api/upload/photo
 * Uploads a physical proof photo with GPS and timestamp metadata
 */
router.post('/photo', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      // In web demo, allow base64 data URLs or mock file creation if camera stream is simulated
      const { base64Data, fileType = 'PHOTO_DOOR', latitude, longitude } = req.body;
      if (base64Data) {
        const id = `prf-${crypto.randomUUID().slice(0, 8)}`;
        const fileName = `proof-cam-${Date.now()}.png`;
        const filePath = `/uploads/${fileName}`;

        // Strip data prefix if present and save file
        const rawBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
        fs.writeFileSync(path.join(uploadDir, fileName), Buffer.from(rawBase64, 'base64'));

        const doc = {
          _id: id,
          id,
          file_path: filePath,
          file_type: fileType,
          original_name: fileName,
          mime_type: 'image/png',
          file_size: rawBase64.length,
          gps_latitude: latitude ? Number(latitude) : 13.0567,
          gps_longitude: longitude ? Number(longitude) : 80.2520,
          uploaded_by: req.user.id,
          created_at: new Date().toISOString()
        };

        await col('proof_files').insertOne(doc);

        return res.status(201).json({
          message: 'Proof image recorded successfully',
          proofFile: {
            id,
            filePath,
            fileType,
            latitude: latitude || 13.0567,
            longitude: longitude || 80.2520,
            timestamp: new Date().toISOString()
          }
        });
      }

      return res.status(400).json({ error: 'No photo file or base64Data provided.' });
    }

    const { fileType = 'PHOTO_DOOR', latitude, longitude } = req.body;
    const id = `prf-${crypto.randomUUID().slice(0, 8)}`;
    const filePath = `/uploads/${req.file.filename}`;

    const doc = {
      _id: id,
      id,
      file_path: filePath,
      file_type: fileType,
      original_name: req.file.originalname,
      mime_type: req.file.mimetype,
      file_size: req.file.size,
      gps_latitude: latitude ? Number(latitude) : 13.0567,
      gps_longitude: longitude ? Number(longitude) : 80.2520,
      uploaded_by: req.user.id,
      created_at: new Date().toISOString()
    };

    await col('proof_files').insertOne(doc);

    res.status(201).json({
      message: 'Proof file uploaded successfully',
      proofFile: {
        id,
        filePath,
        fileType,
        originalName: req.file.originalname,
        latitude: latitude || 13.0567,
        longitude: longitude || 80.2520,
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
