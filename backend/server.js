/**
 * DWG 도면 분석 시스템 백엔드 서버
 * Express와 Socket.IO를 사용한 실시간 처리 서버
 * 
 * 주요 기능:
 * - DWG 파일 업로드 및 처리
 * - 실시간 진행률 업데이트 (WebSocket)
 * - SVG 변환 및 결과 제공
 * - 정적 파일 서빙
 */

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();
const connectDB = require('./config/database');
const logger = require('./config/logger');

// Express 앱 및 HTTP 서버 생성
const app = express();
const server = http.createServer(app);

// Socket.IO 서버 설정
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// CORS 설정
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));

// JSON 파싱 미들웨어
app.use(express.json());

// 디렉토리 설정
const uploadsDir = path.join(__dirname, 'uploads');
const resultsDir = path.join(__dirname, 'results');
const jobsDir = path.join(__dirname, 'jobs');

// 필요한 디렉토리들 생성
[uploadsDir, resultsDir, jobsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

logger.info('로컬 파일 시스템 초기화 완료');

/**
 * 정적 파일 서빙 설정
 * 업로드된 파일과 처리 결과 파일들을 제공
 */

// 업로드된 파일 제공 (DWG 파일용 MIME 타입 설정)
app.use('/uploads', express.static(uploadsDir, {
  setHeaders: (res, filePath) => {
    if (path.extname(filePath) === '.dwg') {
      res.setHeader('Content-Type', 'application/acad');
    }
  }
}));

// SVG 결과 파일 제공 (캐싱 및 MIME 타입 설정)
app.use('/results', express.static(resultsDir, {
  setHeaders: (res, filePath) => {
    if (path.extname(filePath) === '.svg') {
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'public, max-age=300'); // 5분 캐싱
    }
  }
}));

/**
 * 필요한 디렉토리 생성
 * 서버 시작 시 필수 디렉토리들을 미리 생성
 */

/**
 * 라우터 설정
 * API 엔드포인트들을 모듈별로 분리하여 관리
 */

// MongoDB 연결 후 서버 시작
const startServer = async () => {
  try {
    // MongoDB 연결
    await connectDB();
    logger.info('MongoDB 연결 완료');

    // 모델 로드
    require('./models/job');  // 파일 이름 대소문자 수정
    logger.info('MongoDB 모델 로드 완료');

    // Express 앱에서 Socket.IO 인스턴스에 접근할 수 있도록 설정
    app.set('io', io);

    // 정적 파일 서빙 설정
    app.use('/uploads', express.static(uploadsDir));
    app.use('/results', express.static(resultsDir));

    // API 상태 확인 엔드포인트
    app.get('/api/status', (req, res) => {
      res.json({
        success: true,
        message: 'DWG 분석 시스템 백엔드 서버 정상 작동 중',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    });

    // MongoDB 연결 후 라우터 로드
    const dwgRoutes = require('./routes/dwgRoutes');
    app.use('/api/dwg', dwgRoutes);

    // WebSocket 연결 관리
    io.on('connection', (socket) => {
      logger.info('클라이언트 연결됨', { socketId: socket.id });

      socket.on('join', (data) => {
        const { jobId } = data;
        if (jobId) {
          socket.join(jobId);
          logger.info('클라이언트가 룸에 참가', { jobId, socketId: socket.id });
        }
      });

      socket.on('disconnect', () => {
        logger.info('클라이언트 연결 해제', { socketId: socket.id });
      });
    });

    // 전역 오류 처리 미들웨어
    app.use((err, req, res, next) => {
      logger.error('서버 오류', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method
      });
      
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      res.status(500).json({
        success: false,
        message: err.message || '서버 내부 오류가 발생했습니다',
        ...(isDevelopment && { stack: err.stack })
      });
    });

    // 서버 시작
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      const serverInfo = {
        port: PORT,
        uploadsDir,
        resultsDir,
        frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000'
      };

      logger.info('=================================');
      logger.info('DWG 분석 시스템 서버가 시작되었습니다');
      logger.info('서버 정보:', serverInfo);
      logger.info('=================================');
    });
  } catch (error) {
    logger.error('서버 시작 실패', { error: error.message });
    process.exit(1);
  }
};

startServer();