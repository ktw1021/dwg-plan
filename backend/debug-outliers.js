const { parseDxfFile } = require('./utils/dxfProcessor');

async function findOutliers() {
  try {
    console.log('아웃라이어 분석 시작...');
    const entities = await parseDxfFile('./temp/5ad67fb1-07f2-4e7a-9d46-390f5f8d436d.dxf');
    
    // 모든 좌표 수집
    const allPoints = [];
    
    entities.forEach((entity, index) => {
      try {
        switch (entity.type) {
          case 'LINE':
            if (entity.start && entity.end) {
              allPoints.push({ ...entity.start, entityIndex: index, entityType: 'LINE', layer: entity.layer, pointType: 'start' });
              allPoints.push({ ...entity.end, entityIndex: index, entityType: 'LINE', layer: entity.layer, pointType: 'end' });
            }
            break;
          case 'POLYLINE':
            if (entity.vertices) {
              entity.vertices.forEach((v, vi) => {
                if (v && typeof v.x === 'number' && typeof v.y === 'number') {
                  allPoints.push({ ...v, entityIndex: index, entityType: 'POLYLINE', layer: entity.layer, pointType: `vertex_${vi}` });
                }
              });
            }
            break;
          case 'CIRCLE':
          case 'ARC':
            if (entity.center && entity.radius) {
              allPoints.push({ ...entity.center, entityIndex: index, entityType: entity.type, layer: entity.layer, pointType: 'center' });
            }
            break;
        }
      } catch (err) {
        // 오류 무시
      }
    });
    
    console.log(`총 포인트: ${allPoints.length}개`);
    
    // X, Y 좌표별로 정렬
    const xSorted = [...allPoints].sort((a, b) => a.x - b.x);
    const ySorted = [...allPoints].sort((a, b) => a.y - b.y);
    
    console.log('\n극값 분석:');
    console.log('X 좌표:');
    console.log(`  최솟값: ${xSorted[0].x} (${xSorted[0].layer}, ${xSorted[0].entityType})`);
    console.log(`  최댓값: ${xSorted[xSorted.length-1].x} (${xSorted[xSorted.length-1].layer}, ${xSorted[xSorted.length-1].entityType})`);
    
    console.log('Y 좌표:');
    console.log(`  최솟값: ${ySorted[0].y} (${ySorted[0].layer}, ${ySorted[0].entityType})`);
    console.log(`  최댓값: ${ySorted[ySorted.length-1].y} (${ySorted[ySorted.length-1].layer}, ${ySorted[ySorted.length-1].entityType})`);
    
    // 아웃라이어 분석 (상하위 1% 제외한 범위 계산)
    const outlierPercent = 0.01;
    const xStart = Math.floor(allPoints.length * outlierPercent);
    const xEnd = Math.ceil(allPoints.length * (1 - outlierPercent));
    
    const xMainRange = {
      min: xSorted[xStart].x,
      max: xSorted[xEnd - 1].x
    };
    
    const yMainRange = {
      min: ySorted[xStart].y,
      max: ySorted[xEnd - 1].y
    };
    
    console.log(`\n메인 범위 (상하위 1% 제외):`);
    console.log(`  X: ${xMainRange.min.toFixed(2)} ~ ${xMainRange.max.toFixed(2)} (폭: ${(xMainRange.max - xMainRange.min).toFixed(2)})`);
    console.log(`  Y: ${yMainRange.min.toFixed(2)} ~ ${yMainRange.max.toFixed(2)} (높이: ${(yMainRange.max - yMainRange.min).toFixed(2)})`);
    
    // 아웃라이어 엔티티 찾기
    console.log(`\n아웃라이어 엔티티들:`);
    
    const outliers = allPoints.filter(p => 
      p.x < xMainRange.min || p.x > xMainRange.max ||
      p.y < yMainRange.min || p.y > yMainRange.max
    );
    
    // 엔티티별로 그룹화
    const outlierEntities = {};
    outliers.forEach(p => {
      if (!outlierEntities[p.entityIndex]) {
        outlierEntities[p.entityIndex] = {
          entity: entities[p.entityIndex],
          points: []
        };
      }
      outlierEntities[p.entityIndex].points.push(p);
    });
    
    Object.entries(outlierEntities).slice(0, 20).forEach(([index, data]) => {
      console.log(`  엔티티 ${index}: ${data.entity.type} - Layer: ${data.entity.layer}`);
      data.points.forEach(p => {
        console.log(`    ${p.pointType}: (${p.x.toFixed(2)}, ${p.y.toFixed(2)})`);
      });
    });
    
    console.log(`\n총 아웃라이어 엔티티: ${Object.keys(outlierEntities).length}개`);
    
  } catch (error) {
    console.error('아웃라이어 분석 실패:', error.message);
  }
}

findOutliers(); 