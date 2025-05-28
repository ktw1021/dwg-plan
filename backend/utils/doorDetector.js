/**
 * 스윙도어 감지 및 표시 유틸리티
 * DWG → DXF → SVG 변환 과정에서 스윙도어를 감지하여 빨간색 박스로 표시
 */

class SwingDoorDetector {
  constructor() {
    this.doorCriteria = {
      // 스윙도어의 기본 특징
      minWidth: 600,      // 최소 폭 (mm)
      maxWidth: 1200,     // 최대 폭 (mm)
      minHeight: 1800,    // 최소 높이 (mm)
      maxHeight: 2400,    // 최대 높이 (mm)
      minAspectRatio: 0.3, // 최소 가로세로 비율
      maxAspectRatio: 0.8, // 최대 가로세로 비율
      
      // 스윙도어 특유의 패턴
      requiresArc: true,   // 호(arc) 패턴 필수
      minArcRadius: 500,   // 최소 호 반지름
      maxArcRadius: 1300   // 최대 호 반지름
    };
  }

  /**
   * SVG에서 스윙도어 감지
   */
  detectSwingDoors(svgContent) {
    console.log('🚪 스윙도어 감지 시작...');
    
    const doors = [];
    const entities = this.extractSVGEntities(svgContent);
    
    console.log(`📊 분석할 엔티티: ${entities.length}개`);
    
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      const doorAnalysis = this.analyzeEntityForSwingDoor(entity, i);
      
      if (doorAnalysis.isSwingDoor) {
        doors.push(doorAnalysis);
        console.log(`✅ 스윙도어 발견 #${doors.length}: 신뢰도 ${doorAnalysis.confidence}%`);
      }
    }
    
    console.log(`🎯 총 ${doors.length}개의 스윙도어 감지됨`);
    return doors;
  }

  /**
   * SVG에서 모든 엔티티 추출
   */
  extractSVGEntities(svgContent) {
    const entities = [];
    
    // path 엘리먼트들 추출 (g 태그 내부 포함)
    const pathRegex = /<path[^>]*d="([^"]+)"[^>]*>/g;
    let match;
    
    while ((match = pathRegex.exec(svgContent)) !== null) {
      const fullElement = match[0];
      const pathData = match[1];
      
      // 속성들 추출
      const stroke = this.extractAttribute(fullElement, 'stroke');
      const strokeWidth = this.extractAttribute(fullElement, 'stroke-width');
      const fill = this.extractAttribute(fullElement, 'fill');
      const transform = this.extractAttribute(fullElement, 'transform');
      
      // 부모 g 태그의 transform도 확인
      const gTransform = this.findParentGTransform(svgContent, match.index);
      
      entities.push({
        pathData,
        stroke,
        strokeWidth,
        fill,
        transform,
        gTransform,
        fullElement,
        originalIndex: match.index
      });
    }
    
    return entities;
  }

  /**
   * 속성 값 추출
   */
  extractAttribute(element, attributeName) {
    const regex = new RegExp(`${attributeName}="([^"]+)"`);
    const match = element.match(regex);
    return match ? match[1] : null;
  }

  /**
   * 부모 g 태그의 transform 찾기
   */
  findParentGTransform(svgContent, pathIndex) {
    // pathIndex 이전의 가장 가까운 g 태그 찾기
    const beforePath = svgContent.substring(0, pathIndex);
    const gMatches = [...beforePath.matchAll(/<g[^>]*transform="([^"]+)"[^>]*>/g)];
    
    if (gMatches.length > 0) {
      return gMatches[gMatches.length - 1][1]; // 가장 마지막(가까운) g 태그
    }
    
    return null;
  }

  /**
   * 엔티티가 스윙도어인지 분석
   */
  analyzeEntityForSwingDoor(entity, index) {
    const analysis = {
      index,
      entity,
      isSwingDoor: false,
      confidence: 0,
      boundingBox: null,
      arcInfo: null,
      doorType: 'unknown',
      reasons: []
    };

    // 1. 기하학적 분석
    const geometry = this.analyzeGeometry(entity.pathData);
    analysis.boundingBox = geometry.boundingBox;

    // 2. 호(Arc) 패턴 분석
    const arcAnalysis = this.analyzeArcPattern(entity.pathData);
    analysis.arcInfo = arcAnalysis;

    // 3. 스윙도어 조건 검사
    let score = 0;
    const reasons = [];

    // 조건 1: 호(Arc) 패턴 필수
    if (arcAnalysis.hasArc) {
      score += 40;
      reasons.push('호(Arc) 패턴 발견');
      
      // 호 반지름이 적절한 범위인지 확인
      if (arcAnalysis.radius >= this.doorCriteria.minArcRadius && 
          arcAnalysis.radius <= this.doorCriteria.maxArcRadius) {
        score += 20;
        reasons.push(`적절한 호 반지름: ${arcAnalysis.radius.toFixed(1)}mm`);
      }
    } else {
      // 호가 없으면 스윙도어가 아님
      analysis.reasons = ['호(Arc) 패턴 없음 - 스윙도어 아님'];
      return analysis;
    }

    // 조건 2: 적절한 크기
    if (geometry.boundingBox) {
      const width = Math.abs(geometry.boundingBox.width);
      const height = Math.abs(geometry.boundingBox.height);
      
      if (width >= this.doorCriteria.minWidth && width <= this.doorCriteria.maxWidth) {
        score += 15;
        reasons.push(`적절한 폭: ${width.toFixed(1)}mm`);
      }
      
      if (height >= this.doorCriteria.minHeight && height <= this.doorCriteria.maxHeight) {
        score += 15;
        reasons.push(`적절한 높이: ${height.toFixed(1)}mm`);
      }
      
      // 가로세로 비율
      const aspectRatio = width / height;
      if (aspectRatio >= this.doorCriteria.minAspectRatio && 
          aspectRatio <= this.doorCriteria.maxAspectRatio) {
        score += 10;
        reasons.push(`적절한 비율: ${aspectRatio.toFixed(2)}`);
      }
    }

    analysis.confidence = Math.min(score, 100);
    analysis.reasons = reasons;
    analysis.isSwingDoor = analysis.confidence >= 60; // 60% 이상이면 스윙도어로 판단
    analysis.doorType = analysis.isSwingDoor ? 'swing_door' : 'not_swing_door';

    return analysis;
  }

  /**
   * 기하학적 분석
   */
  analyzeGeometry(pathData) {
    const coordinates = this.extractCoordinates(pathData);
    const boundingBox = this.calculateBoundingBox(coordinates);
    
    return {
      coordinates,
      boundingBox,
      coordinateCount: coordinates.length
    };
  }

  /**
   * 호(Arc) 패턴 분석
   */
  analyzeArcPattern(pathData) {
    const arcCommands = pathData.match(/A[^MLHVCSQTAZ]*/gi) || [];
    
    if (arcCommands.length === 0) {
      return {
        hasArc: false,
        arcCount: 0,
        radius: 0,
        arcCommands: []
      };
    }

    // 첫 번째 호의 반지름 추출 (A rx ry x-axis-rotation large-arc-flag sweep-flag x y)
    const firstArc = arcCommands[0];
    const arcParams = firstArc.substring(1).trim().split(/[\s,]+/);
    
    let radius = 0;
    if (arcParams.length >= 2) {
      const rx = parseFloat(arcParams[0]);
      const ry = parseFloat(arcParams[1]);
      radius = Math.max(rx, ry); // 더 큰 반지름 사용
    }

    return {
      hasArc: true,
      arcCount: arcCommands.length,
      radius,
      arcCommands
    };
  }

  /**
   * 좌표 추출
   */
  extractCoordinates(pathData) {
    const coordinates = [];
    const coordRegex = /([\d.-]+)[,\s]+([\d.-]+)/g;
    let match;
    
    while ((match = coordRegex.exec(pathData)) !== null) {
      coordinates.push({
        x: parseFloat(match[1]),
        y: parseFloat(match[2])
      });
    }
    
    return coordinates;
  }

  /**
   * 바운딩 박스 계산
   */
  calculateBoundingBox(coordinates) {
    if (coordinates.length === 0) return null;
    
    const xs = coordinates.map(c => c.x);
    const ys = coordinates.map(c => c.y);
    
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    
    return {
      minX, maxX, minY, maxY,
      width: maxX - minX,
      height: maxY - minY,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2
    };
  }

  /**
   * 감지된 스윙도어에 빨간색 박스 추가
   */
  addRedBoxesToSVG(svgContent, detectedDoors) {
    console.log(`🎨 ${detectedDoors.length}개 스윙도어에 빨간색 박스 추가 중...`);
    
    if (detectedDoors.length === 0) {
      console.log('감지된 스윙도어가 없어 박스를 추가하지 않습니다.');
      return svgContent;
    }

    // SVG 끝나는 태그 찾기
    const svgEndIndex = svgContent.lastIndexOf('</svg>');
    if (svgEndIndex === -1) {
      console.log('❌ SVG 종료 태그를 찾을 수 없습니다.');
      return svgContent;
    }

    // 빨간색 박스들 생성
    let redBoxes = '\n  <!-- 스윙도어 감지 박스들 -->\n';
    redBoxes += '  <g id="swing-door-detection" stroke="red" stroke-width="3" fill="none" opacity="0.8">\n';
    
    detectedDoors.forEach((door, index) => {
      if (door.boundingBox) {
        const box = door.boundingBox;
        const padding = 50; // 박스 여백
        
        redBoxes += `    <!-- 스윙도어 #${index + 1} (신뢰도: ${door.confidence}%) -->\n`;
        redBoxes += `    <rect x="${box.minX - padding}" y="${box.minY - padding}" ` +
                   `width="${box.width + padding * 2}" height="${box.height + padding * 2}" />\n`;
        
        // 라벨 추가
        redBoxes += `    <text x="${box.centerX}" y="${box.minY - padding - 10}" ` +
                   `fill="red" font-size="24" font-weight="bold" text-anchor="middle">` +
                   `DOOR #${index + 1}</text>\n`;
      }
    });
    
    redBoxes += '  </g>\n';

    // SVG에 박스들 삽입
    const modifiedSVG = svgContent.substring(0, svgEndIndex) + redBoxes + svgContent.substring(svgEndIndex);
    
    console.log('✅ 빨간색 박스 추가 완료');
    return modifiedSVG;
  }

  /**
   * 메인 처리 함수: 스윙도어 감지 및 표시
   */
  processSwingDoorDetection(svgContent) {
    console.log('\n🚪 === 스윙도어 감지 및 표시 시작 ===');
    
    try {
      // 1. 스윙도어 감지
      const detectedDoors = this.detectSwingDoors(svgContent);
      
      // 2. 빨간색 박스 추가
      const modifiedSVG = this.addRedBoxesToSVG(svgContent, detectedDoors);
      
      // 3. 결과 요약
      console.log('\n📋 === 스윙도어 감지 결과 ===');
      console.log(`🎯 감지된 스윙도어: ${detectedDoors.length}개`);
      
      detectedDoors.forEach((door, index) => {
        console.log(`   도어 #${index + 1}: 신뢰도 ${door.confidence}% (${door.reasons.join(', ')})`);
      });
      
      return {
        modifiedSVG,
        detectedDoors,
        summary: {
          totalDetected: detectedDoors.length,
          averageConfidence: detectedDoors.length > 0 ? 
            detectedDoors.reduce((sum, door) => sum + door.confidence, 0) / detectedDoors.length : 0
        }
      };
      
    } catch (error) {
      console.error('❌ 스윙도어 감지 중 오류:', error.message);
      throw error;
    }
  }
}

module.exports = SwingDoorDetector; 