const fs = require('fs');
const DxfParser = require('dxf-parser');

async function analyzeRawDxf() {
  try {
    console.log('DXF 원본 분석 시작...');
    
    const dxfFilePath = './temp/5ad67fb1-07f2-4e7a-9d46-390f5f8d436d.dxf';
    const dxfContent = fs.readFileSync(dxfFilePath, 'utf8');
    
    // DXF 파서로 파싱
    const parser = new DxfParser();
    const dxf = parser.parseSync(dxfContent);
    
    console.log('\n=== DXF 구조 분석 ===');
    console.log(`전체 엔티티: ${dxf.entities?.length || 0}개`);
    
    // 엔티티 타입별 통계
    const entityTypes = {};
    const layerStats = {};
    
    if (dxf.entities) {
      dxf.entities.forEach(entity => {
        entityTypes[entity.type] = (entityTypes[entity.type] || 0) + 1;
        layerStats[entity.layer || 'default'] = (layerStats[entity.layer || 'default'] || 0) + 1;
      });
    }
    
    console.log('\n=== 원본 DXF 엔티티 타입 ===');
    Object.entries(entityTypes)
      .sort(([,a], [,b]) => b - a)
      .forEach(([type, count]) => {
        console.log(`  ${type}: ${count}개`);
      });
    
    // 지원되지 않는 엔티티 타입 찾기
    const supportedTypes = ['LINE', 'LWPOLYLINE', 'POLYLINE', 'CIRCLE', 'ARC', 'TEXT', 'MTEXT', 'INSERT'];
    const unsupportedTypes = Object.keys(entityTypes).filter(type => !supportedTypes.includes(type));
    
    if (unsupportedTypes.length > 0) {
      console.log('\n=== 지원되지 않는 엔티티 타입 ===');
      unsupportedTypes.forEach(type => {
        console.log(`  ${type}: ${entityTypes[type]}개`);
        
        // 첫 번째 샘플 확인
        const sample = dxf.entities.find(e => e.type === type);
        if (sample) {
          console.log(`    샘플:`, {
            layer: sample.layer,
            color: sample.color,
            keys: Object.keys(sample).slice(0, 10)
          });
        }
      });
    }
    
    // 블록 분석
    console.log('\n=== 블록 분석 ===');
    if (dxf.blocks) {
      console.log(`블록 개수: ${Object.keys(dxf.blocks).length}개`);
      
      let totalBlockEntities = 0;
      Object.entries(dxf.blocks).slice(0, 10).forEach(([blockName, block]) => {
        const entityCount = block.entities?.length || 0;
        totalBlockEntities += entityCount;
        console.log(`  ${blockName}: ${entityCount}개 엔티티`);
      });
      
      console.log(`  총 블록 엔티티: ${totalBlockEntities}개`);
    }
    
    // INSERT 엔티티 분석
    const insertEntities = dxf.entities?.filter(e => e.type === 'INSERT') || [];
    console.log(`\nINSERT 엔티티: ${insertEntities.length}개`);
    
    if (insertEntities.length > 0) {
      console.log('INSERT 샘플들:');
      insertEntities.slice(0, 10).forEach((insert, i) => {
        console.log(`  ${i+1}. ${insert.name} - Layer: ${insert.layer}`);
        if (insert.position) {
          console.log(`     위치: (${insert.position.x?.toFixed(2)}, ${insert.position.y?.toFixed(2)})`);
        }
      });
    }
    
    // 주요 레이어 분석
    console.log('\n=== 주요 레이어 분석 ===');
    Object.entries(layerStats)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 15)
      .forEach(([layer, count]) => {
        console.log(`  ${layer}: ${count}개`);
      });
    
    // 문제 엔티티 찾기 (좌표가 없거나 잘못된 것들)
    console.log('\n=== 문제 엔티티 분석 ===');
    let problemEntities = 0;
    
    dxf.entities?.forEach((entity, index) => {
      let hasProblem = false;
      
      if (entity.type === 'LINE') {
        if (!entity.startPoint && !entity.vertices) {
          console.log(`  LINE ${index}: 시작점 없음`);
          hasProblem = true;
        }
      } else if (entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') {
        if (!entity.vertices || entity.vertices.length === 0) {
          console.log(`  ${entity.type} ${index}: vertices 없음`);
          hasProblem = true;
        }
      } else if (entity.type === 'CIRCLE') {
        if (!entity.center) {
          console.log(`  CIRCLE ${index}: center 없음`);
          hasProblem = true;
        }
      }
      
      if (hasProblem) {
        problemEntities++;
        if (problemEntities <= 5) { // 처음 5개만 상세 출력
          console.log(`    상세:`, {
            type: entity.type,
            layer: entity.layer,
            keys: Object.keys(entity)
          });
        }
      }
    });
    
    console.log(`\n문제 엔티티 총 개수: ${problemEntities}개`);
    
  } catch (error) {
    console.error('DXF 분석 실패:', error.message);
  }
}

analyzeRawDxf(); 