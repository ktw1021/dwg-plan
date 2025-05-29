/**
 * DWG 파일 처리 컨트롤러
 * 파일 업로드, 상태 조회, 처리 로직을 관리
 */
const express = require('express');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const mongoose = require('mongoose');
const Job = mongoose.model('Job');
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
const logger = require('../config/logger');

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
 * @param {Object} req - Express 요청 객체
 * @param {Object} res - Express 응답 객체
 */
const uploadDwgFile = async (req, res) => {
  try {
    const { jobId } = req;
    const filename = req.file.originalname;
    const filePath = req.file.path;
    
    logger.info('파일 업로드 시작', { 
      jobId,
      filename,
      filePath,
      fileSize: req.file.size
    });

    // 작업 생성
    const job = await jobService.createJob(jobId, filename);
    logger.info('작업 생성됨', { 
      jobId,
      job: {
        id: job.id,
        status: job.status,
        filename: job.filename
      }
    });
    
    // Socket.IO 인스턴스 가져오기
    const io = req.app.get('io');
    
    // 즉시 응답 전송
    res.status(201).json({ 
      success: true, 
      jobId,
      message: '파일 업로드 완료. 처리를 시작합니다.'
    });
    
    // 비동기 처리 시작
    processDwgFileAsync(jobId, filename, filePath, io).catch(error => {
      logger.error('비동기 처리 중 오류 발생', {
        jobId,
        error: error.message,
        stack: error.stack
      });
    });
    
  } catch (error) {
    logger.error('파일 업로드 처리 중 오류', {
      error: error.message,
      stack: error.stack
    });
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
    logger.info('비동기 처리 시작', { jobId, filename });

    // 진행 상황 업데이트 콜백 함수
    const progressCallback = (progress, message, data) => {
      if (progress < 100) {  // 100% 진행률은 작업 완료 후에 보냄
        logger.info('진행 상황 업데이트', { 
          jobId, 
          progress, 
          message,
          data
        });
        jobService.updateJobProgress(jobId, progress, message, io, data);
      }
    };
    
    // DWG 파일 처리 실행
    const result = await processDxfFile(jobId, filename, filePath, progressCallback);
    logger.info('파일 처리 완료', { 
      jobId,
      result: {
        entityCount: result.entityCount,
        svgFile: result.svgFile,
        details: result.details
      }
    });
    
    // 작업 완료 처리를 먼저 수행
    const updatedJob = await Job.findOneAndUpdate(
      { id: jobId },
      { 
        $set: {
          status: 'done',
          progress: 100,
          message: '처리 완료',
          svgContent: result.svgContent,
          result: result,
          entityCount: result.entityCount,
          imageUrl: result.imageUrl
        }
      },
      { new: true }
    );

    if (!updatedJob) {
      logger.error('작업 상태 업데이트 실패: 작업을 찾을 수 없음', { jobId });
      throw new Error('작업을 찾을 수 없습니다.');
    }

    logger.info('작업 상태 업데이트 완료', { 
      jobId,
      status: updatedJob.status,
      progress: updatedJob.progress
    });

    // 상태 업데이트 후 100% 진행률 전송
    io.to(jobId).emit('progress', {
      jobId,
      percent: 100,
      message: '처리 완료',
      status: 'done'
    });

    // Socket.IO로 완료 알림
    io.to(jobId).emit('complete', {
      jobId,
      status: 'done',
      svgContent: result.svgContent,
      imageUrl: result.imageUrl,
      details: result.details
    });

    logger.info('작업 완료 처리 완료', { jobId });
    
  } catch (error) {
    logger.error('도면 처리 중 오류', {
      jobId,
      step: error.step,
      error: error.message,
      details: error.details,
      stack: error.stack
    });

    let errorMessage = '도면 처리 중 오류가 발생했습니다.';
    let errorDetails = {};
    let progress = 50;
    
    if (error instanceof DwgProcessError) {
      errorMessage = error.message;
      errorDetails = error.details;
      progress = error.details.progress || 50;
    }
    
    await jobService.handleJobError(jobId, {
      message: errorMessage,
      details: errorDetails,
      progress
    }, io);
  }
};

/**
 * 작업 상태 조회
 * GET /api/dwg/status/:jobId
 * @param {Object} req - Express 요청 객체
 * @param {Object} res - Express 응답 객체
 */
const getJobStatus = async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await jobService.getJobStatus(jobId);
    
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
    
    const job = Job.getJob(jobId);
    if (!job) {
      return res.status(404).json({ 
        success: false, 
        message: '작업을 찾을 수 없습니다.' 
      });
    }
    
    // 작업 삭제
    Job.deleteJob(jobId);
    
    res.status(200).json({ 
      success: true, 
      message: '작업이 삭제되었습니다.' 
    });
    
  } catch (error) {
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
    res.status(500).json({ 
      success: false, 
      message: '작업 정리 중 오류가 발생했습니다.' 
    });
  }
};

/**
 * SVG 컨텐츠 직접 조회
 */
const getSvgContent = async (req, res) => {
  const { jobId } = req.params;
  
  try {
    logger.info('SVG 컨텐츠 조회 요청', { jobId });
    
    const job = await Job.findOne({ id: jobId });
    if (!job) {
      logger.error('SVG 조회 실패: 작업을 찾을 수 없음', { jobId });
      return res.status(404).json({
        success: false,
        message: '작업을 찾을 수 없습니다.'
      });
    }

    logger.info('작업 상태', { 
      jobId, 
      status: job.status, 
      progress: job.progress,
      hasSvgContent: !!job.svgContent,
      hasResult: !!job.result
    });

    // 작업이 완료되지 않은 경우
    if (job.status !== 'done') {
      return res.json({
        success: true,
        status: job.status,
        progress: job.progress,
        message: job.message
      });
    }

    // SVG 컨텐츠가 없는 경우
    if (!job.svgContent && (!job.result || !job.result.svgContent)) {
      logger.error('SVG 컨텐츠 없음', { jobId });
      return res.status(404).json({
        success: false,
        message: '도면 데이터를 찾을 수 없습니다.'
      });
    }

    // 작업 결과에서 SVG 컨텐츠와 URL 반환
    const response = {
      success: true,
      status: 'done',
      svgContent: job.svgContent || job.result.svgContent,
      imageUrl: job.imageUrl || job.result.imageUrl,
      details: job.result?.details || {}
    };

    logger.info('SVG 컨텐츠 반환', { 
      jobId,
      contentLength: response.svgContent?.length,
      hasImageUrl: !!response.imageUrl
    });

    return res.json(response);
  } catch (error) {
    logger.error('SVG 컨텐츠 조회 실패', {
      jobId,
      error: error.message,
      stack: error.stack
    });
    
    return res.status(500).json({
      success: false,
      message: 'SVG 컨텐츠 조회 중 오류가 발생했습니다.'
    });
  }
};

// 모듈 내보내기
module.exports = {
  uploadMiddleware,
  handleUploadError,
  validateUploadedFile,
  uploadDwgFile,
  getJobStatus,
  getAllJobs,
  deleteJob,
  cleanupExpiredJobs,
  getSvgContent,
  processDwgFileAsync
}; 