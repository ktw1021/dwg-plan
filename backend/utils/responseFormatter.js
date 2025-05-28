/**
 * 응답 포맷터 모듈
 * 최종 결과를 정리하고 프론트엔드로 보낼 응답을 포맷팅
 */

const fs = require('fs');
const path = require('path');

/**
 * SVG 파일 저장
 */
const saveSvgFile = (jobId, svgContent) => {
  try {
    const svgFileName = `${jobId}.svg`;
    const svgFilePath = path.join(__dirname, '..', 'results', svgFileName);
    
    const resultsDir = path.dirname(svgFilePath);
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    fs.writeFileSync(svgFilePath, svgContent, 'utf8');
    console.log(`💾 SVG 파일 저장: ${svgFilePath}`);
    console.log(`📊 SVG 파일 크기: ${(svgContent.length / 1024).toFixed(1)} KB`);
    
    return {
      filePath: svgFilePath,
      fileName: svgFileName,
      size: svgContent.length
    };
    
  } catch (error) {
    console.error('SVG 파일 저장 실패:', error.message);
    throw error;
  }
};

/**
 * 처리 통계 생성
 */
const generateProcessingStats = (analysisResult, filteringResult, customRenderResult) => {
  const stats = {
    // 기본 통계
    totalEntitiesOriginal: analysisResult.structure.entityCount,
    totalEntitiesFiltered: filteringResult?.remainingCount || analysisResult.structure.entityCount,
    layerCount: Object.keys(analysisResult.structure.layerGroups).length,
    
    // 엔티티 타입별 통계
    entityTypes: analysisResult.texts.entityTypes,
    
    // 분석 결과
    arcCount: analysisResult.arcs.arcCount,
    textCount: analysisResult.texts.foundTexts.length,
    roomCandidates: analysisResult.texts.foundTexts.filter(t => t.isRoomCandidate).length,
    doorCandidates: analysisResult.doors.length,
    
    // 커스텀 렌더링 통계
    customRendering: customRenderResult.counts,
    
    // 필터링 통계
    filtering: {
      originalCount: analysisResult.structure.entityCount,
      filteredCount: filteringResult?.remainingCount || analysisResult.structure.entityCount,
      removedCount: filteringResult?.removedCount || 0,
      removalPercentage: filteringResult?.removalPercentage || 0
    },
    
    // 도면 정보
    drawing: {
      boundingBox: analysisResult.structure.bbox,
      size: {
        width: analysisResult.structure.bbox.max.x - analysisResult.structure.bbox.min.x,
        height: analysisResult.structure.bbox.max.y - analysisResult.structure.bbox.min.y
      }
    }
  };
  
  return stats;
};

/**
 * 레이어 정보 포맷팅
 */
const formatLayerInfo = (layerGroups, layerImportance) => {
  const layerInfo = [];
  
  Object.entries(layerGroups).forEach(([layerName, entities]) => {
    const importance = layerImportance?.[layerName] || { finalScore: 0.5 };
    
    layerInfo.push({
      name: layerName,
      entityCount: entities.length,
      importance: importance.finalScore,
      entityTypes: entities.reduce((types, entity) => {
        const type = entity.type || 'UNKNOWN';
        types[type] = (types[type] || 0) + 1;
        return types;
      }, {})
    });
  });
  
  // 중요도 순으로 정렬
  layerInfo.sort((a, b) => b.importance - a.importance);
  
  return layerInfo;
};

/**
 * 텍스트 정보 포맷팅
 */
const formatTextInfo = (textAnalysis) => {
  const textInfo = {
    total: textAnalysis.foundTexts.length,
    roomCandidates: textAnalysis.foundTexts.filter(t => t.isRoomCandidate),
    otherTexts: textAnalysis.foundTexts.filter(t => !t.isRoomCandidate),
    entityTypeDistribution: textAnalysis.entityTypes
  };
  
  return textInfo;
};

/**
 * 문 정보 포맷팅
 */
const formatDoorInfo = (doorAnalysis) => {
  return doorAnalysis.map(door => ({
    center: door.center,
    radius: door.radius,
    angle: door.angle,
    layer: door.layer
  }));
};

/**
 * 성공 응답 포맷팅
 */
const formatSuccessResponse = (jobId, svgFileInfo, analysisResult, filteringResult, customRenderResult, processingMethod) => {
  const stats = generateProcessingStats(analysisResult, filteringResult, customRenderResult);
  
  const response = {
    jobId,
    success: true,
    processingMethod,
    
    // 파일 정보
    svgFile: svgFileInfo.filePath,
    svgFilename: svgFileInfo.fileName,
    svgPath: svgFileInfo.filePath,
    fileSize: svgFileInfo.size,
    
    // 처리 통계
    entityCount: stats.totalEntitiesFiltered,
    originalEntityCount: stats.totalEntitiesOriginal,
    
    // 상세 정보
    details: {
      stats,
      layers: formatLayerInfo(analysisResult.structure.layerGroups, filteringResult?.layerImportance),
      texts: formatTextInfo(analysisResult.texts),
      doors: formatDoorInfo(analysisResult.doors),
      customRendering: customRenderResult.counts,
      boundingBox: stats.drawing.boundingBox,
      drawingSize: stats.drawing.size
    },
    
    // 메타데이터
    metadata: {
      processedAt: new Date().toISOString(),
      processingTimeMs: Date.now() - (global.processingStartTime || Date.now()),
      version: '2.0.0-modular'
    }
  };
  
  return response;
};

/**
 * 에러 응답 포맷팅
 */
const formatErrorResponse = (jobId, error, processingMethod = 'unknown') => {
  console.error(`❌ 작업 ${jobId} 실패:`, error.message);
  
  const response = {
    jobId,
    success: false,
    processingMethod,
    error: {
      message: error.message,
      type: error.constructor.name,
      timestamp: new Date().toISOString()
    },
    
    // 부분적 결과가 있다면 포함
    partialResults: null,
    
    // 메타데이터
    metadata: {
      processedAt: new Date().toISOString(),
      processingTimeMs: Date.now() - (global.processingStartTime || Date.now()),
      version: '2.0.0-modular'
    }
  };
  
  return response;
};

/**
 * 진행 상황 로깅
 */
const logProcessingProgress = (stage, details = {}) => {
  const timestamp = new Date().toISOString();
  const elapsed = Date.now() - (global.processingStartTime || Date.now());
  
  console.log(`⏱️  [${timestamp}] ${stage} (${elapsed}ms)`);
  
  if (Object.keys(details).length > 0) {
    Object.entries(details).forEach(([key, value]) => {
      console.log(`   ${key}: ${value}`);
    });
  }
};

/**
 * 최종 처리 요약 로깅
 */
const logProcessingSummary = (response) => {
  console.log('\n📋 === 처리 완료 요약 ===');
  console.log(`작업 ID: ${response.jobId}`);
  console.log(`성공 여부: ${response.success ? '✅ 성공' : '❌ 실패'}`);
  console.log(`처리 방법: ${response.processingMethod}`);
  
  if (response.success) {
    console.log(`SVG 파일: ${response.svgFilename}`);
    console.log(`파일 크기: ${(response.fileSize / 1024).toFixed(1)} KB`);
    console.log(`엔티티 개수: ${response.originalEntityCount} → ${response.entityCount}`);
    
    if (response.details) {
      console.log(`레이어 개수: ${response.details.layers.length}`);
      console.log(`텍스트 개수: ${response.details.texts.total}`);
      console.log(`방 후보: ${response.details.texts.roomCandidates.length}`);
      console.log(`문 후보: ${response.details.doors.length}`);
      console.log(`커스텀 렌더링: MTEXT(${response.details.customRendering.mtextCount}), HATCH(${response.details.customRendering.hatchCount})`);
    }
  } else {
    console.log(`오류: ${response.error.message}`);
  }
  
  console.log(`처리 시간: ${response.metadata.processingTimeMs}ms`);
  console.log('========================\n');
};

/**
 * 임시 파일 정리
 */
const cleanupTempFiles = (tempFiles = []) => {
  tempFiles.forEach(filePath => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`🗑️  임시 파일 삭제: ${filePath}`);
      }
    } catch (error) {
      console.warn(`임시 파일 삭제 실패: ${filePath}`, error.message);
    }
  });
};

module.exports = {
  saveSvgFile,
  generateProcessingStats,
  formatLayerInfo,
  formatTextInfo,
  formatDoorInfo,
  formatSuccessResponse,
  formatErrorResponse,
  logProcessingProgress,
  logProcessingSummary,
  cleanupTempFiles
}; 