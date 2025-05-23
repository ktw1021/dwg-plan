const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const floorplanController = require('../controllers/floorplanController');

// Set up multer for file uploads
const uploadsDir = path.join(__dirname, '..', 'uploads');
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const jobId = uuidv4();
    req.jobId = jobId;
    const ext = path.extname(file.originalname);
    cb(null, jobId + ext);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedFileTypes = ['.dwg', '.jpg', '.jpeg', '.png', '.pdf'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedFileTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file type. Supported formats: DWG, JPG, JPEG, PNG, PDF'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Upload a floorplan
router.post('/upload', upload.single('file'), floorplanController.uploadFloorplan);

// Get the result of a floorplan analysis job
router.get('/result/:jobId', floorplanController.getFloorplanResult);

module.exports = router; 