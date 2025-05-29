/**
 * 간소화된 문 감지 모듈
 */

// 각도 정규화
const normalizeAngle = (angleRad) => {
  let degrees = (angleRad * 180) / Math.PI;
  while (degrees < 0) degrees += 360;
  while (degrees >= 360) degrees -= 360;
  return degrees;
};

/**
 * x,y 점에 transforms 배열을 순서대로 적용
 *  - scaleX, scaleY
 *  - rotation (degrees)
 *  - translate (x,y)
 */
function applyTransforms(x, y, transforms) {
  let nx = x, ny = y;
  transforms.forEach(t => {
    // 1) 스케일
    const sx = t.scaleX !== undefined ? t.scaleX : 1;
    const sy = t.scaleY !== undefined ? t.scaleY : sx;
    nx *= sx;
    ny *= sy;

    // 2) 회전
    if (t.rotation) {
      const rad = t.rotation * Math.PI / 180;
      const rx = nx * Math.cos(rad) - ny * Math.sin(rad);
      const ry = nx * Math.sin(rad) + ny * Math.cos(rad);
      nx = rx; 
      ny = ry;
    }

    // 3) 이동
    if (t.x !== undefined) nx += t.x;
    if (t.y !== undefined) ny += t.y;
  });
  return { x: nx, y: ny };
}

/**
 * midAngle에 transforms 배열을 적용
 */
function applyAngleTransforms(mid, transforms) {
  let θ = mid;
  transforms.forEach(t => {
    // 1) scaleX:-1 → 좌우 반전
    if (t.scaleX === -1) {
      θ = Math.PI - θ;
    }
    // 2) rotation → θ += rad
    if (t.rotation) {
      θ += t.rotation * Math.PI / 180;
    }
  });
  // 0~2π 정규화
  θ = (θ % (2*Math.PI) + 2*Math.PI) % (2*Math.PI);
  return θ;
}

// 호의 중간 각도 계산 (간단하고 정확한 버전)
const getMidAngle = (startAngle, endAngle) => {
  // 간단한 평균 계산
  let midAngle = (startAngle + endAngle) / 2;
  
  // 만약 각도 차이가 π보다 크면 (180도 이상), 반대 방향으로 계산
  let angleDiff = Math.abs(endAngle - startAngle);
  if (angleDiff > Math.PI) {
    midAngle = midAngle + Math.PI;
  }
  
  // 0~2π 범위로 정규화
  while (midAngle < 0) midAngle += 2 * Math.PI;
  while (midAngle >= 2 * Math.PI) midAngle -= 2 * Math.PI;
  
  return midAngle;
};

// 문 감지
const detectDoors = (helper) => {
  const doors = [];
  
  if (!helper.denormalised?.length) return doors;
  
  helper.denormalised.forEach((entity, index) => {
    // ARC 기반 문 감지
    if (entity.type === 'ARC') {
      let centerX = entity.x || 0;
      let centerY = entity.y || 0;
      const radius = entity.r || 0;
      let startAngle = entity.startAngle || 0;
      let endAngle = entity.endAngle || 0;
      
      // 각도 차이 계산
      let angleDiff = Math.abs(endAngle - startAngle);
      if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
      angleDiff = angleDiff * (180 / Math.PI);
      
      // 문 조건 확인
      const isValidSize = radius >= 300 && radius <= 1300;
      const isValidAngle = angleDiff >= 75 && angleDiff <= 105;
      
      if (isValidSize && isValidAngle) {
        // 1) midAngle 계산 (오직 start/end)
        const rawMid = getMidAngle(startAngle, endAngle);

        // 2) transforms로 mid 보정
        const midAngle = entity.transforms?.length
          ? applyAngleTransforms(rawMid, entity.transforms)
          : rawMid;

        // 3) center 점도 transforms 적용
        let { x: cx, y: cy } = entity;
        if (entity.transforms?.length) {
          ({ x: cx, y: cy } = applyTransforms(cx, cy, entity.transforms));
        }

        doors.push({
          type: 'ARC_DOOR',
          center: { x: cx, y: cy },
          radius,
          angle: angleDiff,
          midAngle,
          layer: entity.layer || '기본',
          confidence: 0.9,
          transforms: entity.transforms
        });
      }
    }
    
    // INSERT 블록 기반 문 감지
    else if (entity.type === 'INSERT' && entity.name) {
      const blockName = entity.name.toLowerCase();
      const doorKeywords = ['door', '문', 'gate', 'entrance'];
      const isDoorBlock = doorKeywords.some(keyword => blockName.includes(keyword));
      
      if (isDoorBlock && entity.position) {
        doors.push({
          type: 'INSERT_DOOR',
          center: entity.position,
          blockName: entity.name,
          layer: entity.layer || '기본',
          confidence: 0.8
        });
      }
    }
  });
  
  // 중복 제거
  const uniqueDoors = [];
  const tolerance = 100;
  
  doors.forEach(door => {
    const isDuplicate = uniqueDoors.some(existing => {
      const dx = Math.abs(existing.center.x - door.center.x);
      const dy = Math.abs(existing.center.y - door.center.y);
      return dx < tolerance && dy < tolerance;
    });
    
    if (!isDuplicate) {
      uniqueDoors.push(door);
    }
  });
  
  // SVG 마커 생성
  if (uniqueDoors.length > 0) {
    let markersHtml = '\n  <!-- 문 마커 -->\n';
    
    uniqueDoors.forEach((door, index) => {
      // ARC 문의 경우 위치 조정
      if (door.type === 'ARC_DOOR' && door.radius) {
        // 4) 부채꼴 중심 world 좌표
        const offsetDist = door.radius * 0.8;
        const worldX = door.center.x + Math.cos(door.midAngle) * offsetDist;
        const worldY = door.center.y + Math.sin(door.midAngle) * offsetDist;

        // 5) SVG 좌표계로 변환
        const svgX = worldX;
        const svgY = -worldY; // SVG Y축 반전

        // 마커 크기 결정
        const markerSize = door.radius * 1.2;
        
        // 빨간 박스 그리기
        markersHtml += `  <rect x="${(svgX-markerSize/2).toFixed(1)}" y="${(svgY-markerSize/2).toFixed(1)}" ` +
                      `width="${markerSize.toFixed(1)}" height="${markerSize.toFixed(1)}" ` +
                      `stroke="#ff0000" stroke-width="12" fill="rgba(255,0,0,0.15)" ` +
                      `opacity="0.95" class="door-marker" />\n`;
        
        // 텍스트 추가
        markersHtml += `  <text x="${svgX.toFixed(1)}" y="${(svgY + 8).toFixed(1)}" ` +
                      `text-anchor="middle" dominant-baseline="middle" ` +
                      `font-family="Arial, sans-serif" font-size="18" font-weight="bold" ` +
                      `fill="#ff0000" stroke="#ffffff" stroke-width="2" ` +
                      `class="door-label">문${index + 1}</text>\n`;
      }
    });
    
    return {
      doors: uniqueDoors,
      doorMarkersHtml: markersHtml,
      length: uniqueDoors.length
    };
  }
  
  return {
    doors: uniqueDoors,
    doorMarkersHtml: '',
    length: uniqueDoors.length
  };
};

module.exports = {
  detectDoors,
  normalizeAngle,
  getMidAngle,
  applyTransforms,
  applyAngleTransforms
}; 