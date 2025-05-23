const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const Job = require('../models/job');
const dwgProcessor = require('../utils/dxfProcessor');

const router = express.Router();

// DWG 파일 저장 설정
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

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
  // DWG 파일만 허용
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '.dwg') {
    cb(null, true);
  } else {
    cb(new Error('DWG 파일만 지원됩니다.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB 제한
});

// DWG 파일 업로드 처리
router.post('/upload', upload.single('file'), (req, res) => {
  try {
    console.log('DWG 파일 업로드 요청 받음');
    
    if (!req.file) {
      console.log('오류: 파일이 업로드되지 않음');
      return res.status(400).json({ success: false, message: '파일이 업로드되지 않았습니다.' });
    }

    const { jobId } = req;
    const filename = req.file.originalname;
    const filePath = req.file.path;
    
    console.log(`파일 업로드됨: ${filename} (jobId: ${jobId})`);
    console.log(`파일 경로: ${filePath}`);
    
    // Job 모델을 사용하여 작업 생성
    const newJob = Job.createJob({
      id: jobId,
      filename,
      originalPath: filePath,
      status: 'processing',
      progress: 0,
      message: '처리 시작 중...'
    });
    
    console.log(`작업 생성됨: ${jobId}`);
    
    // Socket.IO 인스턴스 가져오기
    const io = req.app.get('io');
    
    // 즉시 응답 전송
    res.status(201).json({ success: true, jobId });
    
    // 직접 처리 시작
    console.log(`DWG 처리 시작: ${jobId}`);
    
    // 비동기 처리 시작
    processDwgAsync(jobId, filename, filePath, io);
    
  } catch (error) {
    console.error('업로드 처리 오류:', error);
    try {
      res.status(500).json({ success: false, message: error.message });
    } catch (responseError) {
      console.error('오류 응답 전송 실패:', responseError);
    }
  }
});

/**
 * DWG 파일 비동기 처리 함수
 */
const processDwgAsync = async (jobId, filename, filePath, io) => {
  try {
    // 진행 상황 업데이트 콜백
    const progressCallback = (progress, status, data) => {
      console.log(`[${jobId}] 진행률: ${progress}% - ${status}`);
        
      try {
        // 작업 상태 업데이트
        Job.updateJob(jobId, {
          progress,
          message: status
        });
          
        // 소켓으로 진행 상황 알림
        io.to(jobId).emit('progress', {
          jobId,
          percent: progress,
          message: status,
          data
        });
      } catch (updateError) {
        console.error(`진행 상황 업데이트 오류: ${updateError.message}`);
      }
    };
      
    // DWG 파일 처리
    const result = await dwgProcessor.processDwgFile(jobId, filename, filePath, progressCallback);
    console.log(`DWG 처리 완료: ${jobId}`);
      
    // 결과 저장 디렉토리 확인
    const resultsDir = path.join(__dirname, '..', 'results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
      
    // 작업 완료 상태로 업데이트
    Job.updateJob(jobId, {
      status: 'done',
      progress: 100,
      doors: result.doors || [],
      imageUrl: `/results/${path.basename(result.svgFile)}`,
      entityCount: result.entityCount || 0
    });
      
    // 완료 알림 전송
    io.to(jobId).emit('complete', {
      jobId,
      status: 'done',
      doors: result.doors || [],
      imageUrl: `/results/${path.basename(result.svgFile)}`,
      entityCount: result.entityCount || 0
    });
      
  } catch (processingError) {
    console.error(`DWG 처리 오류: ${processingError.message}`);
      
    // 오류 상태 업데이트
    Job.updateJob(jobId, {
      status: 'error',
      message: processingError.message
    });
      
    // 오류 알림 전송
    io.to(jobId).emit('error', {
      jobId,
      message: `처리 오류: ${processingError.message}`
    });
  }
};

// DWG 처리 상태 확인
router.get('/status/:jobId', (req, res) => {
  try {
    const { jobId } = req.params;
    console.log(`작업 상태 요청: ${jobId}`);
    
    const job = Job.getJob(jobId);
    
    if (!job) {
      console.log(`작업을 찾을 수 없음: ${jobId}`);
      return res.status(404).json({ success: false, message: '작업을 찾을 수 없습니다.' });
    }
    
    console.log(`작업 찾음: ${jobId}, 상태: ${job.status}`);
    
    // 작업 상태에 따라 다른 응답 반환
    switch (job.status) {
      case 'pending':
      case 'processing':
        return res.status(200).json({
          success: true,
          jobId: job.id,
          status: job.status,
          progress: job.progress || 0,
          message: job.message || '처리 중...'
        });
      
      case 'done':
        console.log(`완료된 작업: ${jobId}, 도어 수: ${job.doors?.length}`);
        return res.status(200).json({
          success: true,
          jobId: job.id,
          status: job.status,
          doors: job.doors,
          imageUrl: job.imageUrl,
          entityCount: job.entityCount || 0
        });
      
      case 'error':
        console.log(`오류 발생 작업: ${jobId}`);
        return res.status(400).json({
          success: false,
          jobId: job.id,
          status: job.status,
          message: job.message
        });
      
      default:
        console.log(`알 수 없는 작업 상태: ${job.status}`);
        return res.status(500).json({
          success: false,
          message: '알 수 없는 작업 상태'
        });
    }
  } catch (error) {
    console.error('작업 상태 확인 오류:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 결과 가져오기
router.get('/result/:jobId', (req, res) => {
  try {
    const { jobId } = req.params;
    console.log(`결과 요청: ${jobId}`);
    
    const job = Job.getJob(jobId);
    
    if (!job) {
      console.log(`작업을 찾을 수 없음: ${jobId}`);
      return res.status(404).json({ success: false, message: '작업을 찾을 수 없습니다.' });
    }
    
    if (job.status !== 'done') {
      console.log(`작업이 아직 완료되지 않음: ${jobId}, 상태: ${job.status}`);
      return res.status(400).json({
        success: false,
        message: '작업이 아직 완료되지 않았습니다.',
        status: job.status,
        progress: job.progress || 0
      });
    }
    
    // 결과 반환
    return res.status(200).json({
      success: true,
      jobId: job.id,
      doors: job.doors || [],
      imageUrl: job.imageUrl,
      entityCount: job.entityCount || 0
    });
    
  } catch (error) {
    console.error('결과 가져오기 오류:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router; 