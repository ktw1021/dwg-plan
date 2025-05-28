/**
 * 통합 SVG 렌더링 모듈
 */

// MTEXT 렌더링
const renderMText = (entity, viewBox) => {
  try {
    const text = entity.text || entity.contents || entity.string || '';
    const cleanText = text.replace(/\\pxqc;/g, '').replace(/\\P/g, '\n').trim();
    if (!cleanText) return '';
    
    let x = 0, y = 0;
    if (entity.insertionPoint?.x || entity.insertionPoint?.y) {
      x = entity.insertionPoint.x || 0;
      y = entity.insertionPoint.y || 0;
    } else if (entity.position?.x || entity.position?.y) {
      x = entity.position.x || 0;
      y = entity.position.y || 0;
    } else if (entity.xAxisX !== undefined && entity.xAxisY !== undefined) {
      x = entity.xAxisX;
      y = entity.xAxisY;
    }
    
    const height = entity.height || entity.textHeight || 100;
    const fontSize = Math.max(height * 0.8, Math.min(viewBox.width || 1000, viewBox.height || 1000) * 0.015);
    
    let svgText = '';
    const lines = cleanText.split('\n');
    
    lines.forEach((line, index) => {
      if (line.trim()) {
        const lineY = y + (index * fontSize * 1.2);
        svgText += `  <text x="${x}" y="${lineY}" font-size="${fontSize}">${line.trim()}</text>\n`;
      }
    });
    
    return svgText;
  } catch (error) {
    return '';
  }
};

// MTEXT 좌표 계산 함수
const getMTextXY = (entity) => {
  // 1) attachmentPoint (그룹 코드 71)
  //    1=Top-Left, 2=Top-Center, 3=Top-Right,
  //    4=Middle-Left, 5=Middle-Center, 6=Middle-Right,
  //    7=Bottom-Left, 8=Bottom-Center, 9=Bottom-Right
  const ap = entity.groupCodes?.[72] ?? 1;

  // 2) 삽입점 선택
  //    ap===1 (Top-Left) 만 첫 번째 삽입점(그룹 10/20)을,
  //    나머지(ap≠1) 는 두 번째 삽입점(그룹 11/21)을 씁니다.
  let x0, y0;
  if (ap === 1) {
    x0 = entity.groupCodes?.[10];
    y0 = entity.groupCodes?.[20];
  } else {
    x0 = entity.groupCodes?.[11];
    y0 = entity.groupCodes?.[21];
  }

  // 3) 삽입점이 없으면 xAxisX/Y (fallback)
  if (x0 == null || y0 == null) {
    x0 = entity.xAxisX;
    y0 = entity.xAxisY;
  }

  // 4) 박스 크기 (group 42/43 또는 parser 프로퍼티)
  const w = entity.horizontalWidth || 0;
  const h = Math.abs(entity.verticalHeight || entity.nominalTextHeight || 0);

  // 5) attachmentPoint 에 따른 오프셋
  //    col = ((ap-1)%3)+1, row = floor((ap-1)/3)
  const col = ((ap - 1) % 3) + 1;    // 1=좌, 2=가운데, 3=우
  const row = Math.floor((ap - 1) / 3); // 0=위, 1=가운데, 2=아래

  let x = x0, y = y0;
  // 수평: Center(ap=2,5,8)는 박스 중앙이 삽입점에 오도록
  if (col === 1)      x += w/2;   // Left-anchored → box 가 왼쪽으로 오도록 우측으로 절반 이동
  else if (col === 2) {
    x -= w/2;         // Center-anchored → 삽입점이 박스 중앙에 오도록 좌측으로 절반 이동
    x += w * 0.05;    // 미세 조정: 박스 너비의 5% 만큼 우측으로 추가 이동
  }
  else if (col === 3) x -= w/2;   // Right-anchored → box 오른쪽 모서리가 삽입점에 오도록
  // 수직
  if (row === 0)      y -= h/2;   // Top-anchored → 위쪽 끝 기준이니까 절반 만큼 아래로
  else if (row === 2) y += h/2;   // Bottom-anchored → 아래 끝 기준, 절반 만큼 위로

  // 6) SVG 좌표계로 Y 축 뒤집기
  y = -y;

  return { x, y, w, h, ap, col, row };
};

// 방 라벨 추가
const addRoomLabels = (svgContent, texts) => {
  try {
    const roomCandidates = texts.foundTexts.filter(t => t.text && t.text.trim());
    if (roomCandidates.length === 0) return svgContent;
    
    const svgEndIndex = svgContent.lastIndexOf('</svg>');
    if (svgEndIndex === -1) return svgContent;
    
    let roomLabelsHtml = '\n  <!-- 방 라벨 -->\n';
    
    roomCandidates.forEach((roomText) => {
      const entity = roomText._entityRef;
      
      // 엔티티 전체 속성 로깅 (중복 제거)
      const entityKey = `${entity.handle}_${entity.type}`;
      if (!global.loggedEntities) global.loggedEntities = new Set();
      
      if (!global.loggedEntities.has(entityKey)) {
        console.log(`\n=== 텍스트 엔티티 상세 정보 ===`);
        console.log('텍스트:', roomText.text);
        console.log('엔티티 타입:', entity.type);
        console.log('\n전체 속성:');
        Object.keys(entity).forEach(key => {
          console.log(`${key}:`, entity[key]);
        });
        console.log('================================\n');
        
        global.loggedEntities.add(entityKey);
      }

      // MTEXT 좌표 및 속성 계산
      const { x, y, w, h, ap, col, row } = getMTextXY(entity);

      // 디버깅용 로그
      console.log(`\n=== MTEXT 위치 계산 ===`);
      console.log('텍스트:', roomText.text);
      console.log('정렬 모드:', {
        horizontal: entity.groupCodes?.[72] ?? 0,
        vertical: entity.groupCodes?.[73] ?? 0
      });
      console.log('삽입점 후보:', {
        'primary': { x: entity.groupCodes?.[10], y: entity.groupCodes?.[20] },
        'secondary': { x: entity.groupCodes?.[11], y: entity.groupCodes?.[21] },
        'xAxis': { x: entity.xAxisX, y: entity.xAxisY }
      });
      console.log('선택된 좌표:', { x, y });
      console.log('박스 크기:', { w, h });
      console.log('Attachment:', { point: ap, col, row });
      console.log('========================\n');
      
      // 초기 폰트 크기를 크게 설정 (자동 조절됨)
      const fontSize = 100;
      
      // 줄 간격 설정
      const lineHeight = fontSize * 1.4;
      
      // \P를 줄바꿈으로 처리
      const rawText = roomText.text.replace(/\\pxqc;/g, '').trim();
      const textLines = rawText.split('\\P');
      
      // 각 줄을 별도의 text 요소로 처리
      textLines.forEach((line, index) => {
        if (line.trim()) {
          roomLabelsHtml += `  <text x="${x}" y="${y + (index * lineHeight)}" ` +
                           `font-family="${entity.styleName || 'Text Ghi chú (ANNO)'}" ` +
                           `font-size="${fontSize}" ` +
                           `text-anchor="${col === 3 ? "end" : "start"}" ` +
                           `dominant-baseline="middle" ` +
                           `textLength="${w}" ` +
                           `lengthAdjust="spacingAndGlyphs" ` +
                           `fill="#000000">` +
                           `${line.trim()}` +
                           `</text>\n`;
        }
      });
    });
    
    return svgContent.slice(0, svgEndIndex) + roomLabelsHtml + svgContent.slice(svgEndIndex);
  } catch (error) {
    return svgContent;
  }
};

// 벽 색상 변경
const changeWallColors = (svgContent) => {
  try {
    return svgContent
      .replace(/stroke="yellow"/g, 'stroke="#006400"')
      .replace(/stroke="#FFFF00"/g, 'stroke="#006400"')
      .replace(/stroke="rgb\(255,255,0\)"/g, 'stroke="#006400"')
      .replace(/stroke="rgb\(65,\s*65,\s*65\)"/g, 'stroke="#006400"')
      .replace(/stroke="rgb\(128,\s*128,\s*128\)"/g, 'stroke="#006400"')
      .replace(/stroke="#808080"/g, 'stroke="#006400"');
  } catch (error) {
    return svgContent;
  }
};

// 문 마커 추가
const addDoorMarkers = (svgContent, doors) => {
  try {
    if (!doors.doorMarkersHtml) return svgContent;
    
    const svgEndIndex = svgContent.lastIndexOf('</svg>');
    if (svgEndIndex === -1) return svgContent;
    
    return svgContent.slice(0, svgEndIndex) + doors.doorMarkersHtml + svgContent.slice(svgEndIndex);
  } catch (error) {
    return svgContent;
  }
};

// 메인 SVG 렌더링
const renderSvg = (helper, analysis, doors) => {
  try {
    // 1. 기본 SVG 생성
    let svgContent = helper.toSVG();
    
    // 2. 벽 색상 변경
    svgContent = changeWallColors(svgContent);
    
    // 3. 문 마커 추가
    svgContent = addDoorMarkers(svgContent, doors);
    
    // 4. 방 라벨 추가
    svgContent = addRoomLabels(svgContent, analysis.texts);
    
    // 5. MTEXT 커스텀 렌더링
    const viewBox = { 
      width: analysis.structure.bbox.max.x - analysis.structure.bbox.min.x,
      height: analysis.structure.bbox.max.y - analysis.structure.bbox.min.y 
    };
    
    let customContent = '';
    helper.denormalised?.forEach(entity => {
      if (entity.type === 'MTEXT') {
        customContent += renderMText(entity, viewBox);
      }
    });
    
    if (customContent) {
      const svgEndIndex = svgContent.lastIndexOf('</svg>');
      if (svgEndIndex !== -1) {
        svgContent = svgContent.slice(0, svgEndIndex) + 
                    '\n  <!-- 커스텀 MTEXT -->\n' + customContent + 
                    svgContent.slice(svgEndIndex);
      }
    }
    
    return svgContent;
    
  } catch (error) {
    console.error('SVG 렌더링 실패:', error.message);
    return helper.toSVG(); // fallback
  }
};

module.exports = {
  renderSvg,
  renderMText,
  addRoomLabels,
  changeWallColors,
  addDoorMarkers
}; 