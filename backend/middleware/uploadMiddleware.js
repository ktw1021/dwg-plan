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
      const jobId = uuidv4();
      req.jobId = jobId;
      
      const ext = path.extname(file.originalname);
      const filename = `${jobId}${ext}`;
      
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
    cb(null, true);
  } else {
    const error = new Error(`지원하지 않는 파일 형식입니다. 허용된 형식: ${allowedExtensions.join(', ')}`);
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
    cb(null, true);
  } else {
    const error = new Error(`지원하지 않는 파일 형식입니다. 허용된 형식: ${allowedExtensions.join(', ')}`);
    cb(error, false);
  }
};

/**
 * DWG 파일 업로드 미들웨어 생성
 * @param {string} uploadsDir - 업로드 디렉토리 경로
 * @param {Object} options - 업로드 옵션
 * @returns {Object} Multer 미들웨어
 */
const createDwgUploadMiddleware = (uploadsDir, options = {}) => {
  const storage = createDwgStorage(uploadsDir);
  const fileFilter = options.allowMultipleFormats ? multiFormatFileFilter : dwgFileFilter;
  
  return multer({
    storage,
    fileFilter,
    limits: {
      fileSize: options.maxFileSize || 10 * 1024 * 1024 // 기본 10MB
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
  
  if (req.file.size === 0) {
    return res.status(400).json({
      success: false,
      message: '빈 파일은 업로드할 수 없습니다.'
    });
  }
  
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