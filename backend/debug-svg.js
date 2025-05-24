const { parseDxfFile } = require('./utils/dxfProcessor');

async function debugSvgGeneration() {
  try {
    console.log('DXF → SVG 변환 디버깅 시작...');
    const entities = await parseDxfFile('./temp/5ad67fb1-07f2-4e7a-9d46-390f5f8d436d.dxf');
    
    console.log(`총 엔티티: ${entities.length}개\n`);
    
    // 엔티티 타입별 통계
    const typeStats = {};
    entities.forEach(entity => {
      typeStats[entity.type] = (typeStats[entity.type] || 0) + 1;
    });
    
    console.log('엔티티 타입별 통계:');
    Object.entries(typeStats).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}개`);
    });
    
    // 좌표 범위 분석
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let validPoints = 0;
    
    entities.forEach(entity => {
      try {
        switch (entity.type) {
          case 'LINE':
            if (entity.start && entity.end) {
              minX = Math.min(minX, entity.start.x, entity.end.x);
              minY = Math.min(minY, entity.start.y, entity.end.y);
              maxX = Math.max(maxX, entity.start.x, entity.end.x);
              maxY = Math.max(maxY, entity.start.y, entity.end.y);
              validPoints += 2;
            }
            break;
          case 'POLYLINE':
            if (entity.vertices) {
              entity.vertices.forEach(v => {
                if (v && typeof v.x === 'number' && typeof v.y === 'number') {
                  minX = Math.min(minX, v.x);
                  minY = Math.min(minY, v.y);
                  maxX = Math.max(maxX, v.x);
                  maxY = Math.max(maxY, v.y);
                  validPoints++;
                }
              });
            }
            break;
          case 'CIRCLE':
          case 'ARC':
            if (entity.center && entity.radius) {
              const r = entity.radius;
              minX = Math.min(minX, entity.center.x - r);
              minY = Math.min(minY, entity.center.y - r);
              maxX = Math.max(maxX, entity.center.x + r);
              maxY = Math.max(maxY, entity.center.y + r);
              validPoints++;
            }
            break;
        }
      } catch (err) {
        // 오류 무시
      }
    });
    
    console.log(`\n좌표 범위 분석:`);
    console.log(`  유효한 포인트: ${validPoints}개`);
    console.log(`  X 범위: ${minX.toFixed(2)} ~ ${maxX.toFixed(2)} (폭: ${(maxX - minX).toFixed(2)})`);
    console.log(`  Y 범위: ${minY.toFixed(2)} ~ ${maxY.toFixed(2)} (높이: ${(maxY - minY).toFixed(2)})`);
    
    // 일부 엔티티 샘플 출력
    console.log(`\n샘플 엔티티들:`);
    entities.slice(0, 10).forEach((entity, i) => {
      console.log(`  ${i+1}. ${entity.type} - Layer: ${entity.layer}`);
      if (entity.type === 'LINE') {
        console.log(`     Start: (${entity.start?.x}, ${entity.start?.y})`);
        console.log(`     End: (${entity.end?.x}, ${entity.end?.y})`);
      } else if (entity.type === 'CIRCLE') {
        console.log(`     Center: (${entity.center?.x}, ${entity.center?.y}), Radius: ${entity.radius}`);
      }
    });
    
    // 레이어별 통계
    const layerStats = {};
    entities.forEach(entity => {
      layerStats[entity.layer] = (layerStats[entity.layer] || 0) + 1;
    });
    
    console.log(`\n주요 레이어들:`);
    Object.entries(layerStats)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .forEach(([layer, count]) => {
        console.log(`  ${layer}: ${count}개`);
      });
      
  } catch (error) {
    console.error('디버깅 실패:', error.message);
  }
}

debugSvgGeneration(); 