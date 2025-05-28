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

// 방 라벨 추가
const addRoomLabels = (svgContent, texts) => {
  try {
    const roomCandidates = texts.foundTexts.filter(t => t.text && t.text.trim());
    if (roomCandidates.length === 0) return svgContent;
    
    const svgEndIndex = svgContent.lastIndexOf('</svg>');
    if (svgEndIndex === -1) return svgContent;
    
    let roomLabelsHtml = '\n  <!-- 방 라벨 -->\n';
    
    roomCandidates.forEach((roomText, index) => {
      const pos = roomText.position;
      const x = pos.x || 0;
      const y = -pos.y || 0; // Y축 반전
      const cleanText = roomText.text.replace(/\\pxqc;/g, '').replace(/\\P/g, ' ').trim();
      const fontSize = 120;
      
      roomLabelsHtml += `  <text x="${x}" y="${y}" font-size="${fontSize}" ` +
                       `text-anchor="middle" dominant-baseline="middle" ` +
                       `fill="#000000">${cleanText}</text>\n`;
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