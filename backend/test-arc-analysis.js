/**
 * ARC 엔티티 구조 분석 테스트
 */

const fs = require('fs');
const { Helper } = require('dxf');

async function analyzeArcStructure() {
  try {
    console.log('🔍 === ARC 엔티티 구조 분석 시작 ===');
    
    // DXF 파일 로드
    const dxfPath = './temp/3eb2532c-e2b3-40f7-bfda-ee8191d2c183.dxf';
    
    if (!fs.existsSync(dxfPath)) {
      console.error('❌ DXF 파일을 찾을 수 없습니다:', dxfPath);
      return;
    }
    
    const dxfContent = fs.readFileSync(dxfPath, 'utf8');
    console.log(`📄 DXF 파일 크기: ${(dxfContent.length / 1024).toFixed(1)} KB`);
    
    // Helper 초기화
    const helper = new Helper(dxfContent);
    
    console.log('🔍 Helper 객체 분석:');
    console.log('   helper.parsed:', !!helper.parsed);
    console.log('   helper.denormalised:', !!helper.denormalised);
    console.log('   helper.parsed.entities 길이:', helper.parsed?.entities?.length || 0);
    console.log('   helper.denormalised 길이:', helper.denormalised?.length || 0);
    
    // 원시 파싱 데이터에서 ARC 찾기
    if (helper.parsed && helper.parsed.entities) {
      console.log('\n🔍 원시 파싱 데이터에서 ARC 엔티티 찾기:');
      const rawArcs = helper.parsed.entities.filter(entity => entity.type === 'ARC');
      console.log(`원시 ARC 엔티티 개수: ${rawArcs.length}개`);
      
      if (rawArcs.length > 0) {
        console.log('\n📋 첫 번째 원시 ARC 엔티티:');
        console.log(JSON.stringify(rawArcs[0], null, 2));
        
        console.log('\n📋 두 번째 원시 ARC 엔티티:');
        if (rawArcs[1]) {
          console.log(JSON.stringify(rawArcs[1], null, 2));
        }
        
        console.log('\n📋 세 번째 원시 ARC 엔티티:');
        if (rawArcs[2]) {
          console.log(JSON.stringify(rawArcs[2], null, 2));
        }
      }
    }
    
    // 정규화된 데이터에서 ARC 찾기
    if (helper.denormalised) {
      console.log('\n🔍 정규화된 데이터에서 ARC 엔티티 찾기:');
      const normalizedArcs = helper.denormalised.filter(entity => entity.type === 'ARC');
      console.log(`정규화된 ARC 엔티티 개수: ${normalizedArcs.length}개`);
      
      if (normalizedArcs.length > 0) {
        console.log('\n📋 첫 번째 정규화된 ARC 엔티티:');
        console.log(JSON.stringify(normalizedArcs[0], null, 2));
        
        console.log('\n📋 두 번째 정규화된 ARC 엔티티:');
        if (normalizedArcs[1]) {
          console.log(JSON.stringify(normalizedArcs[1], null, 2));
        }
        
        console.log('\n📋 세 번째 정규화된 ARC 엔티티:');
        if (normalizedArcs[2]) {
          console.log(JSON.stringify(normalizedArcs[2], null, 2));
        }
        
        // 속성 분석
        console.log('\n🔍 ARC 엔티티 속성 분석:');
        normalizedArcs.slice(0, 5).forEach((arc, index) => {
          console.log(`\nARC ${index + 1}:`);
          console.log('   모든 속성:', Object.keys(arc));
          
          // 좌표 관련 속성
          const coordProps = ['center', 'centerPoint', 'position', 'startPoint', 'x', 'y', 'centerX', 'centerY'];
          console.log('   좌표 속성:');
          coordProps.forEach(prop => {
            if (arc[prop] !== undefined) {
              console.log(`     ${prop}:`, arc[prop]);
            }
          });
          
          // 크기 관련 속성
          const sizeProps = ['radius', 'r', 'rad', 'size', 'diameter'];
          console.log('   크기 속성:');
          sizeProps.forEach(prop => {
            if (arc[prop] !== undefined) {
              console.log(`     ${prop}:`, arc[prop]);
            }
          });
          
          // 각도 관련 속성
          const angleProps = ['startAngle', 'endAngle', 'start', 'end', 'angle', 'totalAngle'];
          console.log('   각도 속성:');
          angleProps.forEach(prop => {
            if (arc[prop] !== undefined) {
              console.log(`     ${prop}:`, arc[prop]);
            }
          });
        });
      }
    }
    
    console.log('\n✅ === ARC 엔티티 구조 분석 완료 ===');
    
  } catch (error) {
    console.error('❌ 분석 실패:', error.message);
    console.error('❌ 스택:', error.stack);
  }
}

// 실행
analyzeArcStructure(); 