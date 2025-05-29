/**
 * DWG 파일 처리 라우터
 * DWG 파일 업로드, 상태 조회, 관리 기능 등의 라우트 정의
 */
const express = require('express');
const dwgController = require('../controllers/dwgController');

const router = express.Router();

/**
 * DWG 파일 업로드 및 처리 시작
 * POST /api/dwg/upload
 * 
 * @body {File} file - 업로드할 DWG 파일
 * @returns {Object} { success: boolean, jobId: string, message: string }
 */
router.post('/upload', 
  dwgController.uploadMiddleware.single('file'),
  dwgController.validateUploadedFile,
  dwgController.uploadDwgFile
);

/**
 * 작업 상태 조회
 * GET /api/dwg/status/:jobId
 * 
 * @param {string} jobId - 작업 ID
 * @returns {Object} 작업 상태 정보
 */
router.get('/status/:jobId', dwgController.getJobStatus);

/**
 * SVG 컨텐츠 직접 조회
 * GET /api/dwg/svg/:jobId
 * 
 * @param {string} jobId - 작업 ID
 * @returns {Object} { success: boolean, svgContent: string, imageUrl: string }
 */
router.get('/svg/:jobId', dwgController.getSvgContent);

/**
 * 모든 작업 목록 조회 (관리용)
 * GET /api/dwg/jobs
 * 
 * @returns {Object} { success: boolean, jobs: Array, total: number }
 */
router.get('/jobs', dwgController.getAllJobs);

/**
 * 작업 삭제 (관리용)
 * DELETE /api/dwg/jobs/:jobId
 * 
 * @param {string} jobId - 삭제할 작업 ID
 * @returns {Object} { success: boolean, message: string }
 */
router.delete('/jobs/:jobId', dwgController.deleteJob);

/**
 * 만료된 작업 정리 (관리용)
 * POST /api/dwg/cleanup
 * 
 * @body {number} maxAgeHours - 최대 보관 시간 (기본: 24시간)
 * @returns {Object} { success: boolean, message: string }
 */
router.post('/cleanup', dwgController.cleanupExpiredJobs);

// 업로드 오류 처리 미들웨어
router.use(dwgController.handleUploadError);

module.exports = router; 