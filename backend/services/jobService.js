/**
 * 작업 관리 서비스
 * Job 생성, 상태 관리, 진행률 업데이트 등의 비즈니스 로직 처리
 */
const Job = require('../models/job');
const path = require('path');
const fs = require('fs');

/**
 * 새 작업 생성
 * @param {string} jobId - 작업 ID
 * @param {string} filename - 원본 파일명
 * @param {string} filePath - 파일 경로
 * @returns {Object} 생성된 작업 객체
 */
const createJob = (jobId, filename, filePath) => {
  const newJob = Job.createJob({
    id: jobId,
    filename,
    originalPath: filePath,
    status: 'processing',
    progress: 0,
    message: '처리 시작 중...'
  });
  
  console.log(`새 작업 생성: ${jobId} (${filename})`);
  return newJob;
};

/**
 * 작업 상태 조회
 * @param {string} jobId - 작업 ID
 * @returns {Object|null} 작업 객체 또는 null
 */
const getJobStatus = (jobId) => {
  const job = Job.getJob(jobId);
  
  if (!job) {
    console.log(`작업을 찾을 수 없음: ${jobId}`);
    return null;
  }
  
  console.log(`작업 상태 조회: ${jobId} - ${job.status} (${job.progress}%)`);
  return job;
};

/**
 * 작업 진행률 업데이트
 * @param {string} jobId - 작업 ID
 * @param {number} progress - 진행률 (0-100)
 * @param {string} message - 상태 메시지
 * @param {Object} io - Socket.IO 인스턴스
 * @param {Object} data - 추가 데이터
 */
const updateJobProgress = (jobId, progress, message, io, data = null) => {
  try {
    // 작업 상태 업데이트
    Job.updateJob(jobId, {
      progress,
      message
    });
    
    // 소켓으로 진행 상황 알림
    if (io) {
      io.to(jobId).emit('progress', {
        jobId,
        percent: progress,
        message,
        data
      });
    }
    
    console.log(`[${jobId}] 진행률 업데이트: ${progress}% - ${message}`);
  } catch (error) {
    console.error(`진행률 업데이트 오류 (${jobId}):`, error.message);
  }
};

/**
 * 작업 완료 처리
 * @param {string} jobId - 작업 ID
 * @param {Object} result - 처리 결과
 * @param {Object} io - Socket.IO 인스턴스
 */
const completeJob = (jobId, result, io) => {
  try {
    // 결과 저장 디렉토리 확인
    const resultsDir = path.join(__dirname, '..', 'results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    // 작업 완료 상태로 업데이트
    const updateData = {
      status: 'done',
      progress: 100,
      doors: result.doors || [],
      imageUrl: `/results/${path.basename(result.svgFile)}`,
      entityCount: result.entityCount || 0,
      layerCount: result.layerCount || 0,
      majorLayers: result.majorLayers || []
    };
    
    Job.updateJob(jobId, updateData);
    
    // 완료 알림 전송
    if (io) {
      io.to(jobId).emit('complete', {
        jobId,
        ...updateData
      });
    }
    
    console.log(`작업 완료: ${jobId} (엔티티: ${result.entityCount}개)`);
  } catch (error) {
    console.error(`작업 완료 처리 오류 (${jobId}):`, error.message);
    throw error;
  }
};

/**
 * 작업 오류 처리
 * @param {string} jobId - 작업 ID
 * @param {Error} error - 오류 객체
 * @param {Object} io - Socket.IO 인스턴스
 */
const handleJobError = (jobId, error, io) => {
  try {
    const errorMessage = error.message || '알 수 없는 오류가 발생했습니다';
    
    // 오류 상태 업데이트
    Job.updateJob(jobId, {
      status: 'error',
      message: errorMessage
    });
    
    // 오류 알림 전송
    if (io) {
      io.to(jobId).emit('error', {
        jobId,
        message: `처리 오류: ${errorMessage}`
      });
    }
    
    console.error(`작업 오류 처리: ${jobId} - ${errorMessage}`);
  } catch (updateError) {
    console.error(`작업 오류 상태 업데이트 실패 (${jobId}):`, updateError.message);
  }
};

/**
 * 작업 응답 형식 생성
 * @param {Object} job - 작업 객체
 * @returns {Object} API 응답 형식의 작업 데이터
 */
const formatJobResponse = (job) => {
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
        doors: job.doors || [],
        imageUrl: job.imageUrl,
        entityCount: job.entityCount || 0,
        layerCount: job.layerCount || 0,
        majorLayers: job.majorLayers || []
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
 * 만료된 작업 정리 (선택적)
 * @param {number} maxAgeHours - 최대 보관 시간 (시간 단위)
 */
const cleanupExpiredJobs = (maxAgeHours = 24) => {
  try {
    const allJobs = Job.getAllJobs();
    const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);
    let cleanedCount = 0;
    
    Object.values(allJobs).forEach(job => {
      if (job.createdAt && job.createdAt < cutoffTime) {
        Job.deleteJob(job.id);
        cleanedCount++;
      }
    });
    
    if (cleanedCount > 0) {
      console.log(`만료된 작업 ${cleanedCount}개 정리 완료`);
    }
  } catch (error) {
    console.error('만료된 작업 정리 오류:', error.message);
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