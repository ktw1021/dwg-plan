/**
 * 메인 DXF 프로세서 - 모든 처리 단계 통합
 */

const fs = require('fs');
const { Helper } = require('dxf');
const path = require('path');

const { convertDwgToDxf } = require('./dwgConverter');
const { performAnalysis } = require('../core/analyzer');
const { detectDoors } = require('../core/doorDetector');
const { renderSvg } = require('../renderers/svg');

// 응답 포맷팅
const formatResponse = (jobId, svgInfo, analysis, doors) => ({
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
    processingTimeMs: Date.now() - (global.processingStartTime || Date.now())
  }
});

// SVG 파일 저장
const saveSvg = (jobId, svgContent) => {
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
};

// 메인 처리 함수
const processDxfFile = async (jobId, filename, filePath, progressCallback) => {
  global.processingStartTime = Date.now();
  
  try {
    progressCallback(10, '파일 로드 중...');
    
    // 1. DXF 콘텐츠 로드
    let dxfContent;
    if (filename.toLowerCase().endsWith('.dwg')) {
      dxfContent = await convertDwgToDxf(filePath);
    } else {
      dxfContent = fs.readFileSync(filePath, 'utf8');
    }
    
    progressCallback(30, 'DXF 파싱 중...');
    
    // 2. Helper 초기화
    const helper = new Helper(dxfContent);
    
    progressCallback(50, '분석 중...');
    
    // 3. 종합 분석
    const analysis = performAnalysis(helper);
    
    progressCallback(70, '문 감지 중...');
    
    // 4. 문 감지
    const doors = detectDoors(helper);
    
    progressCallback(85, 'SVG 생성 중...');
    
    // 5. SVG 렌더링
    const svgContent = renderSvg(helper, analysis, doors);
    
    progressCallback(95, '파일 저장 중...');
    
    // 6. 파일 저장
    const svgInfo = saveSvg(jobId, svgContent);
    
    progressCallback(100, '완료');
    
    // 7. 응답 생성
    return formatResponse(jobId, svgInfo, analysis, doors);
    
  } catch (error) {
    console.error(`처리 오류: ${error.message}`);
    throw error;
  }
};

module.exports = {
  processDxfFile,
  formatResponse,
  saveSvg
}; 