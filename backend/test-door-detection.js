/**
 * 문 감지 독립 테스트 + SVG 생성
 */

const fs = require('fs');
const { Helper } = require('dxf');
const { detect90DegreeDoors } = require('./utils/dxfAnalyzer');

async function testDoorDetection() {
  try {
    console.log('🚪 === 문 감지 독립 테스트 시작 ===');
    
    // DXF 파일 로드 - 실제 존재하는 파일 사용
    const dxfPath = './temp/2476ca9d-0e9c-4d66-b2d0-19afc0bce2fa.dxf';
    
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
    console.log('   helper.denormalised 길이:', helper?.denormalised?.length || 0);
    
    // 직접 detect90DegreeDoors 함수 호출
    console.log('\n🚪 detect90DegreeDoors 함수 직접 호출...');
    const doorResult = detect90DegreeDoors(helper);
    
    console.log('\n📊 문 감지 결과:');
    console.log('   doorResult 타입:', typeof doorResult);
    console.log('   doorResult.length:', doorResult?.length);
    console.log('   doorResult.doors:', doorResult?.doors?.length);
    
    // 결과 처리 - 배열인지 객체인지 확인
    let doors = [];
    if (Array.isArray(doorResult)) {
      doors = doorResult;
    } else if (doorResult && doorResult.doors && Array.isArray(doorResult.doors)) {
      doors = doorResult.doors;
    } else if (doorResult && doorResult.length !== undefined) {
      doors = doorResult;
    }
    
    console.log(`   최종 감지된 문 개수: ${doors.length}개`);
    
    if (doors.length > 0) {
      console.log('\n🗺️ 감지된 문 목록:');
      doors.forEach((door, index) => {
        console.log(`   문 ${index + 1}:`);
        console.log(`     타입: ${door.type}`);
        console.log(`     중심: (${door.center?.x?.toFixed(0)}, ${door.center?.y?.toFixed(0)})`);
        console.log(`     반지름: ${door.radius?.toFixed(0)}mm`);
        console.log(`     각도: ${door.angle?.toFixed(1)}°`);
        console.log(`     신뢰도: ${(door.confidence * 100).toFixed(0)}%`);
        console.log(`     레이어: ${door.layer}`);
      });
      
      // SVG 생성 및 박스 추가 테스트
      console.log('\n🎨 === SVG 생성 및 박스 추가 테스트 ===');
      
      // 기본 SVG 생성
      const baseSvg = helper.toSVG();
      console.log(`📄 기본 SVG 크기: ${(baseSvg.length / 1024).toFixed(1)} KB`);
      
      // 문 마커 HTML 추가 - KITCHEN 텍스트와 같은 방식으로 생성
      console.log('🔧 KITCHEN 스타일로 텍스트 생성');
      
      // 수동으로 박스와 텍스트 추가
      let doorMarkersHtml = '\n  <!-- 감지된 문 마커 (빨간색 박스 + KITCHEN 스타일 텍스트) -->\n';
      doors.forEach((door, index) => {
        const centerX = door.center?.x || 0;
        const centerY = door.center?.y || 0;
        
        // SVG 좌표계 변환 (Y축 뒤집기)
        const svgCenterX = centerX;
        const svgCenterY = -centerY;
        
        let markerSize = 400; // 기본 크기
        if (door.type === 'ARC_DOOR' && door.radius) {
          markerSize = Math.min(Math.max(door.radius * 0.8, 300), 800);
        }
        
        // 빨간색 박스
        doorMarkersHtml += `  <rect ` +
                          `x="${svgCenterX - markerSize/2}" ` +
                          `y="${svgCenterY - markerSize/2}" ` +
                          `width="${markerSize}" ` +
                          `height="${markerSize}" ` +
                          `fill="none" ` +
                          `stroke="#ff0000" ` +
                          `stroke-width="20" ` +
                          `opacity="0.8"/>\n`;
        
        // KITCHEN 스타일 텍스트 - 첫 번째 방식
        const fontSize1 = Math.max(markerSize * 0.3, 80); // 박스 크기의 30%, 최소 80px
        doorMarkersHtml += `  <text ` +
                          `x="${svgCenterX}" ` +
                          `y="${svgCenterY}" ` +
                          `font-size="${fontSize1}" ` +
                          `text-anchor="middle" ` +
                          `dominant-baseline="middle" ` +
                          `fill="#000000" ` +
                          `stroke="#ffffff" ` +
                          `stroke-width="3" ` +
                          `font-weight="bold">문${index + 1}</text>\n`;
        
        // KITCHEN 스타일 텍스트 - 두 번째 방식 (더 큰 텍스트)
        const fontSize2 = Math.max(markerSize * 0.5, 120); // 박스 크기의 50%, 최소 120px
        doorMarkersHtml += `  <text ` +
                          `class="mtext-custom" ` +
                          `x="${svgCenterX}" ` +
                          `y="${svgCenterY + fontSize2/4}" ` +
                          `font-size="${fontSize2}" ` +
                          `transform="rotate(0 ${svgCenterX} ${svgCenterY})" ` +
                          `fill="#ff0000" ` +
                          `stroke="#ffffff" ` +
                          `stroke-width="5" ` +
                          `font-weight="bold">D${index + 1}</text>\n`;
      });
      
      console.log(`📝 ${doors.length}개의 박스와 텍스트 생성됨`);
      
      // SVG 파일에 텍스트 추가 - 강제로 파일 끝에 추가
      let svgWithMarkers = baseSvg;
      
      // 기존 </svg> 태그 제거 (있다면)
      svgWithMarkers = svgWithMarkers.replace(/<\/svg>\s*$/, '');
      
      // 파일 끝에 텍스트와 </svg> 태그 추가
      svgWithMarkers = svgWithMarkers + doorMarkersHtml + '\n</svg>';
      
      console.log(`📝 SVG 파일에 ${doors.length}개의 텍스트 라벨 추가됨`);
      
      // SVG 파일 저장
      const outputPath = './results/door-detection-test.svg';
      fs.writeFileSync(outputPath, svgWithMarkers);
      console.log(`✅ SVG 파일 저장됨: ${outputPath}`);
      console.log(`📄 최종 SVG 크기: ${(svgWithMarkers.length / 1024).toFixed(1)} KB`);
      
      // 빨간색 박스 개수 확인
      const redBoxCount = (svgWithMarkers.match(/stroke="#ff0000"/g) || []).length;
      console.log(`🔍 빨간색 박스 개수: ${redBoxCount}개`);
      
      // 텍스트 라벨 개수 확인
      const textLabelCount = (svgWithMarkers.match(/문\d+</g) || []).length;
      console.log(`🔍 텍스트 라벨 개수: ${textLabelCount}개`);
      
    } else {
      console.log('⚠️ 감지된 문이 없습니다.');
    }
    
    console.log('\n✅ === 문 감지 독립 테스트 완료 ===');
    
  } catch (error) {
    console.error('❌ 테스트 실패:', error.message);
    console.error('❌ 에러 스택:', error.stack);
  }
}

// 테스트 실행
testDoorDetection(); 