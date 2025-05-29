/**
 * 메인 DXF 프로세서 - 모든 처리 단계 통합
 */

const fs = require('fs');
const { Helper } = require('dxf');
const path = require('path');
const logger = require('../../config/logger');
const { uploadSvgToS3 } = require('../../config/s3');
const {
  DwgProcessError,
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
    logger.error('SVG 파일 저장 실패', {
      jobId,
      error: error.message,
      stack: error.stack
    });
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
    logger.info('도면 처리 시작', { jobId, filename, initialMemory });
    
    progressCallback(10, '파일 로드 중...');
    currentStep = 'FILE_LOAD';
    
    // 1. DXF 콘텐츠 로드
    let dxfContent;
    try {
      if (filename.toLowerCase().endsWith('.dwg')) {
        logger.info('DWG -> DXF 변환 시작', { jobId, filename });
        dxfContent = await convertDwgToDxf(filePath);
        logger.info('DWG -> DXF 변환 완료', { jobId, contentLength: dxfContent.length });
      } else {
        dxfContent = fs.readFileSync(filePath, 'utf8');
      }

      // 원본 파일 삭제
      fs.unlinkSync(filePath);
      logger.info('원본 파일 삭제 완료', { jobId, filePath });
    } catch (error) {
      logger.error('파일 로드 실패', { jobId, filename, error: error.message });
      throw new FileError('파일 로드 실패', {
        filename,
        filePath,
        error: error.message
      });
    }
    
    progressCallback(30, 'DXF 파싱 중...');
    currentStep = 'DXF_PARSE';
    logger.info('DXF 파싱 시작', { jobId });
    
    // 2. Helper 초기화
    let helper;
    try {
      helper = new Helper(dxfContent);
      logger.info('DXF 파싱 완료', { 
        jobId,
        entities: helper.denormalised?.length || 0,
        layers: helper.groups ? Object.keys(helper.groups).length : 0
      });
    } catch (error) {
      logger.error('DXF 파싱 실패', { jobId, error: error.message });
      throw new ParsingError('DXF 파싱 실패', {
        error: error.message
      });
    }
    
    // 중간 메모리 체크
    const midMemory = checkMemoryUsage();
    logger.info('중간 메모리 상태', { jobId, midMemory });
    
    progressCallback(50, '분석 중...');
    currentStep = 'ANALYSIS';
    logger.info('도면 분석 시작', { jobId });
    
    // 3. 종합 분석
    let analysis;
    try {
      analysis = performComprehensiveAnalysis(helper);
      logger.info('도면 분석 완료', { 
        jobId,
        entityCount: analysis.structure.entityCount,
        layerCount: Object.keys(analysis.structure.layerGroups).length,
        doorCount: analysis.doors?.length || 0
      });
    } catch (error) {
      logger.error('도면 분석 실패', { jobId, error: error.message });
      throw new AnalysisError('도면 분석 실패', {
        error: error.message
      });
    }
    
    progressCallback(85, 'SVG 생성 중...');
    currentStep = 'SVG_RENDER';
    logger.info('SVG 렌더링 시작', { 
      jobId,
      helperEntities: helper.denormalised?.length || 0,
      helperLayers: helper.groups ? Object.keys(helper.groups).length : 0,
      analysisDetails: {
        entityCount: analysis.structure.entityCount,
        layerCount: Object.keys(analysis.structure.layerGroups).length,
        doorCount: analysis.doors?.length || 0,
        textCount: analysis.texts.foundTexts.length
      }
    });
    
    // 4. SVG 렌더링
    let svgContent;
    try {
      svgContent = renderSvg(helper, analysis, analysis.doors);
      logger.info('SVG 렌더링 완료', { 
        jobId,
        svgSize: svgContent.length,
        svgStart: svgContent.substring(0, 100),
        svgEnd: svgContent.substring(svgContent.length - 100)
      });
    } catch (error) {
      logger.error('SVG 렌더링 실패', { 
        jobId, 
        error: error.message,
        stack: error.stack,
        helperState: {
          hasHelper: !!helper,
          entityCount: helper?.denormalised?.length,
          hasGroups: !!helper?.groups
        }
      });
      throw new RenderingError('SVG 렌더링 실패', {
        error: error.message
      });
    }

    // 5. S3에 업로드 (백그라운드에서 처리)
    progressCallback(95, '이미지 저장 중...');
    currentStep = 'S3_UPLOAD';
    logger.info('S3 업로드 시작', { jobId });

    let imageUrl;
    try {
      imageUrl = await uploadSvgToS3(jobId, svgContent);
      logger.info('S3 업로드 완료', { 
        jobId, 
        imageUrl,
        uploadTime: new Date().toISOString()
      });
    } catch (error) {
      logger.error('S3 업로드 실패', { 
        jobId, 
        error: error.message,
        stack: error.stack 
      });
      // S3 업로드 실패해도 계속 진행 (나중에 재시도 가능)
      logger.warn('S3 업로드 실패했지만 계속 진행합니다', { jobId });
    }
    
    progressCallback(100, '완료');
    
    // 6. 성능 측정 및 응답 생성
    const duration = Date.now() - startTime;
    logger.info('도면 처리 완료', { 
      jobId,
      duration,
      memoryUsage: process.memoryUsage()
    });
    
    return {
      jobId,
      success: true,
      svgContent, // SVG 내용 직접 포함
      imageUrl,   // S3 URL (백업용)
      entityCount: analysis.structure.entityCount,
      details: {
        layers: Object.keys(analysis.structure.layerGroups).length,
        texts: analysis.texts.foundTexts.length,
        doors: analysis.doors?.length || 0,
        boundingBox: analysis.structure.bbox
      },
      metadata: {
        processedAt: new Date().toISOString(),
        processingTimeMs: duration,
        memoryUsage: process.memoryUsage()
      }
    };
    
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