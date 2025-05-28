/**
 * DXF 파일 분석 및 로깅 모듈
 */

/**
 * DXF Helper 객체 초기 분석 (날것 데이터 포함)
 */
const analyzeDxfStructure = (helper) => {
  console.log('\n📊 === DXF 구조 분석 (날것 데이터) ===');
  
  const parsed = helper.parsed;
  const denormalised = helper.denormalised;
  
  console.log(`파싱된 엔티티: ${parsed?.entities?.length || 0}개`);
  console.log(`정규화된 엔티티: ${denormalised?.length || 0}개`);
  
  // 원본 파싱 데이터 샘플 출력
  if (parsed?.entities && parsed.entities.length > 0) {
    console.log('\n🔍 원본 파싱 데이터 샘플 (첫 5개):');
    parsed.entities.slice(0, 5).forEach((entity, index) => {
      console.log(`[${index}] 원본:`, JSON.stringify(entity, null, 2));
    });
  }
  
  // 정규화된 데이터 샘플 출력
  if (denormalised && denormalised.length > 0) {
    console.log('\n🔍 정규화된 데이터 샘플 (첫 5개):');
    denormalised.slice(0, 5).forEach((entity, index) => {
      console.log(`[${index}] 정규화:`, JSON.stringify(entity, null, 2));
    });
  }
  
  // 레이어별 분석
  const layerGroups = helper.groups;
  console.log(`레이어 개수: ${Object.keys(layerGroups).length}개`);
  
  Object.entries(layerGroups).forEach(([layer, entities]) => {
    console.log(`  📁 레이어 "${layer}": ${entities.length}개 엔티티`);
  });
  
  // Polylines 경계 박스 계산
  const polylinesData = helper.toPolylines();
  const bbox = polylinesData.bbox;
  console.log(`\n📐 경계 박스: X(${bbox.min.x.toFixed(1)} ~ ${bbox.max.x.toFixed(1)}), Y(${bbox.min.y.toFixed(1)} ~ ${bbox.max.y.toFixed(1)})`);
  console.log(`도면 크기: ${(bbox.max.x - bbox.min.x).toFixed(1)} x ${(bbox.max.y - bbox.min.y).toFixed(1)}`);
  
  return {
    layerGroups,
    polylinesData,
    bbox,
    entityCount: denormalised?.length || 0
  };
};

/**
 * ARC 엔티티 분석 (문 호 패턴 찾기)
 */
const analyzeArcEntities = (helper) => {
  console.log('\n🔍 === ARC 엔티티 분석 ===');
  
  let arcCount = 0;
  const arcTypes = {};
  const angleGroups = { '90도근처': 0, '기타': 0 };
  let firstArcLogged = false;
  
  try {
    if (helper.denormalised) {
      helper.denormalised.forEach((entity, index) => {
        if (entity.type === 'ARC') {
          arcCount++;
          
          // 첫 번째 ARC 엔티티만 상세 로깅 (디버깅용)
          if (!firstArcLogged) {
            console.log(`🔍 첫 번째 ARC 엔티티[${index}] 전체 구조:`);
            console.log(JSON.stringify(entity, null, 2));
            firstArcLogged = true;
          }
          
          const radius = entity.radius || 0;
          const startAngle = entity.startAngle || 0;
          const endAngle = entity.endAngle || 0;
          const angleDiff = Math.abs(endAngle - startAngle);
          const layer = entity.layer || '기본';
          
          // 90도 근처인지 분류
          if (angleDiff >= 80 && angleDiff <= 100) {
            angleGroups['90도근처']++;
            console.log(`📐 90도 후보 ARC: 레이어=${layer}, 반지름=${radius.toFixed(0)}mm, 각도=${angleDiff.toFixed(1)}°`);
          } else {
            angleGroups['기타']++;
          }
          
          // 레이어별 통계
          if (!arcTypes[layer]) {
            arcTypes[layer] = [];
          }
          arcTypes[layer].push({
            radius: radius.toFixed(0),
            angle: angleDiff.toFixed(0)
          });
        }
      });
    }
    
    console.log(`\n총 ARC 엔티티 개수: ${arcCount}`);
    console.log(`90도 근처 ARC: ${angleGroups['90도근처']}개`);
    console.log(`기타 각도 ARC: ${angleGroups['기타']}개`);
    console.log('\n레이어별 ARC 분포:');
    Object.entries(arcTypes).forEach(([layer, arcs]) => {
      console.log(`  ${layer}: ${arcs.length}개`);
    });
    
  } catch (error) {
    console.warn('ARC 분석 실패:', error.message);
  }
  
  return { arcCount, arcTypes, angleGroups };
};

/**
 * 텍스트 엔티티 분석 및 모든 텍스트 감지 (날것 데이터)
 */
const analyzeTextEntities = (helper) => {
  console.log('\n📝 === 텍스트 엔티티 분석 (모든 텍스트) ===');
  
  const foundTexts = [];
  
  // 전체 엔티티 타입 분석
  const entityTypes = {};
  let totalEntities = 0;
  
  try {
    if (helper.denormalised) {
      console.log(`전체 정규화된 엔티티 개수: ${helper.denormalised.length}`);
      
      helper.denormalised.forEach((entity, index) => {
        totalEntities++;
        const entityType = entity.type || 'UNKNOWN';
        
        // 엔티티 타입별 카운트
        if (!entityTypes[entityType]) {
          entityTypes[entityType] = 0;
        }
        entityTypes[entityType]++;
        
        // 텍스트 관련 엔티티들 체크
        if (entityType === 'TEXT' || entityType === 'MTEXT' || entityType === 'ATTDEF' || entityType === 'ATTRIB') {
          console.log(`\n🔍 텍스트 엔티티 발견 [${index}]:`);
          console.log(`   타입: ${entityType}`);
          console.log(`   전체 속성:`, JSON.stringify(entity, null, 2));
          
          // 가능한 모든 텍스트 속성 확인
          const textFields = ['text', 'value', 'textValue', 'contents', 'string', 'textString'];
          let foundText = null;
          
          textFields.forEach(field => {
            if (entity[field] && typeof entity[field] === 'string' && entity[field].trim()) {
              foundText = entity[field].trim();
              console.log(`   텍스트 (${field}): "${foundText}"`);
            }
          });
          
          if (foundText) {
            // 좌표 정보 추출 - 모든 가능한 속성 확인
            let actualPosition = { x: 0, y: 0 };
            let coordinateSource = 'none';
            
            // 모든 좌표 관련 속성을 확인
            const coordProps = [
              'insertionPoint', 'position', 'startPoint', 'endPoint', 'center',
              'x', 'y', 'xAxisX', 'xAxisY', 'transforms'
            ];
            
            console.log(`   좌표 관련 속성들:`);
            coordProps.forEach(prop => {
              if (entity[prop] !== undefined) {
                console.log(`     ${prop}:`, JSON.stringify(entity[prop]));
              }
            });
            
            // 1. xAxisX, xAxisY 우선 확인 (AutoCAD MTEXT의 실제 위치)
            if (entity.xAxisX !== undefined && entity.xAxisY !== undefined) {
              actualPosition.x = entity.xAxisX;
              actualPosition.y = entity.xAxisY;
              coordinateSource = 'xAxisX,xAxisY';
            }
            // 2. insertionPoint 확인 (MTEXT의 주요 위치 속성)
            else if (entity.insertionPoint && (entity.insertionPoint.x !== 0 || entity.insertionPoint.y !== 0)) {
              actualPosition.x = entity.insertionPoint.x || 0;
              actualPosition.y = entity.insertionPoint.y || 0;
              coordinateSource = 'insertionPoint';
            }
            // 3. position 확인
            else if (entity.position && (entity.position.x !== 0 || entity.position.y !== 0)) {
              actualPosition.x = entity.position.x || 0;
              actualPosition.y = entity.position.y || 0;
              coordinateSource = 'position';
            }
            // 4. startPoint 확인
            else if (entity.startPoint && (entity.startPoint.x !== 0 || entity.startPoint.y !== 0)) {
              actualPosition.x = entity.startPoint.x || 0;
              actualPosition.y = entity.startPoint.y || 0;
              coordinateSource = 'startPoint';
            }
            // 5. 직접 x, y 속성 확인 (마지막 우선순위)
            else if (entity.x !== undefined && entity.y !== undefined && (entity.x !== 0 || entity.y !== 0)) {
              actualPosition.x = entity.x;
              actualPosition.y = entity.y;
              coordinateSource = 'direct x,y';
            }
            // 6. fallback으로 xAxisX, xAxisY 다시 시도 (0,0이어도)
            else if (entity.xAxisX !== undefined && entity.xAxisY !== undefined) {
              actualPosition.x = entity.xAxisX;
              actualPosition.y = entity.xAxisY;
              coordinateSource = 'xAxisX,xAxisY (fallback)';
            }
            
            console.log(`   최종 좌표: x=${actualPosition.x}, y=${actualPosition.y} (출처: ${coordinateSource})`);
            
            foundTexts.push({
              text: foundText,
              position: actualPosition,
              layer: entity.layer || '기본',
              isRoomCandidate: true, // 모든 텍스트를 표시
              entityType: entityType,
              index: index,
              coordinateSource: coordinateSource,
              // DXF 텍스트 크기 정보 추가
              horizontalWidth: entity.horizontalWidth,
              verticalHeight: entity.verticalHeight,
              nominalTextHeight: entity.nominalTextHeight
            });
            
            console.log(`   레이어: ${entity.layer || '기본'}`);
            console.log(`   ✅ 텍스트 추가됨`);
          }
        }
        
        // INSERT 엔티티 내부의 텍스트도 확인
        if (entityType === 'INSERT' && entity.attributes) {
          entity.attributes.forEach((attr, attrIndex) => {
            if (attr.text || attr.value) {
              const text = attr.text || attr.value;
              console.log(`   속성 텍스트 [${attrIndex}]: "${text}"`);
              
              if (text && typeof text === 'string' && text.trim()) {
                foundTexts.push({
                  text: text.trim(),
                  position: entity.position || entity.startPoint || { x: 0, y: 0 },
                  layer: entity.layer || '기본',
                  isRoomCandidate: true, // 모든 텍스트를 표시
                  entityType: 'INSERT_ATTR',
                  index: index
                });
              }
            }
          });
        }
      });
      
      // 엔티티 타입 요약 출력
      console.log('\n📊 엔티티 타입별 분포:');
      Object.entries(entityTypes)
        .sort((a, b) => b[1] - a[1])
        .forEach(([type, count]) => {
          console.log(`   ${type}: ${count}개`);
        });
    }
    
    console.log(`\n📝 총 발견된 텍스트: ${foundTexts.length}개`);
    
    if (foundTexts.length > 0) {
      console.log('\n발견된 모든 텍스트 목록:');
      foundTexts.forEach((text, index) => {
        console.log(`   [${index + 1}] "${text.text}" (${text.entityType}) - 좌표: (${text.position.x}, ${text.position.y})`);
      });
    }
    
  } catch (error) {
    console.warn('텍스트 분석 실패:', error.message);
  }
  
  return { foundTexts, entityTypes, totalEntities };
};

/**
 * 90도 ARC 문 감지 (개선된 버전)
 */
const detect90DegreeDoors = (helper) => {
  const doors = [];
  
  try {
    if (helper.denormalised) {
      console.log('\n🚪 === 포괄적 문 감지 분석 ===');
      
      let arcDoors = 0;
      let insertDoors = 0;
      let polylineDoors = 0;
      let firstArcLogged = false;
      let arcCount = 0;
      
      helper.denormalised.forEach((entity, index) => {
        // 첫 번째 ARC 엔티티만 상세 로깅 (디버깅용)
        if (entity.type === 'ARC' && !firstArcLogged) {
          console.log(`🔍 첫 번째 ARC 엔티티[${index}] 전체 구조:`);
          console.log(JSON.stringify(entity, null, 2));
          firstArcLogged = true;
        }
        
        // 1. ARC 기반 문 호 감지 (기존 로직 개선)
        if (entity.type === 'ARC') {
          arcCount++;
          // ARC 엔티티의 다양한 속성명 확인
          let center = entity.center || entity.centerPoint || entity.position;
          let radius = entity.radius || entity.r;
          
          // center가 객체가 아닌 경우 x, y 속성에서 추출
          if (!center && (entity.x !== undefined || entity.y !== undefined)) {
            center = { x: entity.x || 0, y: entity.y || 0 };
          }
          
          // 여전히 center나 radius가 없으면 로깅하고 건너뛰기
          if (!center || !radius) {
            if (arcCount <= 3) { // 처음 3개만 로깅
              console.log(`   ⚠️ ARC[${index}] 중심점 또는 반지름 없음: center=${JSON.stringify(center)}, radius=${radius}`);
              console.log(`   전체 ARC 속성:`, JSON.stringify(entity, null, 2));
            }
            return;
          }
          
          const startAngle = entity.startAngle || 0;
          const endAngle = entity.endAngle || 0;
          
          // 각도를 도(degree)로 변환
          let startDeg = startAngle * (180 / Math.PI);
          let endDeg = endAngle * (180 / Math.PI);
          
          // 음수 각도 정규화
          if (startDeg < 0) startDeg += 360;
          if (endDeg < 0) endDeg += 360;
          
          let angleDiff = Math.abs(endDeg - startDeg);
          
          // 360도를 넘는 경우 처리
          if (angleDiff > 180) {
            angleDiff = 360 - angleDiff;
          }
          
          console.log(`   ARC[${index}]: 중심=(${center.x?.toFixed?.(0) || center.x}, ${center.y?.toFixed?.(0) || center.y}), 반지름=${radius.toFixed(0)}mm, 각도=${angleDiff.toFixed(1)}°, 레이어=${entity.layer || '기본'}`);
          
          // 문 호 조건을 매우 관대하게 설정 (모든 90도 ARC 포함)
          const isValidRadius = radius >= 100 && radius <= 5000; // 10cm ~ 500cm
          const isValidAngle = angleDiff >= 30 && angleDiff <= 150; // 30도 ~ 150도
          
          if (isValidRadius && isValidAngle) {
            doors.push({
              type: 'ARC_DOOR',
              center: center,
              radius: radius,
              angle: angleDiff,
              layer: entity.layer || '기본',
              entity: entity
            });
            
            arcDoors++;
            console.log(`   ✅ ARC 문 호 발견! 중심=(${center.x?.toFixed?.(0)}, ${center.y?.toFixed?.(0)}), 반지름=${radius.toFixed(0)}mm`);
          }
        }
        
        // 2. INSERT 블록에서 문 감지
        else if (entity.type === 'INSERT' && entity.name) {
          const blockName = entity.name.toLowerCase();
          const isDoorBlock = blockName.includes('door') || blockName.includes('문') || 
                             blockName.includes('gate') || blockName.includes('entrance');
          
          if (isDoorBlock && entity.position) {
            doors.push({
              type: 'INSERT_DOOR',
              center: entity.position,
              blockName: entity.name,
              layer: entity.layer || '기본',
              entity: entity
            });
            
            insertDoors++;
            console.log(`   🚪 INSERT 문 블록 발견! 이름="${entity.name}", 위치=(${entity.position.x?.toFixed?.(0)}, ${entity.position.y?.toFixed?.(0)})`);
          }
        }
        
        // 3. 레이어 이름으로 문 감지
        else if (entity.layer) {
          const layerName = entity.layer.toLowerCase();
          const isDoorLayer = layerName.includes('door') || layerName.includes('문') || 
                             layerName.includes('gate') || layerName.includes('entrance');
          
          if (isDoorLayer && (entity.center || entity.position || entity.startPoint)) {
            const position = entity.center || entity.position || entity.startPoint;
            
            doors.push({
              type: 'LAYER_DOOR',
              center: position,
              layer: entity.layer,
              entityType: entity.type,
              entity: entity
            });
            
            console.log(`   🏷️  문 레이어 엔티티 발견! 레이어="${entity.layer}", 타입=${entity.type}, 위치=(${position.x?.toFixed?.(0)}, ${position.y?.toFixed?.(0)})`);
          }
        }
      });
      
      console.log(`\n📊 문 감지 결과:`);
      console.log(`   ARC 문 호: ${arcDoors}개`);
      console.log(`   INSERT 문 블록: ${insertDoors}개`);
      console.log(`   레이어 기반 문: ${doors.length - arcDoors - insertDoors}개`);
      console.log(`   총 문 후보: ${doors.length}개`);
      
      // 문 위치 요약
      if (doors.length > 0) {
        console.log(`\n🗺️  감지된 문 위치들:`);
        doors.forEach((door, index) => {
          const x = door.center?.x?.toFixed?.(0) || door.center?.x || 'N/A';
          const y = door.center?.y?.toFixed?.(0) || door.center?.y || 'N/A';
          console.log(`   문 ${index + 1}: (${x}, ${y}) - ${door.type} - ${door.layer}`);
        });
      }
    }
    
  } catch (error) {
    console.warn('문 감지 실패:', error.message);
  }
  
  return doors;
};

/**
 * 종합 분석 실행
 */
const performComprehensiveAnalysis = (helper) => {
  console.log('\n🔬 === DXF 종합 분석 시작 ===');
  
  console.log('1️⃣ 구조 분석 시작...');
  const structureAnalysis = analyzeDxfStructure(helper);
  console.log('1️⃣ 구조 분석 완료');
  
  console.log('2️⃣ ARC 분석 시작...');
  const arcAnalysis = analyzeArcEntities(helper);
  console.log('2️⃣ ARC 분석 완료');
  
  console.log('3️⃣ 텍스트 분석 시작...');
  const textAnalysis = analyzeTextEntities(helper);
  console.log('3️⃣ 텍스트 분석 완료');
  
  console.log('4️⃣ 문 감지 시작...');
  const doorAnalysis = detect90DegreeDoors(helper);
  console.log('4️⃣ 문 감지 완료');
  
  console.log('\n✅ === 분석 완료 ===');
  console.log(`📊 총 엔티티: ${structureAnalysis.entityCount}개`);
  console.log(`📁 레이어: ${Object.keys(structureAnalysis.layerGroups).length}개`);
  console.log(`📐 ARC 엔티티: ${arcAnalysis.arcCount}개`);
  console.log(`📝 텍스트: ${textAnalysis.foundTexts.length}개`);
  console.log(`🚪 문 후보: ${doorAnalysis.length}개`);
  
  return {
    structure: structureAnalysis,
    arcs: arcAnalysis,
    texts: textAnalysis,
    doors: doorAnalysis
  };
};

module.exports = {
  analyzeDxfStructure,
  analyzeArcEntities,
  analyzeTextEntities,
  detect90DegreeDoors,
  performComprehensiveAnalysis
}; 