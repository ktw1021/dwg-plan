/**
 * DXF 프로세서 - 새로운 모듈 구조 사용
 */

const { processDxfFile } = require('./processors/main');

// 기존 함수명과의 호환성을 위한 래퍼
const processCompleteDxfFile = async (jobId, filename, filePath, progressCallback) => {
  return await processDxfFile(jobId, filename, filePath, progressCallback);
};

// 기존 함수명과의 호환성을 위한 별칭
const processDwgFile = processCompleteDxfFile;

module.exports = {
  processCompleteDxfFile,
  processDwgFile
};
