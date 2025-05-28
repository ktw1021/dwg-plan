/**
 * DXF 프로세서 - 메인 오케스트레이터 (모듈화 버전)
 * 모든 DXF 처리 단계를 조율하는 메인 컨트롤러
 */

const fs = require('fs');
const { Helper } = require('dxf');

// 모듈화된 컴포넌트들
const { loadDxfContent } = require('./dwgConverter');
const { performComprehensiveAnalysis } = require('./dxfAnalyzer');
const { advancedFilterEntities } = require('./entityFilter');
const { renderCustomEntities } = require('./customRenderer');
const { mergeHelperAndCustomSvg, postProcessSvg } = require('./svgMerger');
const { 
  saveSvgFile, 
  formatSuccessResponse, 
  formatErrorResponse, 
  logProcessingProgress, 
  logProcessingSummary,
  cleanupTempFiles 
} = require('./responseFormatter');

/**
 * DWG/DXF 파일 처리 메인 함수 (모듈화 버전)
 */
const processCompleteDxfFile = async (jobId, filename, filePath, progressCallback) => {
  // 처리 시작 시간 기록
  global.processingStartTime = Date.now();
  
  try {
    console.log('\n🚀 === DXF 처리 시작 (모듈화 버전) ===');
    console.log(`작업 ID: ${jobId}`);
    console.log(`파일명: ${filename}`);
    
    // 파일 존재 확인
    if (!fs.existsSync(filePath)) {
      throw new Error('파일을 찾을 수 없습니다');
    }
    
    logProcessingProgress('파일 분석 시작');
    progressCallback(10, '파일 분석 중...');
    
    // 1단계: DXF 콘텐츠 로드 (DWG 변환 포함)
    logProcessingProgress('DXF 콘텐츠 로드');
    progressCallback(20, 'DXF 콘텐츠 로드 중...');
    const dxfContent = await loadDxfContent(filename, filePath);
    console.log(`파일 크기: ${(dxfContent.length / 1024).toFixed(1)} KB`);
    
    // 2단계: DXF Helper 초기화 및 파싱
    logProcessingProgress('DXF 파싱');
    progressCallback(30, 'DXF 파싱 중...');
    const helper = new Helper(dxfContent);
    
    // 3단계: 종합 분석 수행
    logProcessingProgress('종합 분석 수행');
    progressCallback(40, '종합 분석 중...');
    const analysisResult = performComprehensiveAnalysis(helper);
    
    // 4단계: 고급 엔티티 필터링 (텍스트 보존하면서 이상한 점들 제거)
    logProcessingProgress('고급 엔티티 필터링');
    progressCallback(50, '고급 엔티티 필터링 중 (텍스트 보존)...');
    const polylinesData = analysisResult.structure.polylinesData;
    const originalCount = helper.denormalised?.length || 0;
    advancedFilterEntities(helper, polylinesData);  // 다시 활성화
    
    // 필터링 결과 기록
    const filteringResult = {
      remainingCount: helper.denormalised?.length || 0,
      removedCount: originalCount - (helper.denormalised?.length || 0),
      removalPercentage: ((originalCount - (helper.denormalised?.length || 0)) / originalCount * 100).toFixed(1)
    };
    
    // 5단계: 커스텀 엔티티 렌더링 (MTEXT, HATCH 등)
    logProcessingProgress('커스텀 엔티티 렌더링');
    progressCallback(60, 'MTEXT, HATCH 등 커스텀 렌더링 중...');
    const viewBox = { 
      width: polylinesData.bbox.max.x - polylinesData.bbox.min.x,
      height: polylinesData.bbox.max.y - polylinesData.bbox.min.y 
    };
    const customRenderResult = renderCustomEntities(helper, viewBox);
    
    // 6단계: SVG 병합 및 최적화
    logProcessingProgress('SVG 병합 및 최적화');
    progressCallback(70, 'SVG 병합 및 최적화 중...');
    let finalSvgContent = mergeHelperAndCustomSvg(helper, customRenderResult);
    
    // 7단계: SVG 후처리
    logProcessingProgress('SVG 후처리');
    progressCallback(80, 'SVG 후처리 중...');
    finalSvgContent = postProcessSvg(finalSvgContent);
    
    // 8단계: SVG 파일 저장
    logProcessingProgress('SVG 파일 저장');
    progressCallback(90, 'SVG 파일 저장 중...');
    const svgFileInfo = saveSvgFile(jobId, finalSvgContent);
    
    // 9단계: 최종 응답 포맷팅
    logProcessingProgress('응답 포맷팅');
    progressCallback(95, '응답 포맷팅 중...');
    const response = formatSuccessResponse(
      jobId, 
      svgFileInfo, 
      analysisResult, 
      filteringResult, 
      customRenderResult, 
      'dxf-library-modular-v2'
    );
    
    progressCallback(100, 'DXF 처리 완료');
    logProcessingSummary(response);
    
    return response;
    
  } catch (error) {
    console.error(`파일 처리 오류: ${error.message}`);
    
    const errorResponse = formatErrorResponse(jobId, error, 'dxf-library-modular-v2');
    logProcessingSummary(errorResponse);
    
    throw error;
  } finally {
    // 임시 파일 정리 (필요한 경우)
    cleanupTempFiles();
  }
};

// 기존 함수명과의 호환성을 위한 별칭
const processDwgFile = processCompleteDxfFile;

module.exports = {
  processCompleteDxfFile,
  processDwgFile
};
