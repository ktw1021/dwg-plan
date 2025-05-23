const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// CORS 설정 - 모든 리소스에 적용
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Middleware
app.use(express.json());

// 정적 파일 제공 설정 - Content-Type 헤더 명시적 설정
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, filePath) => {
    if (path.extname(filePath) === '.dwg') {
      res.setHeader('Content-Type', 'application/acad');
    }
  }
}));

// SVG 파일을 위한 MIME 타입 설정
app.use('/results', express.static(path.join(__dirname, 'results'), {
  setHeaders: (res, filePath) => {
    if (path.extname(filePath) === '.svg') {
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'public, max-age=300');
    }
  }
}));

// Create uploads and results directories if they don't exist
const uploadsDir = path.join(__dirname, 'uploads');
const resultsDir = path.join(__dirname, 'results');
const jobsDir = path.join(__dirname, 'jobs');

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir);
if (!fs.existsSync(jobsDir)) fs.mkdirSync(jobsDir);

console.log('Using local file system for storage');

// Set up multer for file uploads - only accept DWG files
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
  // Only allow DWG files
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.dwg') {
    cb(null, true);
  } else {
    cb(new Error('Only DWG files are supported'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Import routes
const floorplanRoutes = require('./routes/floorplanRoutes');
const dwgRoutes = require('./routes/dwgRoutes');

// Routes
app.use('/api/v1/floorplan', floorplanRoutes);
app.use('/api/dwg', dwgRoutes);

// 추가 SVG 직접 접근 라우트
app.get('/api/svg/:jobId', (req, res) => {
  try {
    const { jobId } = req.params;
    const svgPath = path.join(resultsDir, `${jobId}.svg`);
    
    if (!fs.existsSync(svgPath)) {
      return res.status(404).send('SVG 파일을 찾을 수 없습니다.');
    }
    
    res.setHeader('Content-Type', 'image/svg+xml');
    res.sendFile(svgPath);
  } catch (error) {
    console.error('SVG 파일 제공 오류:', error);
    res.status(500).send('SVG 파일을 제공할 수 없습니다.');
  }
});

// WebSocket connection for real-time progress updates
io.on('connection', (socket) => {
  console.log('A client connected');

  socket.on('join', (data) => {
    const { jobId } = data;
    console.log(`Client joined room: ${jobId}`);
    socket.join(jobId);
  });

  socket.on('disconnect', () => {
    console.log('A client disconnected');
  });
});

// Make io accessible to the route handlers
app.set('io', io);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({
    success: false,
    message: err.message || 'Something went wrong',
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { app, io }; 