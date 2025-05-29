/**
 * 핵심 DXF 분석 모듈 - 모든 분석 기능 통합
 */

const { detectDoors } = require('./doorDetector');

// 구조 분석
const analyzeStructure = (helper) => {
  const bbox = helper.toPolylines().bbox;
  return {
    layerGroups: helper.groups,
    bbox,
    entityCount: helper.denormalised?.length || 0
  };
};

// ARC 분석
const analyzeArcs = (helper) => {
  let count = 0;
  const angleGroups = { '90도근처': 0, '기타': 0 };
  
  helper.denormalised?.forEach(entity => {
    if (entity.type === 'ARC') {
      count++;
      const angleDiff = Math.abs(entity.endAngle - entity.startAngle);
      if (angleDiff >= 80 && angleDiff <= 100) {
        angleGroups['90도근처']++;
      } else {
        angleGroups['기타']++;
      }
    }
  });
  
  return { arcCount: count, angleGroups };
};

// 텍스트 분석
const analyzeTexts = (helper) => {
  const foundTexts = [];
  const entityTypes = {};
  
  helper.denormalised?.forEach((entity, index) => {
    const type = entity.type || 'UNKNOWN';
    entityTypes[type] = (entityTypes[type] || 0) + 1;
    
    if (['TEXT', 'MTEXT', 'ATTDEF', 'ATTRIB'].includes(type)) {
      const textFields = ['text', 'value', 'textValue', 'contents', 'string'];
      let foundText = null;
      
      textFields.forEach(field => {
        if (entity[field]?.trim()) foundText = entity[field].trim();
      });
      
      if (foundText) {
        let position = { x: 0, y: 0 };
        
        // 좌표 추출 (우선순위 순)
        if (entity.xAxisX !== undefined && entity.xAxisY !== undefined) {
          position = { x: entity.xAxisX, y: entity.xAxisY };
        } else if (entity.insertionPoint?.x || entity.insertionPoint?.y) {
          position = entity.insertionPoint;
        } else if (entity.position?.x || entity.position?.y) {
          position = entity.position;
        } else if (entity.x !== undefined && entity.y !== undefined) {
          position = { x: entity.x, y: entity.y };
        }
        
        foundTexts.push({
          text: foundText,
          position,
          layer: entity.layer || '기본',
          entityType: type,
          index,
          _entityRef: entity
        });
      }
    }
  });
  
  return { foundTexts, entityTypes };
};

// 고급 필터링
const filterEntities = (helper, bbox) => {
  if (!helper.denormalised?.length) return;
  
  const originalCount = helper.denormalised.length;
  const mainArea = {
    centerX: (bbox.min.x + bbox.max.x) / 2,
    centerY: (bbox.min.y + bbox.max.y) / 2,
    maxDistance: Math.max(bbox.max.x - bbox.min.x, bbox.max.y - bbox.min.y) * 1.5
  };
  
  helper.denormalised = helper.denormalised.filter(entity => {
    // 텍스트는 항상 유지
    if (['TEXT', 'MTEXT', 'ATTDEF', 'ATTRIB'].includes(entity.type)) return true;
    
    // 아웃라이어 제거
    const coords = extractCoords(entity);
    if (coords.length > 0) {
      const isOutlier = coords.some(coord => {
        const distance = Math.sqrt(
          Math.pow(coord.x - mainArea.centerX, 2) + 
          Math.pow(coord.y - mainArea.centerY, 2)
        );
        return distance > mainArea.maxDistance;
      });
      if (isOutlier) return false;
    }
    
    // 불필요한 엔티티 제거
    if (entity.type === 'POINT' || entity.layer === 'DEFPOINTS') return false;
    
    return true;
  });
};

// 좌표 추출 헬퍼
const extractCoords = (entity) => {
  const coords = [];
  if (entity.startPoint) coords.push(entity.startPoint);
  if (entity.endPoint) coords.push(entity.endPoint);
  if (entity.center) coords.push(entity.center);
  if (entity.position) coords.push(entity.position);
  if (entity.x !== undefined && entity.y !== undefined) {
    coords.push({ x: entity.x, y: entity.y });
  }
  if (entity.points) coords.push(...entity.points);
  return coords.filter(c => c && typeof c.x === 'number' && typeof c.y === 'number');
};

// 종합 분석
const performAnalysis = (helper) => {
  const structure = analyzeStructure(helper);
  const arcs = analyzeArcs(helper);
  const texts = analyzeTexts(helper);
  
  // 필터링 적용
  filterEntities(helper, structure.bbox);
  
  return { structure, arcs, texts };
};

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

module.exports = {
  // 핵심 함수들
  performAnalysis,
  analyzeStructure,
  analyzeArcs,
  analyzeTexts,
  filterEntities,
  // 호환성 함수들
  performComprehensiveAnalysis,
  analyzeDxfStructure,
  analyzeArcEntities,
  analyzeTextEntities
}; 