/**
 * 커스텀 렌더링 모듈
 * DXF 라이브러리가 완전히 지원하지 않는 MTEXT, HATCH, DIMENSION 등을 커스텀 렌더링
 */

/**
 * MTEXT 엔티티를 SVG 텍스트로 변환
 */
const renderMText = (entity, viewBox) => {
  try {
    if (!entity.text && !entity.contents && !entity.string) {
      return '';
    }
    
    const text = entity.text || entity.contents || entity.string || '';
    const cleanText = text
      .replace(/\\pxqc;/g, '') // AutoCAD 특수 코드 제거
      .replace(/\\P/g, '\n')   // 줄바꿈 코드 변환
      .replace(/\\[^\\]*;/g, '') // 기타 특수 코드 제거
      .trim();
    
    if (!cleanText) return '';
    
    console.log(`🎨 MTEXT 렌더링: "${cleanText}"`);
    
    // MTEXT 좌표 추출 - 더 포괄적으로 시도
    let x = 0, y = 0;
    let coordinateSource = 'default';
    
    // 1. insertionPoint 확인 (MTEXT의 주요 위치 속성)
    if (entity.insertionPoint && (entity.insertionPoint.x !== 0 || entity.insertionPoint.y !== 0)) {
      x = entity.insertionPoint.x;
      y = entity.insertionPoint.y;
      coordinateSource = 'insertionPoint';
    }
    // 2. position 확인
    else if (entity.position && (entity.position.x !== 0 || entity.position.y !== 0)) {
      x = entity.position.x;
      y = entity.position.y;
      coordinateSource = 'position';
    }
    // 3. startPoint 확인
    else if (entity.startPoint && (entity.startPoint.x !== 0 || entity.startPoint.y !== 0)) {
      x = entity.startPoint.x;
      y = entity.startPoint.y;
      coordinateSource = 'startPoint';
    }
    // 4. 직접 x, y 속성 확인
    else if ((entity.x !== undefined && entity.x !== 0) || (entity.y !== undefined && entity.y !== 0)) {
      x = entity.x || 0;
      y = entity.y || 0;
      coordinateSource = 'direct x,y';
    }
    // 5. xAxisX, xAxisY 사용 (AutoCAD 변환 행렬)
    else if (entity.xAxisX !== undefined && entity.xAxisY !== undefined) {
      x = entity.xAxisX;
      y = entity.xAxisY;
      coordinateSource = 'xAxis';
    }
    
    console.log(`   좌표: x=${x}, y=${y} (출처: ${coordinateSource})`);
    
    const height = entity.height || entity.textHeight || entity.nominalTextHeight || 100;
    const rotation = entity.rotation || 0;
    
    // viewBox 크기에 따른 폰트 크기 조정
    const viewBoxWidth = viewBox.width || 1000;
    const viewBoxHeight = viewBox.height || 1000;
    const fontSize = Math.max(height * 0.8, Math.min(viewBoxWidth, viewBoxHeight) * 0.015);
    
    console.log(`   폰트 크기: ${fontSize} (원본 높이: ${height})`);
    
    let svgText = '';
    const lines = cleanText.split('\n');
    
    lines.forEach((line, index) => {
      if (line.trim()) {
        const lineY = y + (index * fontSize * 1.2);
        svgText += `  <text class="mtext-custom" x="${x}" y="${lineY}" ` +
                  `font-size="${fontSize}" ` +
                  `transform="rotate(${rotation * 180 / Math.PI} ${x} ${y})">${line.trim()}</text>\n`;
      }
    });
    
    console.log(`   생성된 SVG 텍스트 라인 수: ${lines.filter(l => l.trim()).length}`);
    
    return svgText;
    
  } catch (error) {
    console.warn('MTEXT 렌더링 실패:', error.message);
    return '';
  }
};

/**
 * HATCH 엔티티를 SVG 패턴으로 변환
 */
const renderHatch = (entity, viewBox) => {
  try {
    if (!entity.boundaryPaths || entity.boundaryPaths.length === 0) {
      return '';
    }
    
    let svgHatch = '';
    const patternId = `hatch-${Math.random().toString(36).substr(2, 9)}`;
    
    // 경계 경로를 SVG path로 변환
    entity.boundaryPaths.forEach((boundary, index) => {
      if (boundary.edges && boundary.edges.length > 0) {
        let pathData = '';
        
        boundary.edges.forEach((edge, edgeIndex) => {
          if (edge.type === 'line') {
            if (edgeIndex === 0) {
              pathData += `M ${edge.start.x} ${edge.start.y} `;
            }
            pathData += `L ${edge.end.x} ${edge.end.y} `;
          } else if (edge.type === 'arc') {
            const radius = edge.radius || 0;
            const largeArcFlag = Math.abs(edge.endAngle - edge.startAngle) > Math.PI ? 1 : 0;
            pathData += `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${edge.end.x} ${edge.end.y} `;
          }
        });
        
        pathData += 'Z'; // 경로 닫기
        
        // 해치 패턴에 따른 스타일 결정
        let fillStyle = 'rgba(200, 200, 200, 0.3)'; // 기본 회색
        let strokeStyle = 'rgba(150, 150, 150, 0.8)';
        
        if (entity.patternName) {
          const pattern = entity.patternName.toLowerCase();
          if (pattern.includes('solid')) {
            fillStyle = 'rgba(180, 180, 180, 0.5)';
          } else if (pattern.includes('ansi31')) {
            fillStyle = 'url(#ansi31-pattern)';
          } else if (pattern.includes('ansi32')) {
            fillStyle = 'url(#ansi32-pattern)';
          }
        }
        
        svgHatch += `  <path class="hatch-custom" d="${pathData}" ` +
                   `fill="${fillStyle}" stroke="${strokeStyle}" stroke-width="1" opacity="0.7"/>\n`;
      }
    });
    
    return svgHatch;
    
  } catch (error) {
    console.warn('HATCH 렌더링 실패:', error.message);
    return '';
  }
};

/**
 * DIMENSION 엔티티를 SVG로 변환
 */
const renderDimension = (entity, viewBox) => {
  try {
    if (!entity.definitionPoint || !entity.middleOfText) {
      return '';
    }
    
    const defPoint = entity.definitionPoint;
    const textPoint = entity.middleOfText;
    const text = entity.text || entity.actualMeasurement?.toFixed(0) || '';
    
    if (!text) return '';
    
    // viewBox 크기에 따른 폰트 크기 조정
    const viewBoxWidth = viewBox.width || 1000;
    const fontSize = Math.min(viewBoxWidth, viewBox.height || 1000) * 0.015;
    
    let svgDimension = '';
    
    // 치수선 그리기
    if (entity.dimensionLinePoint) {
      svgDimension += `  <line class="dimension-line" ` +
                     `x1="${defPoint.x}" y1="${defPoint.y}" ` +
                     `x2="${entity.dimensionLinePoint.x}" y2="${entity.dimensionLinePoint.y}" ` +
                     `stroke="#0000FF" stroke-width="1"/>\n`;
    }
    
    // 치수 텍스트
    svgDimension += `  <text class="dimension-text" ` +
                   `x="${textPoint.x}" y="${textPoint.y}" ` +
                   `font-size="${fontSize}" text-anchor="middle" ` +
                   `fill="#0000FF">${text}</text>\n`;
    
    return svgDimension;
    
  } catch (error) {
    console.warn('DIMENSION 렌더링 실패:', error.message);
    return '';
  }
};

/**
 * INSERT 엔티티 (블록 참조)를 SVG로 변환
 */
const renderInsert = (entity, blocks, viewBox) => {
  try {
    if (!entity.name || !blocks[entity.name]) {
      return '';
    }
    
    const block = blocks[entity.name];
    const insertPoint = entity.position || { x: 0, y: 0 };
    const scale = entity.scale || { x: 1, y: 1, z: 1 };
    const rotation = entity.rotation || 0;
    
    let svgInsert = '';
    
    // 블록 내 엔티티들을 변환하여 삽입
    if (block.entities) {
      svgInsert += `  <g class="insert-block" transform="translate(${insertPoint.x}, ${insertPoint.y}) ` +
                  `scale(${scale.x}, ${scale.y}) rotate(${rotation * 180 / Math.PI})">\n`;
      
      block.entities.forEach(blockEntity => {
        if (blockEntity.type === 'LINE') {
          svgInsert += `    <line x1="${blockEntity.start.x}" y1="${blockEntity.start.y}" ` +
                      `x2="${blockEntity.end.x}" y2="${blockEntity.end.y}" ` +
                      `stroke="#000000" stroke-width="1"/>\n`;
        } else if (blockEntity.type === 'CIRCLE') {
          svgInsert += `    <circle cx="${blockEntity.center.x}" cy="${blockEntity.center.y}" ` +
                      `r="${blockEntity.radius}" fill="none" stroke="#000000" stroke-width="1"/>\n`;
        }
        // 필요에 따라 다른 엔티티 타입들도 추가
      });
      
      svgInsert += `  </g>\n`;
    }
    
    return svgInsert;
    
  } catch (error) {
    console.warn('INSERT 렌더링 실패:', error.message);
    return '';
  }
};

/**
 * 커스텀 스타일 정의 생성
 */
const generateCustomStyles = (viewBox) => {
  const fontSize = Math.min(viewBox.width || 1000, viewBox.height || 1000) * 0.02;
  
  return `  <style>
    .mtext-custom { 
      font-family: Arial, sans-serif;
      font-size: ${fontSize}px;
      fill: #000000;
      dominant-baseline: hanging;
    }
    .hatch-custom {
      opacity: 0.7;
    }
    .dimension-line {
      stroke: #0000FF;
      stroke-width: 1;
    }
    .dimension-text {
      font-family: Arial, sans-serif;
      fill: #0000FF;
      font-weight: bold;
    }
    .insert-block {
      opacity: 1.0;
    }
  </style>\n`;
};

/**
 * 해치 패턴 정의 생성
 */
const generateHatchPatterns = () => {
  return `  <defs>
    <pattern id="ansi31-pattern" patternUnits="userSpaceOnUse" width="10" height="10">
      <path d="M0,10 L10,0" stroke="#888888" stroke-width="0.5"/>
    </pattern>
    <pattern id="ansi32-pattern" patternUnits="userSpaceOnUse" width="10" height="10">
      <path d="M0,0 L10,10 M0,10 L10,0" stroke="#888888" stroke-width="0.5"/>
    </pattern>
  </defs>\n`;
};

/**
 * 모든 커스텀 엔티티를 렌더링
 */
const renderCustomEntities = (helper, viewBox) => {
  console.log('\n🎨 === 커스텀 엔티티 렌더링 ===');
  
  let customSvgContent = '';
  let mtextCount = 0;
  let hatchCount = 0;
  let dimensionCount = 0;
  let insertCount = 0;
  
  try {
    if (helper.denormalised) {
      helper.denormalised.forEach(entity => {
        switch (entity.type) {
          case 'MTEXT':
            const mtextSvg = renderMText(entity, viewBox);
            if (mtextSvg) {
              customSvgContent += mtextSvg;
              mtextCount++;
            }
            break;
            
          case 'HATCH':
            const hatchSvg = renderHatch(entity, viewBox);
            if (hatchSvg) {
              customSvgContent += hatchSvg;
              hatchCount++;
            }
            break;
            
          case 'DIMENSION':
            const dimensionSvg = renderDimension(entity, viewBox);
            if (dimensionSvg) {
              customSvgContent += dimensionSvg;
              dimensionCount++;
            }
            break;
            
          case 'INSERT':
            const insertSvg = renderInsert(entity, helper.parsed?.blocks || {}, viewBox);
            if (insertSvg) {
              customSvgContent += insertSvg;
              insertCount++;
            }
            break;
        }
      });
    }
    
    console.log(`✅ 커스텀 렌더링 완료:`);
    console.log(`   MTEXT: ${mtextCount}개`);
    console.log(`   HATCH: ${hatchCount}개`);
    console.log(`   DIMENSION: ${dimensionCount}개`);
    console.log(`   INSERT: ${insertCount}개`);
    
  } catch (error) {
    console.warn('커스텀 엔티티 렌더링 실패:', error.message);
  }
  
  return {
    content: customSvgContent,
    styles: generateCustomStyles(viewBox),
    patterns: generateHatchPatterns(),
    counts: { mtextCount, hatchCount, dimensionCount, insertCount }
  };
};

module.exports = {
  renderMText,
  renderHatch,
  renderDimension,
  renderInsert,
  generateCustomStyles,
  generateHatchPatterns,
  renderCustomEntities
}; 