/**
 * DWG 파일 분석 시스템 백엔드 서버
 * Express.js + Socket.IO를 사용한 실시간 파일 처리 서버
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
const path = require('path');
const fs = require('fs');
const cors = require('cors');
require('dotenv').config();

// Express 앱 및 HTTP 서버 생성
const app = express();
const server = http.createServer(app);

// Socket.IO 서버 설정 (CORS 포함)
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// CORS 설정 - 모든 HTTP 요청에 적용
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin']
}));

// 기본 미들웨어 설정
app.use(express.json()); // JSON 파싱

// 요청 로그 미들웨어 추가
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  if (req.method === 'POST' && req.path.includes('upload')) {
    console.log('업로드 요청 감지:', {
      path: req.path,
      contentType: req.headers['content-type'],
      contentLength: req.headers['content-length']
    });
  }
  next();
});

/**
 * 정적 파일 서빙 설정
 * 업로드된 파일과 처리 결과 파일들을 제공
 */

// 업로드된 파일 제공 (DWG 파일용 MIME 타입 설정)
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, filePath) => {
    if (path.extname(filePath) === '.dwg') {
      res.setHeader('Content-Type', 'application/acad');
    }
  }
}));

// SVG 결과 파일 제공 (캐싱 및 MIME 타입 설정)
app.use('/results', express.static(path.join(__dirname, 'results'), {
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
const uploadsDir = path.join(__dirname, 'uploads');
const resultsDir = path.join(__dirname, 'results');
const jobsDir = path.join(__dirname, 'jobs');

// 디렉토리 존재 확인 및 생성
[uploadsDir, resultsDir, jobsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`디렉토리 생성: ${dir}`);
  }
});

console.log('로컬 파일 시스템 사용 중');



/**
 * 라우터 설정
 * API 엔드포인트들을 모듈별로 분리하여 관리
 */
const dwgRoutes = require('./routes/dwgRoutes');

// API 라우트 등록
app.use('/api/dwg', dwgRoutes);                // DWG 처리 API (메인)

// API 상태 확인 엔드포인트
app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    message: 'DWG 분석 시스템 백엔드 서버 정상 작동 중',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

/**
 * SVG 파일 직접 접근 라우트
 * 결과 SVG 파일에 대한 직접 접근 제공
 */
app.get('/api/svg/:jobId', (req, res) => {
  try {
    const { jobId } = req.params;
    const svgPath = path.join(resultsDir, `${jobId}.svg`);
    
    // 파일 존재 확인
    if (!fs.existsSync(svgPath)) {
      console.warn(`SVG 파일 없음: ${jobId}`);
      return res.status(404).send('SVG 파일을 찾을 수 없습니다.');
    }
    
    // SVG 파일 제공
    res.setHeader('Content-Type', 'image/svg+xml');
    res.sendFile(svgPath);
    
    console.log(`SVG 파일 제공: ${jobId}`);
  } catch (error) {
    console.error('SVG 파일 제공 오류:', error);
    res.status(500).send('SVG 파일을 제공할 수 없습니다.');
  }
});

/**
 * WebSocket 연결 관리
 * 실시간 진행률 업데이트를 위한 Socket.IO 설정
 */
io.on('connection', (socket) => {
  console.log(`클라이언트 연결됨: ${socket.id}`);

  // 작업별 룸 참가
  socket.on('join', (data) => {
    const { jobId } = data;
    if (jobId) {
      socket.join(jobId);
      console.log(`클라이언트가 룸에 참가: ${jobId} (소켓: ${socket.id})`);
    }
  });

  // 연결 해제 처리
  socket.on('disconnect', () => {
    console.log(`클라이언트 연결 해제: ${socket.id}`);
  });
});

// Express 앱에서 Socket.IO 인스턴스에 접근할 수 있도록 설정
app.set('io', io);

/**
 * 전역 오류 처리 미들웨어
 * 처리되지 않은 오류들을 캐치하여 적절한 응답 제공
 */
app.use((err, req, res, next) => {
  console.error('서버 오류:', err.stack);
  
  // 개발 환경에서는 상세 오류 정보 제공
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(500).json({
    success: false,
    message: err.message || '서버 내부 오류가 발생했습니다',
    ...(isDevelopment && { stack: err.stack }) // 개발 환경에서만 스택 트레이스 포함
  });
});

/**
 * 서버 시작
 * 환경변수 또는 기본 포트에서 서버 실행
 */
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`🚀 서버가 포트 ${PORT}에서 실행 중`);
  console.log(`📁 업로드 디렉토리: ${uploadsDir}`);
  console.log(`📊 결과 디렉토리: ${resultsDir}`);
  console.log(`🌐 프론트엔드 URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  console.log(`=================================`);
});

// 모듈 export (테스트용)
module.exports = { app, io }; 