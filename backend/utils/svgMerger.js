/**
 * SVG 병합 모듈
 * DXF Helper의 기본 SVG와 커스텀 렌더링 요소들을 병합하고 최적화
 */

const { analyzeTextEntities, detect90DegreeDoors } = require('./dxfAnalyzer');
const SwingDoorDetector = require('./doorDetector');

/**
 * viewBox 정보 추출
 */
const extractViewBox = (svgContent) => {
  const viewBoxMatch = svgContent.match(/viewBox="([^"]+)"/);
  if (!viewBoxMatch) {
    return { x: 0, y: 0, width: 1000, height: 1000 };
  }
  
  const [x, y, width, height] = viewBoxMatch[1].split(' ').map(Number);
  return { x, y, width, height };
};

/**
 * 벽 색상 변경 (노란색 + 회색 → 진한 녹색)
 */
const changeWallColors = (svgContent) => {
  try {
    console.log('🎨 벽 색상을 진한 녹색으로 변경 중...');
    
    return svgContent
      // 노란색 계열
      .replace(/stroke="yellow"/g, 'stroke="#006400"')
      .replace(/stroke="Yellow"/g, 'stroke="#006400"')
      .replace(/stroke="#FFFF00"/g, 'stroke="#006400"')
      .replace(/stroke="#ffff00"/g, 'stroke="#006400"')
      .replace(/stroke="rgb\(255,255,0\)"/g, 'stroke="#006400"')
      // 회색 계열 (주요 벽 색상)
      .replace(/stroke="rgb\(65,\s*65,\s*65\)"/g, 'stroke="#006400"')
      .replace(/stroke="rgb\(128,\s*128,\s*128\)"/g, 'stroke="#006400"')
      .replace(/stroke="rgb\(169,\s*169,\s*169\)"/g, 'stroke="#006400"')
      .replace(/stroke="rgb\(211,\s*211,\s*211\)"/g, 'stroke="#006400"')
      .replace(/stroke="#808080"/g, 'stroke="#006400"')
      .replace(/stroke="#A9A9A9"/g, 'stroke="#006400"')
      .replace(/stroke="#D3D3D3"/g, 'stroke="#006400"')
      .replace(/stroke="#696969"/g, 'stroke="#006400"')
      // Fill 색상도 변경
      .replace(/fill="yellow"/g, 'fill="#006400"')
      .replace(/fill="rgb\(65,\s*65,\s*65\)"/g, 'fill="#006400"')
      .replace(/fill="#808080"/g, 'fill="#006400"');
    
  } catch (error) {
    console.warn('벽 색상 변경 실패:', error.message);
    return svgContent;
  }
};

/**
 * SVG viewBox 최적화
 */
const optimizeViewBox = (svgContent) => {
  try {
    console.log('📐 SVG viewBox 최적화 중...');
    
    const viewBoxMatch = svgContent.match(/viewBox="([^"]+)"/);
    if (!viewBoxMatch) {
      console.warn('viewBox를 찾을 수 없음');
      return svgContent;
    }
    
    const currentViewBox = viewBoxMatch[1];
    const [x, y, width, height] = currentViewBox.split(' ').map(Number);
    
    console.log(`현재 viewBox: x=${x.toFixed(0)}, y=${y.toFixed(0)}, w=${width.toFixed(0)}, h=${height.toFixed(0)}`);
    
    // 모든 path 요소에서 좌표 추출
    const pathRegex = /<path d="([^"]+)"/g;
    const coordRegex = /[ML]\s*([\d.-]+)[\s,]+([\d.-]+)/g;
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let coordCount = 0;
    
    let pathMatch;
    while ((pathMatch = pathRegex.exec(svgContent)) !== null) {
      const pathData = pathMatch[1];
      let coordMatch;
      
      while ((coordMatch = coordRegex.exec(pathData)) !== null) {
        const px = parseFloat(coordMatch[1]);
        const py = parseFloat(coordMatch[2]);
        
        if (!isNaN(px) && !isNaN(py) && isFinite(px) && isFinite(py)) {
          minX = Math.min(minX, px);
          minY = Math.min(minY, py);
          maxX = Math.max(maxX, px);
          maxY = Math.max(maxY, py);
          coordCount++;
        }
      }
    }
    
    console.log(`추출된 좌표 개수: ${coordCount}`);
    console.log(`좌표 범위: X(${minX.toFixed(0)} ~ ${maxX.toFixed(0)}), Y(${minY.toFixed(0)} ~ ${maxY.toFixed(0)})`);
    
    if (minX === Infinity || coordCount < 10) {
      console.warn('충분한 유효 좌표를 찾을 수 없음, 원본 viewBox 유지');
      return svgContent;
    }
    
    // 현재 viewBox와 추출된 좌표 범위 비교
    const extractedWidth = maxX - minX;
    const extractedHeight = maxY - minY;
    const currentArea = width * height;
    const extractedArea = extractedWidth * extractedHeight;
    
    // 추출된 범위가 현재 viewBox보다 10배 이상 클 경우 최적화 건너뛰기
    if (extractedArea > currentArea * 10) {
      console.warn('추출된 좌표 범위가 너무 큼, 원본 viewBox 유지');
      return svgContent;
    }
    
    // 5% 여백 추가
    const margin = Math.max(extractedWidth * 0.05, extractedHeight * 0.05, 50);
    const newX = minX - margin;
    const newY = minY - margin;
    const newWidth = extractedWidth + (margin * 2);
    const newHeight = extractedHeight + (margin * 2);
    
    const newViewBox = `${newX.toFixed(2)} ${newY.toFixed(2)} ${newWidth.toFixed(2)} ${newHeight.toFixed(2)}`;
    
    console.log(`최적화된 viewBox: ${newViewBox}`);
    
    // viewBox 교체
    return svgContent.replace(/viewBox="[^"]+"/, `viewBox="${newViewBox}"`);
    
  } catch (error) {
    console.warn('viewBox 최적화 실패:', error.message);
    return svgContent;
  }
};

/**
 * 문 감지 마커 추가 (빨간색 박스)
 */
const add90DegreeDoorMarkers = (svgContent, helper) => {
  try {
    console.log('\n🚪 === add90DegreeDoorMarkers 함수 시작 ===');
    console.log('helper 객체 확인:', !!helper);
    console.log('helper.denormalised 확인:', !!helper?.denormalised);
    console.log('helper.denormalised 길이:', helper?.denormalised?.length || 0);
    
    console.log('🔍 detect90DegreeDoors 호출 시작...');
    const doors = detect90DegreeDoors(helper);
    console.log('🔍 detect90DegreeDoors 호출 완료. 결과:', doors);
    console.log('🔍 반환된 문 개수:', doors?.length || 0);
    
    console.log(`🚪 ${doors.length}개의 문 마커 추가 중...`);
    
    if (doors.length === 0) {
      console.log('감지된 문이 없어서 마커를 추가하지 않음');
      return svgContent;
    }
    
    // 🔥 직접 생성된 HTML 사용
    if (doors.doorMarkersHtml) {
      console.log('🔥 직접 생성된 빨간색 박스 HTML 사용');
      const svgEndIndex = svgContent.lastIndexOf('</svg>');
      if (svgEndIndex !== -1) {
        const result = svgContent.slice(0, svgEndIndex) + doors.doorMarkersHtml + svgContent.slice(svgEndIndex);
        console.log(`🔥 빨간색 박스 추가 완료: ${svgContent.length} -> ${result.length} (${result.length - svgContent.length} 바이트 추가)`);
        return result;
      }
    }
    
    console.log('⚠️ doorMarkersHtml이 없어서 기존 방식 사용');
    
    const svgEndIndex = svgContent.lastIndexOf('</svg>');
    if (svgEndIndex === -1) {
      return svgContent;
    }
    
    // 문 마커 생성
    let doorMarkersHtml = '\n  <!-- 감지된 문 마커 (빨간색 박스) -->\n';
    doors.forEach((door, index) => {
      const centerX = door.center?.x || 0;
      const centerY = door.center?.y || 0;
      
      // 문 타입에 따라 마커 크기 결정
      let markerSize = 300; // 기본 크기 (30cm)
      
      if (door.type === 'ARC_DOOR' && door.radius) {
        markerSize = door.radius * 2; // ARC 반지름의 2배로 설정 (호의 지름)
        console.log(`   ARC 문 마커 크기: 반지름=${door.radius.toFixed(0)}mm -> 마커=${markerSize.toFixed(0)}mm`);
      } else if (door.type === 'INSERT_DOOR') {
        markerSize = 400; // INSERT 블록은 조금 더 크게
      }
      
      // 빨간색 박스 마커 생성 (인라인 스타일 사용)
      doorMarkersHtml += `  <rect ` +
                        `x="${centerX - markerSize/2}" y="${centerY - markerSize/2}" ` +
                        `width="${markerSize}" height="${markerSize}" ` +
                        `stroke="#ff0000" stroke-width="6" fill="none" opacity="0.9" />\n`;
      
      // 문 번호 라벨 추가 (인라인 스타일 사용)
      doorMarkersHtml += `  <text ` +
                        `x="${centerX}" y="${centerY + 5}" ` +
                        `text-anchor="middle" dominant-baseline="middle" ` +
                        `font-family="Arial, sans-serif" font-size="24" font-weight="bold" ` +
                        `fill="#ff0000" stroke="#ffffff" stroke-width="1">문${index + 1}</text>\n`;
      
      console.log(`   문 ${index + 1}: (${centerX.toFixed(0)}, ${centerY.toFixed(0)}) - ${door.type} - 크기=${markerSize.toFixed(0)}`);
    });
    
    // 문 마커를 SVG 끝 부분에 추가
    return svgContent.slice(0, svgEndIndex) + doorMarkersHtml + svgContent.slice(svgEndIndex);
    
  } catch (error) {
    console.warn('문 마커 추가 실패:', error.message);
    return svgContent;
  }
};

/**
 * 방 이름 텍스트 추가
 */
const addRoomLabels = (svgContent, helper) => {
  try {
    console.log('\n🏠 === 방 라벨 추가 시작 ===');
    
    const roomTexts = analyzeTextEntities(helper);
    console.log(`📍 analyzeTextEntities 결과:`, {
      foundTexts: roomTexts.foundTexts?.length || 0,
      totalTexts: roomTexts.foundTexts || []
    });
    
    const roomCandidates = roomTexts.foundTexts.filter(t => t.isRoomCandidate);
    console.log(`📍 방 후보 필터링 결과: ${roomCandidates.length}개`);
    
    // 방 후보가 없어도 강제로 테스트 텍스트 추가
    if (roomCandidates.length === 0) {
      console.log('⚠️ 방 라벨이 없어서 강제로 테스트 텍스트 추가');
      
      // 강제 테스트 텍스트 추가
      const viewBox = extractViewBox(svgContent);
      const centerX = viewBox.x + viewBox.width / 2;
      const centerY = viewBox.y + viewBox.height / 2;
      
      const svgEndIndex = svgContent.lastIndexOf('</svg>');
      if (svgEndIndex !== -1) {
        let testLabelsHtml = '\n  <!-- 강제 테스트 라벨 -->\n';
        
        // 테스트 텍스트들 (온라인 SVG 형식으로)
        const testTexts = ['KITCHEN', 'BEDROOM', 'BATHROOM', 'LIVING ROOM'];
        testTexts.forEach((text, index) => {
          const x = centerX + (index - 1.5) * 300;
          const y = centerY + (index % 2) * 200;
          const fontSize = 120;
          const textWidth = text.length * fontSize * 0.6;
          const textHeight = fontSize * 1.2;
          
          // 배경 박스 제거 - 텍스트만 깔끔하게 표시
          
          // 온라인 SVG 형식의 텍스트
          const textId = `test_text_${index + 1}`;
          testLabelsHtml += `  <g id="${textId}" stroke="rgb(255,0,0)" fill="rgb(255,0,0)">\n`;
          
          // 텍스트 요소 (transform 없이 직접 렌더링)
          testLabelsHtml += `    <text x="${x.toFixed(12)}" y="${y.toFixed(12)}" font-size="${fontSize}" text-anchor="middle" dominant-baseline="middle">${text}</text>\n`;
          
          testLabelsHtml += `  </g>\n`;
        });
        
        console.log(`🧪 강제 테스트 텍스트 ${testTexts.length}개 추가됨`);
        return svgContent.slice(0, svgEndIndex) + testLabelsHtml + svgContent.slice(svgEndIndex);
      }
      
      return svgContent;
    }
    
    console.log(`🏠 ${roomCandidates.length}개의 방 라벨 추가 중...`);
    
    const viewBox = extractViewBox(svgContent);
    const centerX = viewBox.x + viewBox.width / 2;
    const centerY = viewBox.y + viewBox.height / 2;
    
    const svgEndIndex = svgContent.lastIndexOf('</svg>');
    if (svgEndIndex === -1) {
      return svgContent;
    }
    
    // 방 라벨 생성
    let roomLabelsHtml = '\n  <!-- 방 이름 라벨 -->\n';
    roomCandidates.forEach((roomText, index) => {
      const pos = roomText.position;
      
      // 실제 좌표가 있으면 사용, 없으면 fallback 위치 계산
      let x, y;
      if (pos.x !== 0 || pos.y !== 0) {
        // DXF 좌표를 SVG 좌표로 변환 (Y축 뒤집기)
        x = pos.x;
        y = -pos.y; // Y축 뒤집기 적용
        console.log(`   방 라벨 "${roomText.text}" 실제 위치 사용: DXF(${pos.x}, ${pos.y}) -> SVG(${x}, ${y})`);
      } else {
        // viewBox 내에서 적절한 위치에 배치
        const cols = Math.ceil(Math.sqrt(roomCandidates.length));
        const row = Math.floor(index / cols);
        const col = index % cols;
        
        x = viewBox.x + (viewBox.width * 0.1) + (col * viewBox.width * 0.8 / cols);
        y = viewBox.y + (viewBox.height * 0.1) + (row * viewBox.height * 0.8 / Math.ceil(roomCandidates.length / cols));
        
        console.log(`   방 라벨 "${roomText.text}" fallback 위치 사용: x=${x}, y=${y} (${row},${col})`);
      }
      
      const cleanText = roomText.text.replace(/\\pxqc;/g, '').replace(/\\P/g, ' ').trim();
      
      // DXF에서 제공하는 실제 텍스트 크기 사용
      let textWidth, textHeight, fontSize;
      
      // DXF verticalHeight를 우선 사용 (이미 적절한 크기로 설정됨)
      if (roomText.verticalHeight && roomText.verticalHeight > 0) {
        textWidth = roomText.horizontalWidth || (cleanText.length * roomText.verticalHeight * 0.6);
        textHeight = roomText.verticalHeight;
        fontSize = roomText.verticalHeight; // DXF에서 설정된 크기 그대로 사용
        console.log(`   텍스트 "${cleanText}" verticalHeight 사용: 폭=${textWidth.toFixed(1)}, 높이=${textHeight.toFixed(1)}, 폰트=${fontSize.toFixed(1)}`);
      } else if (roomText.nominalTextHeight) {
        // fallback: nominalTextHeight 사용
        fontSize = roomText.nominalTextHeight * 0.08;
        textWidth = roomText.horizontalWidth || (cleanText.length * fontSize * 0.6);
        textHeight = fontSize * 1.2;
        console.log(`   텍스트 "${cleanText}" nominalTextHeight 기준: 폭=${textWidth.toFixed(1)}, 높이=${textHeight.toFixed(1)}, 폰트=${fontSize.toFixed(1)}, nominal=${roomText.nominalTextHeight.toFixed(1)}`);
      } else {
        // fallback: 기존 방식
        fontSize = 120;
        textWidth = cleanText.length * fontSize * 0.6;
        textHeight = fontSize * 1.2;
        console.log(`   텍스트 "${cleanText}" fallback 크기 사용: 폭=${textWidth.toFixed(1)}, 높이=${textHeight.toFixed(1)}, 폰트=${fontSize.toFixed(1)}`);
      }
      // 노란색 배경 박스 제거 - 텍스트만 깔끔하게 표시
      
      // 온라인 SVG 형식을 따라한 정확한 텍스트 구조
      const textId = `text_${index + 1}`;
      
      // <g> 그룹으로 감싸고 stroke와 fill 속성 추가
      roomLabelsHtml += `  <g id="${textId}" stroke="rgb(0,0,0)" fill="rgb(0,0,0)">\n`;
      
      // 텍스트 요소 (transform 없이 직접 렌더링)
      roomLabelsHtml += `    <text x="${x.toFixed(12)}" y="${y.toFixed(12)}" font-size="${fontSize}" text-anchor="middle" dominant-baseline="middle">${cleanText}</text>\n`;
      
      roomLabelsHtml += `  </g>\n`;
    });
    
    return svgContent.slice(0, svgEndIndex) + roomLabelsHtml + svgContent.slice(svgEndIndex);
    
  } catch (error) {
    console.warn('방 라벨 추가 실패:', error.message);
    return svgContent;
  }
};

/**
 * 통합 스타일 생성
 */
const generateIntegratedStyles = (viewBox, customStyles) => {
  const fontSize = Math.min(viewBox.width, viewBox.height) * 0.02;
  
  const baseStyles = `  <style>
    /* 기본 스타일 */
    .room-label { 
      font-family: Arial, sans-serif;
      font-size: ${fontSize}px;
      fill: #333333;
      text-anchor: middle;
      dominant-baseline: middle;
      pointer-events: none;
    }
    .room-name {
      font-weight: bold;
      font-size: ${fontSize * 1.2}px;
      fill: #000080;
      text-shadow: 1px 1px 2px rgba(255,255,255,0.8);
    }
  </style>\n`;
  
  return baseStyles + customStyles;
};

/**
 * Helper SVG와 커스텀 요소들을 병합
 */
const mergeHelperAndCustomSvg = (helper, customRenderResult) => {
  console.log('\n🔧🔧🔧 === mergeHelperAndCustomSvg 함수 진입 ===');
  console.log('🔧🔧🔧 helper 객체:', !!helper);
  console.log('🔧🔧🔧 customRenderResult 객체:', !!customRenderResult);
  
  try {
    console.log('\n🔧 === SVG 병합 시작 ===');
    
    // helper 객체 유효성 검사
    if (!helper) {
      throw new Error('helper 객체가 null 또는 undefined입니다');
    }
    
    if (typeof helper.toSVG !== 'function') {
      throw new Error('helper.toSVG 함수가 존재하지 않습니다');
    }
    
    console.log('🔧 helper.toSVG() 호출 시작...');
    
    // 1단계: Helper에서 기본 SVG 생성
    let svgContent = helper.toSVG();
    
    console.log('🔧 helper.toSVG() 호출 완료');
    console.log(`기본 SVG 크기: ${(svgContent.length / 1024).toFixed(1)} KB`);
    
    // 2단계: viewBox 정보 추출
    const viewBox = extractViewBox(svgContent);
    console.log(`ViewBox: ${viewBox.width} x ${viewBox.height}`);
    
    // 3단계: 벽 색상 변경
    svgContent = changeWallColors(svgContent);
    
    // 4단계: viewBox 최적화 (텍스트가 잘리지 않도록 주의)
    // svgContent = optimizeViewBox(svgContent);  // 임시로 비활성화
    
    // 5단계: 문 마커 추가 (빨간색 박스)
    console.log('🚪🚪🚪 === 5단계: 문 마커 추가 시작 ===');
    console.log('🚪🚪🚪 add90DegreeDoorMarkers 호출 직전');
    console.log('🚪🚪🚪 helper 객체:', !!helper);
    console.log('🚪🚪🚪 helper.denormalised:', !!helper?.denormalised);
    console.log('🚪🚪🚪 helper.denormalised 길이:', helper?.denormalised?.length || 0);
    
    try {
      console.log('🚪🚪🚪 add90DegreeDoorMarkers 함수 호출 시작...');
      const beforeLength = svgContent.length;
      
      console.log('🚪🚪🚪 === CRITICAL: add90DegreeDoorMarkers 함수 강제 호출 ===');
      console.log('🚪🚪🚪 SVG 길이 (호출 전):', beforeLength);
      console.log('🚪🚪🚪 helper 상태:', typeof helper);
      console.log('🚪🚪🚪 add90DegreeDoorMarkers 함수 존재:', typeof add90DegreeDoorMarkers);
      
      svgContent = add90DegreeDoorMarkers(svgContent, helper);
      
      const afterLength = svgContent.length;
      console.log(`🚪🚪🚪 add90DegreeDoorMarkers 완료: ${beforeLength} -> ${afterLength} (${afterLength - beforeLength} 바이트 추가)`);
      
      // 빨간색 박스가 실제로 추가되었는지 확인
      const redBoxCount = (svgContent.match(/stroke="#ff0000"/g) || []).length;
      console.log(`🚪🚪🚪 빨간색 박스 개수 확인: ${redBoxCount}개`);
      
      if (redBoxCount > 0) {
        console.log('🚪🚪🚪 ✅ 빨간색 박스가 성공적으로 추가됨!');
      } else {
        console.log('🚪🚪🚪 ❌ 빨간색 박스가 추가되지 않음!');
      }
      
    } catch (doorMarkerError) {
      console.error('🚪🚪🚪 add90DegreeDoorMarkers 에러:', doorMarkerError.message);
      console.error('🚪🚪🚪 에러 스택:', doorMarkerError.stack);
    }
    
    console.log('🚪🚪🚪 === 5단계: 문 마커 추가 완료 ===');
    
    // 6단계: 스윙도어 감지 및 표시
    try {
      console.log('🚪 스윙도어 감지 및 표시 중...');
      const swingDoorDetector = new SwingDoorDetector();
      const doorDetectionResult = swingDoorDetector.processSwingDoorDetection(svgContent);
      svgContent = doorDetectionResult.modifiedSVG;
      console.log(`✅ 스윙도어 감지 완료: ${doorDetectionResult.summary.totalDetected}개 감지`);
    } catch (doorError) {
      console.warn('스윙도어 감지 실패:', doorError.message);
    }
    
    // 7단계: 방 이름 라벨 추가 (텍스트 복원)
    svgContent = addRoomLabels(svgContent, helper);  // 다시 활성화
    
    // 8단계: 커스텀 요소들 병합
    if (customRenderResult.content) {
      const svgEndIndex = svgContent.lastIndexOf('</svg>');
      if (svgEndIndex !== -1) {
        const customContent = '\n  <!-- 커스텀 렌더링 요소들 -->\n' + customRenderResult.content;
        svgContent = svgContent.slice(0, svgEndIndex) + customContent + svgContent.slice(svgEndIndex);
      }
    }
    
    // 9단계: 스타일과 패턴 추가
    const firstGroupIndex = svgContent.indexOf('<g');
    if (firstGroupIndex !== -1) {
      const integratedStyles = generateIntegratedStyles(viewBox, customRenderResult.styles);
      const patterns = customRenderResult.patterns;
      
      svgContent = svgContent.slice(0, firstGroupIndex) + 
                  patterns + integratedStyles + 
                  svgContent.slice(firstGroupIndex);
    }
    
    console.log(`✅ SVG 병합 완료: ${(svgContent.length / 1024).toFixed(1)} KB`);
    console.log(`커스텀 요소 추가: MTEXT(${customRenderResult.counts.mtextCount}), HATCH(${customRenderResult.counts.hatchCount}), DIM(${customRenderResult.counts.dimensionCount}), INSERT(${customRenderResult.counts.insertCount})`);
    
    return svgContent;
    
  } catch (error) {
    console.error('❌❌❌ SVG 병합 실패 - 강력한 에러 로깅 ❌❌❌');
    console.error('❌ 에러 메시지:', error.message);
    console.error('❌ 에러 스택:', error.stack);
    console.error('❌ 에러 타입:', error.constructor.name);
    console.error('❌ helper 객체 상태:', !!helper);
    console.error('❌ helper.denormalised 상태:', !!helper?.denormalised);
    console.error('❌ customRenderResult 상태:', !!customRenderResult);
    
    // 실패 시 기본 SVG 반환
    console.log('🔄🔄🔄 기본 SVG 반환 중...');
    try {
      const basicSvg = helper.toSVG();
      console.log(`🔄 기본 SVG 크기: ${(basicSvg.length / 1024).toFixed(1)} KB`);
      return basicSvg;
    } catch (basicError) {
      console.error('❌ 기본 SVG 생성도 실패:', basicError.message);
      return '<svg></svg>'; // 최후의 fallback
    }
  }
};

/**
 * SVG 후처리 및 최적화
 */
const postProcessSvg = (svgContent) => {
  try {
    console.log('🔧 SVG 후처리 중...');
    
    // 중복 스타일 제거
    const styleRegex = /<style[^>]*>[\s\S]*?<\/style>/g;
    const styles = svgContent.match(styleRegex) || [];
    
    if (styles.length > 1) {
      // 첫 번째 스타일만 유지하고 나머지 제거
      let processedSvg = svgContent;
      for (let i = 1; i < styles.length; i++) {
        processedSvg = processedSvg.replace(styles[i], '');
      }
      svgContent = processedSvg;
    }
    
    // 빈 그룹 제거
    svgContent = svgContent.replace(/<g[^>]*>\s*<\/g>/g, '');
    
    // 불필요한 공백 정리
    svgContent = svgContent.replace(/\n\s*\n/g, '\n');
    
    console.log('✅ SVG 후처리 완료');
    
    return svgContent;
    
  } catch (error) {
    console.warn('SVG 후처리 실패:', error.message);
    return svgContent;
  }
};

module.exports = {
  extractViewBox,
  changeWallColors,
  optimizeViewBox,
  add90DegreeDoorMarkers,
  addRoomLabels,
  generateIntegratedStyles,
  mergeHelperAndCustomSvg,
  postProcessSvg
}; 