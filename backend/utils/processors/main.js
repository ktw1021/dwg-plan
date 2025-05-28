/**
 * 메인 DXF 프로세서 - 모든 처리 단계 통합
 */

const fs = require('fs');
const { Helper } = require('dxf');
const path = require('path');
const {
  FileError,
  ConversionError,
  ParsingError,
  AnalysisError,
  RenderingError,
  MemoryError,
  PerformanceError
} = require('../core/errors');

const { convertDwgToDxf } = require('./dwgConverter');
const { performComprehensiveAnalysis } = require('../core/analyzer');
const { renderSvg } = require('../renderers/svg');

// 메모리 사용량 체크
const checkMemoryUsage = () => {
  const usage = process.memoryUsage();
  const maxHeap = 1024 * 1024 * 1024; // 1GB
  
  if (usage.heapUsed > maxHeap * 0.9) { // 90% 이상 사용 시
    throw new MemoryError('메모리 사용량이 너무 높습니다', {
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      maxHeap
    });
  }
  
  return usage;
};

// 성능 측정
const measurePerformance = (startTime) => {
  const endTime = Date.now();
  const duration = endTime - startTime;
  
  if (duration > 30000) { // 30초 이상 걸리면 경고
    throw new PerformanceError('처리 시간이 너무 깁니다', {
      duration,
      startTime,
      endTime
    });
  }
  
  return duration;
};

// 응답 포맷팅
const formatResponse = (jobId, svgInfo, analysis, doors, performance) => ({
  jobId,
  success: true,
  svgFile: svgInfo.filePath,
  svgFilename: svgInfo.fileName,
  fileSize: svgInfo.size,
  entityCount: analysis.structure.entityCount,
  details: {
    layers: Object.keys(analysis.structure.layerGroups).length,
    texts: analysis.texts.foundTexts.length,
    doors: doors.length || 0,
    boundingBox: analysis.structure.bbox
  },
  metadata: {
    processedAt: new Date().toISOString(),
    processingTimeMs: performance.duration,
    memoryUsage: performance.memoryUsage
  }
});

// SVG 파일 저장
const saveSvg = (jobId, svgContent) => {
  try {
    const resultsDir = path.join(__dirname, '..', '..', 'results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    const fileName = `${jobId}.svg`;
    const filePath = path.join(resultsDir, fileName);
    
    fs.writeFileSync(filePath, svgContent, 'utf8');
    
    return {
      filePath,
      fileName,
      size: svgContent.length
    };
  } catch (error) {
    throw new FileError('SVG 파일 저장 실패', {
      jobId,
      error: error.message
    });
  }
};

// 메인 처리 함수
const processDxfFile = async (jobId, filename, filePath, progressCallback) => {
  const startTime = Date.now();
  let currentStep = '';
  
  try {
    // 초기 메모리 체크
    const initialMemory = checkMemoryUsage();
    
    progressCallback(10, '파일 로드 중...');
    currentStep = 'FILE_LOAD';
    
    // 1. DXF 콘텐츠 로드
    let dxfContent;
    try {
      if (filename.toLowerCase().endsWith('.dwg')) {
        dxfContent = await convertDwgToDxf(filePath);
      } else {
        dxfContent = fs.readFileSync(filePath, 'utf8');
      }
    } catch (error) {
      throw new FileError('파일 로드 실패', {
        filename,
        filePath,
        error: error.message
      });
    }
    
    progressCallback(30, 'DXF 파싱 중...');
    currentStep = 'DXF_PARSE';
    
    // 2. Helper 초기화
    let helper;
    try {
      helper = new Helper(dxfContent);
    } catch (error) {
      throw new ParsingError('DXF 파싱 실패', {
        error: error.message
      });
    }
    
    // 중간 메모리 체크
    checkMemoryUsage();
    
    progressCallback(50, '분석 중...');
    currentStep = 'ANALYSIS';
    
    // 3. 종합 분석
    let analysis;
    try {
      analysis = performComprehensiveAnalysis(helper);
    } catch (error) {
      throw new AnalysisError('도면 분석 실패', {
        error: error.message
      });
    }
    
    progressCallback(85, 'SVG 생성 중...');
    currentStep = 'SVG_RENDER';
    
    // 4. SVG 렌더링
    let svgContent;
    try {
      svgContent = renderSvg(helper, analysis, analysis.doors);
    } catch (error) {
      throw new RenderingError('SVG 렌더링 실패', {
        error: error.message
      });
    }
    
    // 최종 메모리 체크
    const finalMemory = checkMemoryUsage();
    
    progressCallback(95, '파일 저장 중...');
    currentStep = 'SAVE';
    
    // 5. 파일 저장
    const svgInfo = saveSvg(jobId, svgContent);
    
    progressCallback(100, '완료');
    
    // 6. 성능 측정 및 응답 생성
    const duration = measurePerformance(startTime);
    
    return formatResponse(jobId, svgInfo, analysis, analysis.doors, {
      duration,
      memoryUsage: {
        initial: initialMemory,
        final: finalMemory
      }
    });
    
  } catch (error) {
    // 에러 발생 시 성능 정보 추가
    const errorDetails = {
      step: currentStep,
      duration: Date.now() - startTime,
      memoryUsage: process.memoryUsage(),
      originalError: error.message
    };
    
    // 이미 커스텀 에러인 경우 details만 보강
    if (error instanceof DwgProcessError) {
      error.details = { ...error.details, ...errorDetails };
      throw error;
    }
    
    // 일반 에러를 커스텀 에러로 변환
    throw new DwgProcessError(
      '도면 처리 중 오류가 발생했습니다',
      'PROCESS_ERROR',
      errorDetails
    );
  }
};

module.exports = {
  processDxfFile,
  formatResponse,
  saveSvg
}; 