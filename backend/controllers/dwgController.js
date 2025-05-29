/**
 * DWG 파일 처리 컨트롤러
 * 파일 업로드, 처리 상태 관리, 결과 조회 등의 HTTP 요청 처리
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const Job = require('../models/job');
const { processDxfFile } = require('../utils/processors/main');
const jobService = require('../services/jobService');
const { 
  createDwgUploadMiddleware, 
  handleUploadError, 
  validateUploadedFile 
} = require('../middleware/uploadMiddleware');
const {
  DwgProcessError,
  FileError,
  MemoryError,
  PerformanceError
} = require('../utils/core/errors');

const router = express.Router();

// DWG 파일 저장 설정
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

// DWG 파일 업로드 미들웨어 생성
const uploadMiddleware = createDwgUploadMiddleware(uploadsDir, {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowMultipleFormats: false // DWG만 허용
});

/**
 * DWG 파일 업로드 및 처리 시작
 * POST /api/dwg/upload
 */
const uploadDwgFile = async (req, res) => {
  try {
    console.log('=== DWG 파일 업로드 요청 받음 ===');
    console.log('요청 헤더:', req.headers);
    console.log('업로드된 파일 정보:', req.file);
    console.log('요청 본문:', req.body);
    
    const { jobId } = req;
    const filename = req.file.originalname;
    const filePath = req.file.path;
    
    console.log(`파일 업로드됨: ${filename} (jobId: ${jobId})`);
    console.log(`파일 경로: ${filePath}`);
    
    // 작업 생성
    jobService.createJob(jobId, filename, filePath);
    
    // Socket.IO 인스턴스 가져오기
    const io = req.app.get('io');
    
    // 즉시 응답 전송
    res.status(201).json({ 
      success: true, 
      jobId,
      message: '파일 업로드 완료. 처리를 시작합니다.'
    });
    
    console.log(`업로드 응답 전송 완료 (jobId: ${jobId})`);
    
    // 비동기 처리 시작
    processDwgFileAsync(jobId, filename, filePath, io);
    
  } catch (error) {
    console.error('업로드 처리 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || '파일 업로드 처리 중 오류가 발생했습니다.'
    });
  }
};

/**
 * DWG 파일 비동기 처리 함수
 * @param {string} jobId - 작업 ID
 * @param {string} filename - 원본 파일명
 * @param {string} filePath - 파일 경로
 * @param {Object} io - Socket.IO 인스턴스
 */
const processDwgFileAsync = async (jobId, filename, filePath, io) => {
  try {
    // 진행 상황 업데이트 콜백 함수
    const progressCallback = (progress, message, data) => {
      jobService.updateJobProgress(jobId, progress, message, io, data);
    };
    
    // DWG 파일 처리 실행
    const result = await processDxfFile(jobId, filename, filePath, progressCallback);
    
    // 작업 완료 처리
    jobService.completeJob(jobId, result, io);
    
  } catch (error) {
    console.error(`DWG 처리 오류 (${jobId}):`, error);
    
    let errorMessage = '도면 처리 중 오류가 발생했습니다.';
    let errorDetails = {};
    let progress = 50;

    if (error instanceof DwgProcessError) {
      switch (error.code) {
        case 'FILE_ERROR':
          errorMessage = '파일 처리 중 오류가 발생했습니다.';
          progress = 10;
          break;
        case 'CONVERSION_ERROR':
          errorMessage = 'DWG → DXF 변환 중 오류가 발생했습니다.';
          progress = 20;
          break;
        case 'PARSING_ERROR':
          errorMessage = 'DXF 파일 파싱 중 오류가 발생했습니다.';
          progress = 30;
          break;
        case 'ANALYSIS_ERROR':
          errorMessage = '도면 분석 중 오류가 발생했습니다.';
          progress = 50;
          break;
        case 'RENDERING_ERROR':
          errorMessage = 'SVG 생성 중 오류가 발생했습니다.';
          progress = 85;
          break;
        case 'MEMORY_ERROR':
          errorMessage = '메모리 부족으로 처리가 중단되었습니다.';
          break;
        case 'PERFORMANCE_ERROR':
          errorMessage = '처리 시간이 너무 오래 걸려 중단되었습니다.';
          break;
      }
      errorDetails = error.details;
    }

    // 작업 오류 처리
    jobService.handleJobError(jobId, {
      message: errorMessage,
      details: errorDetails,
      progress
    }, io);
  }
};

/**
 * 작업 상태 조회
 * GET /api/dwg/status/:jobId
 */
const getJobStatus = (req, res) => {
  try {
    const { jobId } = req.params;
    console.log(`작업 상태 요청: ${jobId}`);
    
    const job = jobService.getJobStatus(jobId);
    
    if (!job) {
      return res.status(404).json({ 
        success: false, 
        message: '작업을 찾을 수 없습니다.' 
      });
    }
    
    // 작업 상태에 따른 응답 형식 생성
    const response = jobService.formatJobResponse(job);
    
    res.status(200).json(response);
    
  } catch (error) {
    console.error('작업 상태 조회 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '작업 상태 조회 중 오류가 발생했습니다.' 
    });
  }
};

/**
 * 모든 작업 목록 조회 (관리용)
 * GET /api/dwg/jobs
 */
const getAllJobs = (req, res) => {
  try {
    const Job = require('../models/job');
    const allJobs = Job.getAllJobs();
    
    // 작업 목록을 배열로 변환하고 최신순 정렬
    const jobList = Object.values(allJobs)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .map(job => jobService.formatJobResponse(job));
    
    res.status(200).json({
      success: true,
      jobs: jobList,
      total: jobList.length
    });
    
  } catch (error) {
    console.error('작업 목록 조회 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '작업 목록 조회 중 오류가 발생했습니다.' 
    });
  }
};

/**
 * 작업 삭제 (관리용)
 * DELETE /api/dwg/jobs/:jobId
 */
const deleteJob = (req, res) => {
  try {
    const { jobId } = req.params;
    const Job = require('../models/job');
    
    const job = Job.getJob(jobId);
    if (!job) {
      return res.status(404).json({ 
        success: false, 
        message: '작업을 찾을 수 없습니다.' 
      });
    }
    
    // 작업 삭제
    Job.deleteJob(jobId);
    
    console.log(`작업 삭제됨: ${jobId}`);
    res.status(200).json({ 
      success: true, 
      message: '작업이 삭제되었습니다.' 
    });
    
  } catch (error) {
    console.error('작업 삭제 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '작업 삭제 중 오류가 발생했습니다.' 
    });
  }
};

/**
 * 만료된 작업 정리 (관리용)
 * POST /api/dwg/cleanup
 */
const cleanupExpiredJobs = (req, res) => {
  try {
    const { maxAgeHours = 24 } = req.body;
    
    jobService.cleanupExpiredJobs(maxAgeHours);
    
    res.status(200).json({ 
      success: true, 
      message: `${maxAgeHours}시간 이상 된 작업들이 정리되었습니다.` 
    });
    
  } catch (error) {
    console.error('작업 정리 오류:', error);
    res.status(500).json({ 
      success: false, 
      message: '작업 정리 중 오류가 발생했습니다.' 
    });
  }
};

module.exports = {
  // 미들웨어
  uploadMiddleware,
  handleUploadError,
  validateUploadedFile,
  
  // 컨트롤러 함수들
  uploadDwgFile,
  getJobStatus,
  getAllJobs,
  deleteJob,
  cleanupExpiredJobs,
  
  // 내부 함수 (테스트용)
  processDwgFileAsync
}; 