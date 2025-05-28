/**
 * 엔티티 필터링 모듈
 * DXF 라이브러리의 모든 기능을 활용한 고급 필터링 시스템
 */

/**
 * DXF 라이브러리의 모든 기능을 활용한 고급 엔티티 필터링
 */
const advancedFilterEntities = (helper, polylinesData) => {
  try {
    if (!helper.denormalised || helper.denormalised.length === 0) {
      console.log('필터링할 엔티티가 없음');
      return;
    }

    const originalCount = helper.denormalised.length;
    console.log(`\n🚀 고급 엔티티 필터링 시작 (총 ${originalCount}개)`);

    // 1단계: Polylines 경계 박스 활용
    const bbox = polylinesData.bbox;
    console.log(`Polylines 경계 박스: X(${bbox.min.x.toFixed(1)} ~ ${bbox.max.x.toFixed(1)}), Y(${bbox.min.y.toFixed(1)} ~ ${bbox.max.y.toFixed(1)})`);

    // 2단계: 레이어별 분석 및 중요도 계산
    const layerGroups = helper.groups;
    const layerImportance = calculateLayerImportance(layerGroups, polylinesData);
    
    // 3단계: 엔티티 타입별 중요도 분석
    const entityTypeStats = analyzeEntityTypes(helper.denormalised);
    
    // 4단계: 공간적 밀도 분석
    const spatialAnalysis = analyzeSpatialDensity(polylinesData);
    
      // 5단계: 다중 기준 필터링 + 아웃라이어 제거
  const filteredEntities = helper.denormalised.filter(entity => {
    // 텍스트는 무조건 통과
    if (entity.type === 'TEXT' || entity.type === 'MTEXT' || entity.type === 'ATTDEF' || entity.type === 'ATTRIB') {
      return true;
    }
    
    // 아웃라이어 체크: 메인 도면 영역에서 너무 멀리 떨어진 엔티티 제거
    const coords = extractEntityCoordinates(entity);
    if (coords.length > 0) {
      const mainArea = {
        centerX: (bbox.min.x + bbox.max.x) / 2,
        centerY: (bbox.min.y + bbox.max.y) / 2,
        width: bbox.max.x - bbox.min.x,
        height: bbox.max.y - bbox.min.y
      };
      
      // 메인 영역의 3배를 벗어나는 엔티티는 아웃라이어로 간주
      const maxDistance = Math.max(mainArea.width, mainArea.height) * 1.5;
      
      const isOutlier = coords.some(coord => {
        const distanceFromCenter = Math.sqrt(
          Math.pow(coord.x - mainArea.centerX, 2) + 
          Math.pow(coord.y - mainArea.centerY, 2)
        );
        return distanceFromCenter > maxDistance;
      });
      
      if (isOutlier) {
        console.log(`   🚫 아웃라이어 제거: ${entity.type} (거리=${Math.sqrt(Math.pow(coords[0].x - mainArea.centerX, 2) + Math.pow(coords[0].y - mainArea.centerY, 2)).toFixed(0)})`);
        return false;
      }
    }
    
    // 일반 중요도 필터링
    return isEntityImportant(entity, {
      bbox, layerImportance, entityTypeStats, spatialAnalysis, polylinesData
    });
  });

    // 6단계: 결과 적용
    helper.denormalised = filteredEntities;
    
    const removedCount = originalCount - filteredEntities.length;
    const removalPercentage = ((removedCount / originalCount) * 100).toFixed(1);
    
    console.log(`✅ 고급 필터링 완료: ${removedCount}개 제거 (${removalPercentage}%)`);
    console.log(`남은 엔티티: ${filteredEntities.length}개`);

    // 7단계: 필터링 결과 상세 분석
    logFilteringResults(helper.denormalised, layerGroups);

  } catch (error) {
    console.warn('고급 엔티티 필터링 실패:', error.message);
    // 실패 시 기본 필터링으로 fallback
    basicFilterEntities(helper);
  }
};

/**
 * 레이어별 중요도 계산
 */
const calculateLayerImportance = (layerGroups, polylinesData) => {
  const importance = {};
  const totalEntities = Object.values(layerGroups).reduce((sum, entities) => sum + entities.length, 0);
  
  Object.entries(layerGroups).forEach(([layerName, entities]) => {
    const entityCount = entities.length;
    const entityRatio = entityCount / totalEntities;
    
    // 레이어 이름 기반 중요도
    let nameScore = 0.5; // 기본값
    const lowerName = layerName.toLowerCase();
    
    if (lowerName.includes('wall') || lowerName.includes('벽')) nameScore = 1.0;
    else if (lowerName.includes('door') || lowerName.includes('문')) nameScore = 0.9;
    else if (lowerName.includes('window') || lowerName.includes('창')) nameScore = 0.9;
    else if (lowerName.includes('room') || lowerName.includes('방')) nameScore = 0.8;
    else if (lowerName.includes('text') || lowerName.includes('dim')) nameScore = 0.7;
    else if (lowerName.includes('hatch') || lowerName.includes('해치')) nameScore = 0.6;
    else if (lowerName === '0' || lowerName === 'defpoints') nameScore = 0.3;
    
    // 엔티티 개수 기반 중요도 (많을수록 중요)
    const countScore = Math.min(entityRatio * 5, 1.0);
    
    importance[layerName] = {
      nameScore,
      countScore,
      entityCount,
      entityRatio,
      finalScore: (nameScore * 0.7) + (countScore * 0.3)
    };
    
    console.log(`레이어 "${layerName}": 중요도=${importance[layerName].finalScore.toFixed(2)} (이름=${nameScore}, 개수=${countScore.toFixed(2)}, 엔티티=${entityCount}개)`);
  });
  
  return importance;
};

/**
 * 엔티티 타입별 분석
 */
const analyzeEntityTypes = (entities) => {
  const typeStats = {};
  const totalCount = entities.length;
  
  entities.forEach(entity => {
    const type = entity.type || 'UNKNOWN';
    if (!typeStats[type]) {
      typeStats[type] = { count: 0, importance: 0.5 };
    }
    typeStats[type].count++;
  });
  
  // 타입별 중요도 설정
  Object.keys(typeStats).forEach(type => {
    const ratio = typeStats[type].count / totalCount;
    let importance = 0.5;
    
    switch (type) {
      case 'LINE': importance = 1.0; break;
      case 'POLYLINE': 
      case 'LWPOLYLINE': importance = 0.95; break;
      case 'ARC': importance = 0.9; break;
      case 'CIRCLE': importance = 0.85; break;
      case 'TEXT':
      case 'MTEXT': importance = 0.7; break;
      case 'INSERT': importance = 0.8; break;
      case 'HATCH': importance = 0.6; break;
      case 'DIMENSION': importance = 0.4; break;
      case 'POINT': importance = 0.2; break;
      default: importance = 0.5;
    }
    
    typeStats[type].importance = importance;
    typeStats[type].ratio = ratio;
    
    console.log(`엔티티 타입 "${type}": ${typeStats[type].count}개 (${(ratio * 100).toFixed(1)}%), 중요도=${importance}`);
  });
  
  return typeStats;
};

/**
 * 공간적 밀도 분석 (Polylines 기반)
 */
const analyzeSpatialDensity = (polylinesData) => {
  const bbox = polylinesData.bbox;
  const gridSize = 25;
  const cellWidth = (bbox.max.x - bbox.min.x) / gridSize;
  const cellHeight = (bbox.max.y - bbox.min.y) / gridSize;
  
  const densityGrid = Array(gridSize).fill().map(() => Array(gridSize).fill(0));
  
  // Polylines의 각 점에 대해 밀도 계산
  polylinesData.polylines.forEach(polyline => {
    polyline.vertices.forEach(vertex => {
      const x = vertex[0];
      const y = vertex[1];
      
      const cellX = Math.floor((x - bbox.min.x) / cellWidth);
      const cellY = Math.floor((y - bbox.min.y) / cellHeight);
      
      if (cellX >= 0 && cellX < gridSize && cellY >= 0 && cellY < gridSize) {
        densityGrid[cellY][cellX]++;
      }
    });
  });
  
  // 고밀도 영역 찾기
  const densities = [];
  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      if (densityGrid[y][x] > 0) {
        densities.push({
          x, y,
          density: densityGrid[y][x],
          realX: bbox.min.x + (x + 0.5) * cellWidth,
          realY: bbox.min.y + (y + 0.5) * cellHeight
        });
      }
    }
  }
  
  densities.sort((a, b) => b.density - a.density);
  const avgDensity = densities.reduce((sum, d) => sum + d.density, 0) / densities.length;
  const highDensityThreshold = avgDensity * 1.5;
  
  const highDensityAreas = densities.filter(d => d.density >= highDensityThreshold);
  
  console.log(`공간 밀도 분석: 평균=${avgDensity.toFixed(1)}, 고밀도 영역=${highDensityAreas.length}개`);
  
  return {
    grid: densityGrid,
    gridSize,
    cellWidth,
    cellHeight,
    avgDensity,
    highDensityAreas,
    bbox
  };
};

/**
 * 다중 기준으로 엔티티 중요도 판단
 */
const isEntityImportant = (entity, criteria) => {
  const { bbox, layerImportance, entityTypeStats, spatialAnalysis } = criteria;
  
  // 1. 레이어 중요도
  const layerInfo = layerImportance[entity.layer] || { finalScore: 0.3 };
  const layerScore = layerInfo.finalScore;
  
  // 2. 엔티티 타입 중요도
  const typeInfo = entityTypeStats[entity.type] || { importance: 0.5 };
  const typeScore = typeInfo.importance;
  
  // 3. 공간적 위치 점수
  const spatialScore = calculateSpatialScore(entity, spatialAnalysis);
  
  // 4. 경계 박스 내부 여부
  const coords = extractEntityCoordinates(entity);
  const coordsInBbox = coords.filter(coord => 
    coord.x >= bbox.min.x && coord.x <= bbox.max.x &&
    coord.y >= bbox.min.y && coord.y <= bbox.max.y
  );
  const bboxScore = coords.length > 0 ? coordsInBbox.length / coords.length : 1.0;
  
  // 5. 최종 점수 계산 (가중 평균)
  const finalScore = (layerScore * 0.3) + (typeScore * 0.25) + (spatialScore * 0.25) + (bboxScore * 0.2);
  
  // 임계값: 0.4 이상이면 중요한 엔티티로 판단
  const isImportant = finalScore >= 0.4;
  
  // 특별 규칙: 텍스트는 무조건 보존 (점수 무관)
  if (entity.type === 'TEXT' || entity.type === 'MTEXT' || entity.type === 'ATTDEF' || entity.type === 'ATTRIB') {
    // 텍스트 내용이 있으면 무조건 보존
    const textContent = entity.text || entity.contents || entity.string || entity.value;
    if (textContent && typeof textContent === 'string' && textContent.trim()) {
      console.log(`   📝 텍스트 엔티티 무조건 보존: "${textContent.trim()}" (점수=${finalScore.toFixed(2)})`);
      return true;
    }
    // 텍스트 내용이 없어도 텍스트 타입이면 보존
    console.log(`   📝 텍스트 타입 엔티티 보존: ${entity.type} (점수=${finalScore.toFixed(2)})`);
    return true;
  }
  
  return isImportant;
};

/**
 * 엔티티의 공간적 점수 계산
 */
const calculateSpatialScore = (entity, spatialAnalysis) => {
  const coords = extractEntityCoordinates(entity);
  if (coords.length === 0) return 0.5;
  
  let totalScore = 0;
  let validCoords = 0;
  
  coords.forEach(coord => {
    const cellX = Math.floor((coord.x - spatialAnalysis.bbox.min.x) / spatialAnalysis.cellWidth);
    const cellY = Math.floor((coord.y - spatialAnalysis.bbox.min.y) / spatialAnalysis.cellHeight);
    
    if (cellX >= 0 && cellX < spatialAnalysis.gridSize && 
        cellY >= 0 && cellY < spatialAnalysis.gridSize) {
      const density = spatialAnalysis.grid[cellY][cellX];
      const normalizedDensity = Math.min(density / spatialAnalysis.avgDensity, 2.0) / 2.0;
      totalScore += normalizedDensity;
      validCoords++;
    }
  });
  
  return validCoords > 0 ? totalScore / validCoords : 0.5;
};

/**
 * 엔티티에서 좌표 추출
 */
const extractEntityCoordinates = (entity) => {
  const coords = [];

  // 다양한 엔티티 타입별 좌표 추출
  if (entity.start) coords.push(entity.start);
  if (entity.end) coords.push(entity.end);
  if (entity.center) coords.push(entity.center);
  if (entity.position) coords.push(entity.position);
  if (entity.startPoint) coords.push(entity.startPoint);
  if (entity.endPoint) coords.push(entity.endPoint);
  if (entity.vertices) coords.push(...entity.vertices);
  if (entity.controlPoints) coords.push(...entity.controlPoints);

  // LINE, POLYLINE 등의 좌표
  if (entity.x !== undefined && entity.y !== undefined) {
    coords.push({ x: entity.x, y: entity.y });
  }

  return coords;
};

/**
 * 필터링 결과 상세 로깅
 */
const logFilteringResults = (remainingEntities, originalLayerGroups) => {
  console.log('\n📊 필터링 결과 분석:');
  
  const remainingByLayer = {};
  const remainingByType = {};
  
  remainingEntities.forEach(entity => {
    const layer = entity.layer || 'unknown';
    const type = entity.type || 'unknown';
    
    remainingByLayer[layer] = (remainingByLayer[layer] || 0) + 1;
    remainingByType[type] = (remainingByType[type] || 0) + 1;
  });
  
  console.log('\n레이어별 남은 엔티티:');
  Object.entries(remainingByLayer)
    .sort((a, b) => b[1] - a[1])
    .forEach(([layer, count]) => {
      const original = originalLayerGroups[layer]?.length || 0;
      const percentage = original > 0 ? ((count / original) * 100).toFixed(1) : '0';
      console.log(`  ${layer}: ${count}개 (원본 ${original}개의 ${percentage}%)`);
    });
  
  console.log('\n타입별 남은 엔티티:');
  Object.entries(remainingByType)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`  ${type}: ${count}개`);
    });
};

/**
 * 기본 필터링 (fallback용)
 */
const basicFilterEntities = (helper) => {
  try {
    if (!helper.denormalised || helper.denormalised.length === 0) {
      console.log('필터링할 엔티티가 없음');
      return;
    }

    const originalCount = helper.denormalised.length;
    console.log(`\n🔍 기본 엔티티 필터링 시작 (총 ${originalCount}개)`);

    // 간단한 경계 박스 기반 필터링
    const polylinesData = helper.toPolylines();
    const bbox = polylinesData.bbox;
    
    const filteredEntities = helper.denormalised.filter(entity => {
      // 텍스트 엔티티는 무조건 보존
      if (entity.type === 'TEXT' || entity.type === 'MTEXT' || entity.type === 'ATTDEF' || entity.type === 'ATTRIB') {
        return true;
      }
      
      const coords = extractEntityCoordinates(entity);
      if (coords.length === 0) return true;
      
      const coordsInBbox = coords.filter(coord => 
        coord.x >= bbox.min.x && coord.x <= bbox.max.x &&
        coord.y >= bbox.min.y && coord.y <= bbox.max.y
      );
      
      return coordsInBbox.length / coords.length >= 0.5; // 50% 이상이 경계 박스 내부
    });

    helper.denormalised = filteredEntities;
    
    const removedCount = originalCount - filteredEntities.length;
    const removalPercentage = ((removedCount / originalCount) * 100).toFixed(1);
    
    console.log(`✅ 기본 필터링 완료: ${removedCount}개 제거 (${removalPercentage}%)`);
    console.log(`남은 엔티티: ${filteredEntities.length}개`);

  } catch (error) {
    console.warn('기본 엔티티 필터링 실패:', error.message);
  }
};

module.exports = {
  advancedFilterEntities,
  calculateLayerImportance,
  analyzeEntityTypes,
  analyzeSpatialDensity,
  isEntityImportant,
  calculateSpatialScore,
  extractEntityCoordinates,
  logFilteringResults,
  basicFilterEntities
}; 