const { parseDxfFile } = require('./utils/dxfProcessor');
const fs = require('fs');
const DxfParser = require('dxf-parser');

async function debugBlockProcessing() {
  try {
    console.log('블록 처리 분석 시작...');
    
    // 원본 DXF 분석
    const dxfFilePath = './temp/5ad67fb1-07f2-4e7a-9d46-390f5f8d436d.dxf';
    const dxfContent = fs.readFileSync(dxfFilePath, 'utf8');
    const parser = new DxfParser();
    const dxf = parser.parseSync(dxfContent);
    
    console.log('\n=== 1. 원본 DXF 블록 구조 ===');
    
    if (dxf.blocks) {
      const blockNames = Object.keys(dxf.blocks);
      console.log(`블록 개수: ${blockNames.length}개`);
      
      // 각 블록의 상세 정보
      blockNames.forEach(blockName => {
        const block = dxf.blocks[blockName];
        const entityCount = block.entities?.length || 0;
        
        if (entityCount > 0) {
          console.log(`\n블록 "${blockName}": ${entityCount}개 엔티티`);
          
          // 블록 내 엔티티 타입 분석
          const blockEntityTypes = {};
          block.entities.forEach(entity => {
            blockEntityTypes[entity.type] = (blockEntityTypes[entity.type] || 0) + 1;
          });
          
          console.log(`  엔티티 타입:`, blockEntityTypes);
          
          // 첫 번째 엔티티 샘플
          if (block.entities[0]) {
            const sample = block.entities[0];
            console.log(`  샘플 엔티티:`, {
              type: sample.type,
              layer: sample.layer,
              hasCoords: !!(sample.startPoint || sample.center || sample.vertices)
            });
          }
        }
      });
    }
    
    console.log('\n=== 2. INSERT 엔티티 분석 ===');
    
    const insertEntities = dxf.entities?.filter(e => e.type === 'INSERT') || [];
    console.log(`INSERT 엔티티: ${insertEntities.length}개`);
    
    insertEntities.slice(0, 10).forEach((insert, i) => {
      console.log(`\n${i+1}. INSERT "${insert.name}"`);
      console.log(`   Layer: ${insert.layer}`);
      console.log(`   Position: (${insert.position?.x?.toFixed(2)}, ${insert.position?.y?.toFixed(2)})`);
      console.log(`   Scale: (${insert.scale?.x || 1}, ${insert.scale?.y || 1})`);
      console.log(`   Rotation: ${insert.rotation || 0}°`);
      
      // 해당 블록 존재 여부 확인
      const block = dxf.blocks[insert.name];
      if (block) {
        console.log(`   ✅ 블록 발견: ${block.entities?.length || 0}개 엔티티`);
      } else {
        console.log(`   ❌ 블록 없음`);
      }
    });
    
    console.log('\n=== 3. 우리 파서의 결과 ===');
    
    // 우리 파서로 파싱
    const entities = await parseDxfFile(dxfFilePath);
    console.log(`총 변환된 엔티티: ${entities.length}개`);
    
    // 엔티티 타입별 통계
    const entityTypes = {};
    entities.forEach(entity => {
      entityTypes[entity.type] = (entityTypes[entity.type] || 0) + 1;
    });
    
    console.log('\n변환된 엔티티 타입:');
    Object.entries(entityTypes).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}개`);
    });
    
    // 블록에서 변환된 엔티티 개수 계산
    let blockDerivedEntities = 0;
    
    insertEntities.forEach(insert => {
      const block = dxf.blocks[insert.name];
      if (block && block.entities) {
        blockDerivedEntities += block.entities.length;
      }
    });
    
    console.log(`\n원본 DXF 엔티티: ${dxf.entities?.length || 0}개`);
    console.log(`블록에서 유도될 엔티티: ${blockDerivedEntities}개`);
    console.log(`예상 총합: ${(dxf.entities?.length || 0) + blockDerivedEntities}개`);
    console.log(`실제 변환된 엔티티: ${entities.length}개`);
    
    // L-Door 레이어 특별 분석
    console.log('\n=== 4. L-Door 레이어 분석 ===');
    
    const doorInserts = insertEntities.filter(insert => insert.layer === 'L-Door');
    console.log(`L-Door INSERT: ${doorInserts.length}개`);
    
    const doorEntities = entities.filter(entity => entity.layer === 'L-Door');
    console.log(`L-Door 변환 엔티티: ${doorEntities.length}개`);
    
    doorInserts.slice(0, 5).forEach((insert, i) => {
      console.log(`\n문 ${i+1}: ${insert.name}`);
      console.log(`  위치: (${insert.position?.x?.toFixed(2)}, ${insert.position?.y?.toFixed(2)})`);
      
      const block = dxf.blocks[insert.name];
      if (block) {
        console.log(`  블록 엔티티: ${block.entities?.length || 0}개`);
        if (block.entities && block.entities.length > 0) {
          console.log(`  블록 엔티티 타입들:`, 
            block.entities.map(e => e.type).join(', '));
        }
      }
    });
    
  } catch (error) {
    console.error('블록 분석 실패:', error.message);
  }
}

debugBlockProcessing(); 