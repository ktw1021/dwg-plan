/**
 * DXF 분석 메인 오케스트레이터 - 새로운 구조 사용
 */

const { performAnalysis, analyzeStructure, analyzeArcs, analyzeTexts } = require('./core/analyzer');
const { detectDoors } = require('./core/doorDetector');

/**
 * 종합 분석 실행 (기존 호환성 유지)
 */
const performComprehensiveAnalysis = (helper) => {
  try {
    const analysis = performAnalysis(helper);
    const doors = detectDoors(helper);
    
    return {
      structure: {
        ...analysis.structure,
        polylinesData: { bbox: analysis.structure.bbox } // 기존 호환성
      },
      arcs: analysis.arcs,
      texts: analysis.texts,
      doors: doors
    };
  } catch (error) {
    throw error;
  }
};

// 기존 함수명과의 호환성을 위한 별칭들
const analyzeDxfStructure = (helper) => {
  const result = analyzeStructure(helper);
  return {
    ...result,
    polylinesData: { bbox: result.bbox } // 기존 호환성
  };
};

const analyzeArcEntities = analyzeArcs;
const analyzeTextEntities = analyzeTexts;
const detect90DegreeDoors = detectDoors;

// 외부 호환성을 위한 개별 함수 re-export
module.exports = {
  performComprehensiveAnalysis,
  // 개별 함수들 (기존 코드와의 호환성 유지)
  analyzeDxfStructure,
  analyzeArcEntities,
  analyzeTextEntities,
  detect90DegreeDoors
};