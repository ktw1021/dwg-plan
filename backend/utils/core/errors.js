/**
 * 커스텀 에러 클래스 정의
 */

class DwgProcessError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'DwgProcessError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

// 파일 관련 에러
class FileError extends DwgProcessError {
  constructor(message, details = {}) {
    super(message, 'FILE_ERROR', details);
    this.name = 'FileError';
  }
}

// 변환 관련 에러
class ConversionError extends DwgProcessError {
  constructor(message, details = {}) {
    super(message, 'CONVERSION_ERROR', details);
    this.name = 'ConversionError';
  }
}

// 파싱 관련 에러
class ParsingError extends DwgProcessError {
  constructor(message, details = {}) {
    super(message, 'PARSING_ERROR', details);
    this.name = 'ParsingError';
  }
}

// 분석 관련 에러
class AnalysisError extends DwgProcessError {
  constructor(message, details = {}) {
    super(message, 'ANALYSIS_ERROR', details);
    this.name = 'AnalysisError';
  }
}

// 렌더링 관련 에러
class RenderingError extends DwgProcessError {
  constructor(message, details = {}) {
    super(message, 'RENDERING_ERROR', details);
    this.name = 'RenderingError';
  }
}

// 메모리 부족 에러
class MemoryError extends DwgProcessError {
  constructor(message, details = {}) {
    super(message, 'MEMORY_ERROR', details);
    this.name = 'MemoryError';
  }
}

// 성능 관련 에러
class PerformanceError extends DwgProcessError {
  constructor(message, details = {}) {
    super(message, 'PERFORMANCE_ERROR', {
      memoryUsage: process.memoryUsage(),
      ...details
    });
    this.name = 'PerformanceError';
  }
}

module.exports = {
  DwgProcessError,
  FileError,
  ConversionError,
  ParsingError,
  AnalysisError,
  RenderingError,
  MemoryError,
  PerformanceError
}; 