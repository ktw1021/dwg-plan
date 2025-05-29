/**
 * 작업 관리 서비스
 * 작업 생성, 상태 관리, 진행률 업데이트 등의 비즈니스 로직
 */
const mongoose = require('mongoose');
const logger = require('../config/logger');
const { uploadSvgToS3, deleteSvgFromS3 } = require('../config/s3');
const path = require('path');
const fs = require('fs');

// Job 모델 가져오기
const Job = mongoose.model('Job');

/**
 * 작업 생성
 * @param {string} jobId - 작업 ID
 * @param {string} filename - 원본 파일명
 * @returns {Promise<Object>} 생성된 작업 객체
 */
const createJob = async (jobId, filename) => {
  try {
    logger.info('작업 생성 시작', { jobId, filename });

    const job = new Job({
      id: jobId,
      filename,
      status: 'pending',
      logs: [{
        level: 'info',
        message: '작업이 생성되었습니다.',
        metadata: { filename }
      }]
    });

    await job.save();
    logger.info('작업 DB 저장 완료', { 
      jobId, 
      status: job.status,
      filename: job.filename 
    });
    
    return job;
  } catch (error) {
    logger.error('작업 생성 실패', { 
      jobId, 
      error: error.message,
      stack: error.stack 
    });
    throw error;
  }
};

/**
 * 작업 상태 조회
 * @param {string} jobId - 작업 ID
 * @returns {Promise<Object|null>} 작업 객체
 */
const getJobStatus = async (jobId) => {
  try {
    const job = await Job.findOne({ id: jobId });
    return job;
  } catch (error) {
    logger.error('작업 조회 실패', { jobId, error: error.message });
    return null;
  }
};

/**
 * 작업 진행률 업데이트
 * @param {string} jobId - 작업 ID
 * @param {number} progress - 진행률
 * @param {string} message - 상태 메시지
 * @param {Object} io - Socket.IO 인스턴스
 * @param {Object} data - 추가 데이터
 */
const updateJobProgress = async (jobId, progress, message, io, data = null) => {
  try {
    logger.info('작업 진행률 업데이트 시작', { 
      jobId, 
      progress, 
      message 
    });

    const job = await Job.findOne({ id: jobId });
    if (!job) {
      logger.warn('진행률 업데이트 실패: 작업을 찾을 수 없음', { jobId });
      return;
    }

    // 작업 상태 업데이트
    job.status = 'processing';
    job.progress = progress;
    job.message = message;
    job.logs.push({
      level: 'info',
      message: `진행률 업데이트: ${progress}%`,
      metadata: { progress, message, data }
    });

    await job.save();
    logger.info('작업 진행률 DB 업데이트 완료', { 
      jobId, 
      progress,
      status: job.status 
    });

    // 소켓으로 진행 상황 알림
    if (io) {
      io.to(jobId).emit('progress', {
        jobId,
        status: job.status,
        percent: progress,
        message,
        data
      });
      logger.info('진행률 소켓 알림 전송 완료', { jobId, progress });
    }
  } catch (error) {
    logger.error('진행률 업데이트 실패', { 
      jobId, 
      error: error.message,
      stack: error.stack 
    });
    throw error;
  }
};

/**
 * 작업 완료 처리
 * @param {string} jobId - 작업 ID
 * @param {Object} result - 처리 결과
 * @param {Object} io - Socket.IO 인스턴스
 */
const completeJob = async (jobId, result, io) => {
  try {
    logger.info('작업 완료 처리 시작', { jobId });

    const job = await Job.findOne({ id: jobId });
    if (!job) {
      logger.warn('작업 완료 처리 실패: 작업을 찾을 수 없음', { jobId });
      return;
    }

    // 작업 완료 상태로 업데이트
    const updateData = {
      status: 'done',
      progress: 100,
      message: '완료',
      imageUrl: result.imageUrl,
      entityCount: result.entityCount,
      details: result.details,
      metadata: result.metadata
    };

    Object.assign(job, updateData);
    job.logs.push({
      level: 'info',
      message: '작업이 완료되었습니다.',
      metadata: { result }
    });

    await job.save();
    logger.info('작업 완료 DB 업데이트 완료', { 
      jobId,
      status: job.status,
      imageUrl: result.imageUrl
    });

    // 완료 알림 전송 (SVG 내용 포함)
    if (io) {
      io.to(jobId).emit('complete', {
        jobId,
        ...updateData,
        svgContent: result.svgContent // SVG 내용 직접 전달
      });
      logger.info('완료 소켓 알림 전송 완료', { jobId });
    }
  } catch (error) {
    logger.error('작업 완료 처리 실패', { 
      jobId, 
      error: error.message,
      stack: error.stack 
    });
    throw error;
  }
};

/**
 * 작업 오류 처리
 * @param {string} jobId - 작업 ID
 * @param {Object} error - 오류 정보
 * @param {Object} io - Socket.IO 인스턴스
 */
const handleJobError = async (jobId, error, io) => {
  try {
    const job = await Job.findOne({ id: jobId });
    if (!job) {
      logger.warn('오류 처리 실패: 작업을 찾을 수 없음', { jobId });
      return;
    }

    // 오류 상태 업데이트
    job.status = 'error';
    job.message = error.message || '알 수 없는 오류가 발생했습니다';
    job.logs.push({
      level: 'error',
      message: error.message,
      metadata: { error }
    });

    await job.save();
    logger.info('오류 상태 DB 업데이트 완료', { 
      jobId,
      status: job.status,
      error: error.message
    });

    // 오류 알림 전송
    if (io) {
      io.to(jobId).emit('error', {
        jobId,
        message: error.message
      });
      logger.info('오류 소켓 알림 전송 완료', { jobId });
    }
  } catch (error) {
    logger.error('오류 상태 업데이트 실패', { 
      jobId, 
      error: error.message,
      stack: error.stack 
    });
    throw error;
  }
};

/**
 * 작업 응답 형식 생성
 * @param {Object} job - 작업 객체
 * @returns {Object} API 응답 형식의 작업 데이터
 */
const formatJobResponse = (job) => {
  if (!job) return null;

  const baseResponse = {
    success: true,
    jobId: job.id,
    status: job.status,
    filename: job.filename
  };

  switch (job.status) {
    case 'pending':
    case 'processing':
      return {
        ...baseResponse,
        progress: job.progress || 0,
        message: job.message || '처리 중...'
      };

    case 'done':
      return {
        ...baseResponse,
        imageUrl: job.imageUrl,
        entityCount: job.entityCount || 0,
        details: job.details || {},
        metadata: job.metadata || {}
      };

    case 'error':
      return {
        success: false,
        jobId: job.id,
        status: job.status,
        message: job.message || '처리 중 오류가 발생했습니다'
      };

    default:
      return baseResponse;
  }
};

/**
 * 만료된 작업 정리
 * @param {number} maxAgeHours - 최대 보관 시간 (시간 단위)
 */
const cleanupExpiredJobs = async (maxAgeHours = 24) => {
  try {
    const cutoffDate = new Date(Date.now() - (maxAgeHours * 60 * 60 * 1000));
    const result = await Job.deleteMany({ createdAt: { $lt: cutoffDate } });
    
    logger.info(`만료된 작업 정리 완료`, { 
      deletedCount: result.deletedCount,
      maxAgeHours 
    });
  } catch (error) {
    logger.error('만료된 작업 정리 실패', { error: error.message });
  }
};

module.exports = {
  createJob,
  getJobStatus,
  updateJobProgress,
  completeJob,
  handleJobError,
  formatJobResponse,
  cleanupExpiredJobs
}; 