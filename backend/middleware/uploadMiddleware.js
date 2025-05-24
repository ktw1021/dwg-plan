/**
 * 파일 업로드 미들웨어
 * Multer 설정 및 파일 검증 로직
 */
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

/**
 * 업로드 디렉토리 설정 및 생성
 * @param {string} uploadPath - 업로드 경로
 * @returns {string} 생성된 업로드 경로
 */
const ensureUploadDir = (uploadPath) => {
  if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
    console.log(`업로드 디렉토리 생성: ${uploadPath}`);
  }
  return uploadPath;
};

/**
 * DWG 파일용 Multer 스토리지 설정
 * @param {string} uploadsDir - 업로드 디렉토리 경로
 * @returns {Object} Multer 스토리지 객체
 */
const createDwgStorage = (uploadsDir) => {
  ensureUploadDir(uploadsDir);
  
  return multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      // 고유한 작업 ID 생성
      const jobId = uuidv4();
      req.jobId = jobId; // 요청 객체에 jobId 추가
      
      const ext = path.extname(file.originalname);
      const filename = `${jobId}${ext}`;
      
      console.log(`파일 저장: ${file.originalname} → ${filename}`);
      cb(null, filename);
    }
  });
};

/**
 * DWG/DXF 파일 필터 함수
 * @param {Object} req - Express 요청 객체
 * @param {Object} file - 업로드된 파일 객체
 * @param {Function} cb - 콜백 함수
 */
const dwgFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = ['.dwg', '.dxf'];
  
  if (allowedExtensions.includes(ext)) {
    console.log(`파일 형식 검증 통과: ${file.originalname} (${ext})`);
    cb(null, true);
  } else {
    const error = new Error(`지원하지 않는 파일 형식입니다. 허용된 형식: ${allowedExtensions.join(', ')}`);
    console.warn(`파일 형식 검증 실패: ${file.originalname} (${ext})`);
    cb(error, false);
  }
};

/**
 * 다중 파일 형식 필터 함수 (DWG, JPG, PNG, PDF)
 * @param {Object} req - Express 요청 객체
 * @param {Object} file - 업로드된 파일 객체
 * @param {Function} cb - 콜백 함수
 */
const multiFormatFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = ['.dwg', '.jpg', '.jpeg', '.png', '.pdf'];
  
  if (allowedExtensions.includes(ext)) {
    console.log(`파일 형식 검증 통과: ${file.originalname} (${ext})`);
    cb(null, true);
  } else {
    const error = new Error(`지원하지 않는 파일 형식입니다. 허용된 형식: ${allowedExtensions.join(', ')}`);
    console.warn(`파일 형식 검증 실패: ${file.originalname} (${ext})`);
    cb(error, false);
  }
};

/**
 * DWG 파일 업로드 미들웨어 생성
 * @param {string} uploadsDir - 업로드 디렉토리 경로
 * @param {Object} options - 추가 옵션
 * @returns {Function} Multer 미들웨어
 */
const createDwgUploadMiddleware = (uploadsDir, options = {}) => {
  const {
    maxFileSize = 10 * 1024 * 1024, // 기본 10MB
    allowMultipleFormats = false
  } = options;
  
  const storage = createDwgStorage(uploadsDir);
  const fileFilter = allowMultipleFormats ? multiFormatFileFilter : dwgFileFilter;
  
  return multer({
    storage,
    fileFilter,
    limits: { 
      fileSize: maxFileSize,
      files: 1 // 단일 파일만 허용
    }
  });
};

/**
 * 업로드 오류 처리 미들웨어
 * @param {Error} error - 발생한 오류
 * @param {Object} req - Express 요청 객체
 * @param {Object} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어 함수
 */
const handleUploadError = (error, req, res, next) => {
  console.error('파일 업로드 오류:', error.message);
  
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          success: false,
          message: '파일 크기가 너무 큽니다. 최대 10MB까지 허용됩니다.'
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          success: false,
          message: '파일 개수가 제한을 초과했습니다.'
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          success: false,
          message: '예상하지 못한 파일 필드입니다.'
        });
      default:
        return res.status(400).json({
          success: false,
          message: `파일 업로드 오류: ${error.message}`
        });
    }
  }
  
  // 일반 오류 처리
  return res.status(400).json({
    success: false,
    message: error.message || '파일 업로드 중 오류가 발생했습니다.'
  });
};

/**
 * 업로드된 파일 검증 미들웨어
 * @param {Object} req - Express 요청 객체
 * @param {Object} res - Express 응답 객체
 * @param {Function} next - 다음 미들웨어 함수
 */
const validateUploadedFile = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: '파일이 업로드되지 않았습니다.'
    });
  }
  
  // 파일 크기 재검증
  if (req.file.size === 0) {
    return res.status(400).json({
      success: false,
      message: '빈 파일은 업로드할 수 없습니다.'
    });
  }
  
  console.log(`파일 업로드 완료: ${req.file.originalname} (${req.file.size} bytes)`);
  next();
};

module.exports = {
  createDwgUploadMiddleware,
  handleUploadError,
  validateUploadedFile,
  ensureUploadDir,
  dwgFileFilter,
  multiFormatFileFilter
}; 