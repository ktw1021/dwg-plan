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
    
    // ARC 엔티티만 따로 찾아서 분석
    console.log('\n🔍 원본 파싱 데이터에서 ARC 엔티티 찾기:');
    const rawArcs = parsed.entities.filter(entity => entity.type === 'ARC');
    console.log(`원시 ARC 엔티티 개수: ${rawArcs.length}개`);
    
    if (rawArcs.length > 0) {
      console.log('첫 번째 원시 ARC 엔티티:');
      console.log(JSON.stringify(rawArcs[0], null, 2));
      
      // DXF 그룹 코드 분석
      if (rawArcs[0].groupCodes) {
        console.log('DXF 그룹 코드들:');
        Object.entries(rawArcs[0].groupCodes).forEach(([code, value]) => {
          console.log(`  ${code}: ${value}`);
        });
      }
    }
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
        
        // CIRCLE 엔티티 상세 분석 (처음 5개)
        if (entity.type === 'CIRCLE' && index < 1000) {
          const circleCount = helper.denormalised.slice(0, index).filter(e => e.type === 'CIRCLE').length;
          if (circleCount < 5) {
            console.log(`\n🔵 CIRCLE 엔티티[${index}] 상세 분석:`);
            console.log('   전체 구조:', JSON.stringify(entity, null, 2));
          }
        }
        
        // POLYLINE 엔티티 상세 분석 (처음 3개)
        if ((entity.type === 'POLYLINE' || entity.type === 'LWPOLYLINE') && index < 1000) {
          const polylineCount = helper.denormalised.slice(0, index).filter(e => e.type === 'POLYLINE' || e.type === 'LWPOLYLINE').length;
          if (polylineCount < 3) {
            console.log(`\n📐 ${entity.type} 엔티티[${index}] 상세 분석:`);
            console.log('   points 개수:', entity.points?.length || 0);
            console.log('   closed:', entity.closed);
            console.log('   layer:', entity.layer);
            if (entity.points && entity.points.length > 0) {
              console.log('   첫 번째 점:', entity.points[0]);
              console.log('   마지막 점:', entity.points[entity.points.length - 1]);
            }
          }
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
      const sortedTypes = Object.entries(entityTypes).sort((a, b) => b[1] - a[1]);
      
      sortedTypes.forEach(([type, count]) => {
        // 문과 관련될 수 있는 엔티티 타입들 표시
        const isDoorRelated = ['ARC', 'CIRCLE', 'INSERT', 'BLOCK'].includes(type);
        const marker = isDoorRelated ? '🚪' : '  ';
        console.log(`${marker} ${type}: ${count}개`);
      });
      
      // 문 감지에 유용한 엔티티들 요약
      const doorCandidateTypes = ['ARC', 'CIRCLE', 'INSERT', 'BLOCK'];
      const doorCandidates = doorCandidateTypes.filter(type => entityTypes[type] > 0);
      
      if (doorCandidates.length > 0) {
        console.log('\n🚪 문 감지 후보 엔티티들:');
        doorCandidates.forEach(type => {
          console.log(`   ${type}: ${entityTypes[type]}개`);
        });
      }
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
 * 개선된 문 감지 시스템 - 다양한 방법으로 문 찾기
 */
const detect90DegreeDoors = (helper) => {
  const doors = [];
  
  console.log('\n🚪🚪🚪 === DETECT90DEGREEDOORS 함수 강제 실행 확인 ===');
  console.log('🚪🚪🚪 이 메시지가 보이면 함수가 실행되고 있습니다!');
  console.log('\n🚪 === detect90DegreeDoors 함수 실행 시작 ===');
  console.log('helper 객체 확인:', !!helper);
  console.log('helper.denormalised 확인:', !!helper?.denormalised);
  console.log('helper.denormalised 길이:', helper?.denormalised?.length || 0);
  
  try {
    if (helper.denormalised) {
      console.log('\n🚪 === 개선된 문 감지 시스템 ===');
      
      let arcDoors = 0;
      let insertDoors = 0;
      let layerDoors = 0;
      let patternDoors = 0;
      let firstArcLogged = false;
      let arcCount = 0;
      
      // 전체 엔티티 타입 분포 먼저 확인
      const entityTypes = {};
      helper.denormalised.forEach(entity => {
        const type = entity.type || 'UNKNOWN';
        entityTypes[type] = (entityTypes[type] || 0) + 1;
      });
      
      console.log('🔍 전체 엔티티 타입 분포:');
      Object.entries(entityTypes).forEach(([type, count]) => {
        console.log(`   ${type}: ${count}개`);
      });
      
      // 1단계: 모든 엔티티 스캔하여 문 패턴 찾기
      helper.denormalised.forEach((entity, index) => {
        
        // ARC 엔티티 상세 분석 (처음 10개)
        if (entity.type === 'ARC' && arcCount < 10) {
          console.log(`\n🔍 ARC 엔티티[${index}] 상세 분석:`);
          console.log('   모든 속성:', Object.keys(entity));
          console.log('   전체 구조:', JSON.stringify(entity, null, 2));
          
          // 원시 DXF 데이터도 확인해보기
          if (helper.parsed && helper.parsed.entities && helper.parsed.entities[index]) {
            console.log('   📄 원시 DXF 데이터:', JSON.stringify(helper.parsed.entities[index], null, 2));
          }
          
          // 가능한 모든 좌표/크기 속성 확인
          const coordProps = ['center', 'centerPoint', 'position', 'startPoint', 'x', 'y', 'centerX', 'centerY'];
          const sizeProps = ['radius', 'r', 'rad', 'size', 'diameter'];
          const angleProps = ['startAngle', 'endAngle', 'start', 'end', 'angle', 'totalAngle'];
          
          console.log('   좌표 관련 속성들:');
          coordProps.forEach(prop => {
            if (entity[prop] !== undefined) {
              console.log(`     ${prop}:`, entity[prop]);
            }
          });
          
          console.log('   크기 관련 속성들:');
          sizeProps.forEach(prop => {
            if (entity[prop] !== undefined) {
              console.log(`     ${prop}:`, entity[prop]);
            }
          });
          
          console.log('   각도 관련 속성들:');
          angleProps.forEach(prop => {
            if (entity[prop] !== undefined) {
              console.log(`     ${prop}:`, entity[prop]);
            }
          });
          
          arcCount++;
        }
        
        // 방법 1: ARC 기반 문 호 감지 (올바른 속성명 사용)
        if (entity.type === 'ARC') {
          arcCount++;
          
          // 실제 ARC 속성 사용: x, y (중심점), r (반지름), startAngle, endAngle
          let centerX = entity.x || 0;
          let centerY = entity.y || 0;
          const radius = entity.r || 0;
          const startAngle = entity.startAngle || 0;
          const endAngle = entity.endAngle || 0;
          
          // 🔥 transforms 적용하여 실제 좌표 계산
          if (entity.transforms && entity.transforms.length > 0) {
            const transform = entity.transforms[0]; // 첫 번째 변환 사용
            if (transform.x !== undefined && transform.y !== undefined) {
              // 변환된 좌표 계산
              let transformedX = centerX;
              let transformedY = centerY;
              
              // 스케일 적용
              if (transform.scaleX !== undefined) {
                transformedX *= transform.scaleX;
              }
              if (transform.scaleY !== undefined) {
                transformedY *= transform.scaleY;
              }
              
              // 회전 적용 (도 단위를 라디안으로 변환)
              if (transform.rotation !== undefined) {
                const rotRad = (transform.rotation * Math.PI) / 180;
                const cosRot = Math.cos(rotRad);
                const sinRot = Math.sin(rotRad);
                const newX = transformedX * cosRot - transformedY * sinRot;
                const newY = transformedX * sinRot + transformedY * cosRot;
                transformedX = newX;
                transformedY = newY;
              }
              
              // 이동 적용
              centerX = transformedX + transform.x;
              centerY = transformedY + transform.y;
              
              if (arcCount <= 10) {
                console.log(`   🔄 변환 적용: 원본(${entity.x}, ${entity.y}) -> 변환(${centerX.toFixed(0)}, ${centerY.toFixed(0)})`);
                console.log(`   🔄 변환 정보:`, JSON.stringify(transform, null, 2));
              }
            }
          }
          
          // 🎯 ARC 문의 경우 박스 위치를 호(부채꼴) 중심으로 이동
          if (entity.type === 'ARC_DOOR' && entity.radius && entity.startAngle !== undefined && entity.endAngle !== undefined) {
            // 각도를 0~2π 범위로 정규화
            let startAngle = entity.startAngle;
            let endAngle = entity.endAngle;
            
            // 각도를 0~360도로 변환하여 이해하기 쉽게
            let startDegree = ((startAngle * 180 / Math.PI) % 360 + 360) % 360;
            let endDegree = ((endAngle * 180 / Math.PI) % 360 + 360) % 360;
            
            // 매우 작은 각도는 0도로 처리
            if (Math.abs(startDegree) < 0.001) startDegree = 0;
            if (Math.abs(endDegree) < 0.001) endDegree = 0;
            if (Math.abs(startDegree - 360) < 0.001) startDegree = 0;
            if (Math.abs(endDegree - 360) < 0.001) endDegree = 0;
            
            // 🔧 올바른 호의 중심 방향 계산
            let midAngle;
            
            // 각도 차이가 음수인 경우 처리 (시계 반대 방향)
            if (endAngle < startAngle) {
              endAngle += 2 * Math.PI;
            }
            
            // 호의 실제 중간 각도 계산
            midAngle = (startAngle + endAngle) / 2;
            
            // 🎯 중간 각도를 0~2π 범위로 정규화
            midAngle = midAngle % (2 * Math.PI);
            if (midAngle < 0) midAngle += 2 * Math.PI;
            
            // 🎯 간단한 해결책: 호의 중간 각도 방향으로 이동
            // 복잡한 보정 없이 실제 호가 있는 방향으로 박스 이동
            const correctedAngle = midAngle;
            
            // 호의 중심 방향으로 반지름의 70%만큼 이동
            const offsetDistance = entity.radius * 0.7; // 반지름의 70%만큼 이동
            const offsetX = Math.cos(correctedAngle) * offsetDistance;
            const offsetY = Math.sin(correctedAngle) * offsetDistance;
            
            // 원래 중심점에서 호의 중심 방향으로 이동
            let svgCenterX = centerX + offsetX;
            let svgCenterY = -(centerY + offsetY); // Y축 뒤집기 적용
            
            console.log(`   🎯 ARC 문 위치 조정: 중심(${centerX.toFixed(0)}, ${centerY.toFixed(0)}) -> 호중심(${svgCenterX.toFixed(0)}, ${svgCenterY.toFixed(0)})`);
            console.log(`   🎯 각도 정보: 시작=${startDegree.toFixed(1)}°, 끝=${endDegree.toFixed(1)}°, 중간=${(midAngle * 180 / Math.PI).toFixed(1)}°`);
            console.log(`   🎯 이동 거리: ${offsetDistance.toFixed(0)}mm, 방향=(${offsetX.toFixed(0)}, ${offsetY.toFixed(0)})`);
          }
          
          // 유효한 ARC 데이터인지 확인
          if (centerX !== undefined && centerY !== undefined && radius !== undefined && 
              startAngle !== undefined && endAngle !== undefined) {
            
            // 각도 차이 계산 (라디안을 도로 변환)
            let angleDiff = Math.abs(endAngle - startAngle) * (180 / Math.PI);
            if (angleDiff > 180) angleDiff = 360 - angleDiff;
            
            // 🔥 실제 문 크기 필터링 추가
            // - 반지름: 300mm ~ 1200mm (실제 문 크기)
            // - 각도: 85° ~ 95° (90도 근처)
            // - 레이어: 문과 관련된 레이어만
            const isValidDoorSize = radius >= 300 && radius <= 1200;
            const isValidDoorAngle = angleDiff >= 85 && angleDiff <= 95;
            const isDoorLayer = entity.layer && (
              entity.layer.toLowerCase().includes('door') ||
              entity.layer.toLowerCase().includes('문') ||
              entity.layer === '0' // 기본 레이어도 포함
            );
            
            if (isValidDoorSize && isValidDoorAngle && isDoorLayer) {
              doors.push({
                type: 'ARC_DOOR',
                center: { x: centerX, y: centerY },
                radius: radius,
                angle: angleDiff,
                startAngle: startAngle,
                endAngle: endAngle,
                layer: entity.layer || '기본',
                confidence: 0.9, // 높은 신뢰도
                entity: entity
              });
              arcDoors++;
              console.log(`   ✅ 실제 문 발견! 중심=(${centerX.toFixed(0)}, ${centerY.toFixed(0)}), 반지름=${radius.toFixed(0)}mm, 각도=${angleDiff.toFixed(1)}°, 레이어=${entity.layer}`);
            } else {
              // 조건에 맞지 않는 경우 이유 로깅
              if (arcCount <= 10) {
                const reasons = [];
                if (!isValidDoorSize) reasons.push(`크기=${radius.toFixed(0)}mm (300-1200)`);
                if (!isValidDoorAngle) reasons.push(`각도=${angleDiff.toFixed(1)}° (85-95)`);
                if (!isDoorLayer) reasons.push(`레이어=${entity.layer} (문 관련 아님)`);
                console.log(`   ❌ 문 조건 불만족: ${reasons.join(', ')}`);
              }
            }
          } else {
            if (arcCount <= 10) {
              console.log(`   ❌ 필수 속성 누락: x=${centerX}, y=${centerY}, r=${radius}, start=${startAngle}, end=${endAngle}`);
            }
          }
        }
        
        // 방법 2: INSERT 블록에서 문 감지 (블록명 기반)
        else if (entity.type === 'INSERT' && entity.name) {
          const blockName = entity.name.toLowerCase();
          const doorKeywords = ['door', '문', 'gate', 'entrance', 'exit', 'portal', 'opening'];
          const isDoorBlock = doorKeywords.some(keyword => blockName.includes(keyword));
          
          if (isDoorBlock && entity.position) {
            doors.push({
              type: 'INSERT_DOOR',
              center: entity.position,
              blockName: entity.name,
              layer: entity.layer || '기본',
              confidence: 0.9,
              entity: entity
            });
            insertDoors++;
            console.log(`   🚪 INSERT 문 블록 발견! 이름="${entity.name}", 위치=(${entity.position.x?.toFixed(0)}, ${entity.position.y?.toFixed(0)})`);
          }
        }
        
        // 방법 3: 레이어 이름으로 문 감지
        else if (entity.layer) {
          const layerName = entity.layer.toLowerCase();
          const doorKeywords = ['door', '문', 'gate', 'entrance', 'exit', 'opening'];
          const isDoorLayer = doorKeywords.some(keyword => layerName.includes(keyword));
          
          if (isDoorLayer) {
            const position = entity.center || entity.position || entity.startPoint || { x: entity.x || 0, y: entity.y || 0 };
            
            doors.push({
              type: 'LAYER_DOOR',
              center: position,
              layer: entity.layer,
              entityType: entity.type,
              confidence: 0.7,
              entity: entity
            });
            layerDoors++;
            console.log(`   🏷️ 문 레이어 엔티티 발견! 레이어="${entity.layer}", 타입=${entity.type}`);
          }
        }
        
        // 방법 4: 기하학적 패턴으로 문 감지 (직사각형 + 호)
        if (entity.type === 'POLYLINE' || entity.type === 'LWPOLYLINE') {
          // 문 크기에 맞는 직사각형 찾기
          if (entity.points && entity.points.length >= 4) {
            const points = entity.points;
            const width = Math.abs(points[1].x - points[0].x);
            const height = Math.abs(points[2].y - points[1].y);
            
            // 문 크기 범위 (600mm-1200mm 폭, 1800mm-2400mm 높이)
            if ((width >= 600 && width <= 1200 && height >= 1800 && height <= 2400) ||
                (height >= 600 && height <= 1200 && width >= 1800 && width <= 2400)) {
              
              const centerX = (points[0].x + points[2].x) / 2;
              const centerY = (points[0].y + points[2].y) / 2;
              
              doors.push({
                type: 'PATTERN_DOOR',
                center: { x: centerX, y: centerY },
                width: width,
                height: height,
                layer: entity.layer || '기본',
                confidence: 0.6,
                entity: entity
              });
              patternDoors++;
              console.log(`   📐 패턴 문 발견! 크기=${width.toFixed(0)}x${height.toFixed(0)}mm, 중심=(${centerX.toFixed(0)}, ${centerY.toFixed(0)})`);
            }
          }
        }
      });
      
      // 2단계: 중복 제거 (같은 위치의 문들)
      const uniqueDoors = [];
      const tolerance = 100; // 100mm 이내는 같은 문으로 간주
      
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
      
      console.log(`\n📊 문 감지 결과:`);
      console.log(`   ARC 문 호: ${arcDoors}개`);
      console.log(`   INSERT 문 블록: ${insertDoors}개`);
      console.log(`   레이어 기반 문: ${layerDoors}개`);
      console.log(`   패턴 기반 문: ${patternDoors}개`);
      console.log(`   총 문 후보: ${doors.length}개`);
      console.log(`   중복 제거 후: ${uniqueDoors.length}개`);
      
      // 3단계: 신뢰도별 정렬
      uniqueDoors.sort((a, b) => b.confidence - a.confidence);
      
      if (uniqueDoors.length > 0) {
        console.log(`\n🗺️ 감지된 문 위치들 (신뢰도순):`);
        uniqueDoors.forEach((door, index) => {
          const x = door.center?.x?.toFixed?.(0) || door.center?.x || 'N/A';
          const y = door.center?.y?.toFixed?.(0) || door.center?.y || 'N/A';
          const confidence = (door.confidence * 100).toFixed(0);
          console.log(`   문 ${index + 1}: (${x}, ${y}) - ${door.type} - 신뢰도 ${confidence}% - ${door.layer}`);
        });
      }
      
      console.log(`\\n🚪 === 문 감지 완료 ===`);
      console.log(`총 감지된 문: ${doors.length}개`);
      console.log(`ARC 기반 문: ${arcDoors}개`);
      console.log(`INSERT 기반 문: ${insertDoors}개`);
      console.log(`레이어 기반 문: ${layerDoors}개`);
      console.log(`패턴 기반 문: ${patternDoors}개`);
      
      // 🔥 직접 SVG 빨간색 박스 HTML 생성
      if (doors.length > 0) {
        console.log(`\\n🔥 === SVG 표준 형식 빨간색 박스 HTML 생성 ===`);
        let doorMarkersHtml = '\\n  <!-- 감지된 문 마커 (SVG 표준 사각형) -->\\n';
        
        doors.forEach((door, index) => {
          const centerX = door.center?.x || 0;
          const centerY = door.center?.y || 0;
          
          // 🔥 SVG 좌표계 변환 (Y축 뒤집기)
          let svgCenterX = centerX;
          let svgCenterY = -centerY; // DXF Y좌표를 SVG Y좌표로 변환
          
          // 🎯 ARC 문의 경우 박스 위치를 호(부채꼴) 중심으로 이동
          if (door.type === 'ARC_DOOR' && door.radius && door.startAngle !== undefined && door.endAngle !== undefined) {
            // 각도를 0~2π 범위로 정규화
            let startAngle = door.startAngle;
            let endAngle = door.endAngle;
            
            // 각도를 0~360도로 변환하여 이해하기 쉽게
            let startDegree = ((startAngle * 180 / Math.PI) % 360 + 360) % 360;
            let endDegree = ((endAngle * 180 / Math.PI) % 360 + 360) % 360;
            
            // 매우 작은 각도는 0도로 처리
            if (Math.abs(startDegree) < 0.001) startDegree = 0;
            if (Math.abs(endDegree) < 0.001) endDegree = 0;
            if (Math.abs(startDegree - 360) < 0.001) startDegree = 0;
            if (Math.abs(endDegree - 360) < 0.001) endDegree = 0;
            
            // 🔧 올바른 호의 중심 방향 계산
            let midAngle;
            
            // 각도 차이가 음수인 경우 처리 (시계 반대 방향)
            if (endAngle < startAngle) {
              endAngle += 2 * Math.PI;
            }
            
            // 호의 실제 중간 각도 계산
            midAngle = (startAngle + endAngle) / 2;
            
            // 🎯 중간 각도를 0~2π 범위로 정규화
            midAngle = midAngle % (2 * Math.PI);
            if (midAngle < 0) midAngle += 2 * Math.PI;
            
            // 🎯 간단한 해결책: 호의 중간 각도 방향으로 이동
            // 복잡한 보정 없이 실제 호가 있는 방향으로 박스 이동
            const correctedAngle = midAngle;
            
            // 호의 중심 방향으로 반지름의 70%만큼 이동
            const offsetDistance = door.radius * 0.7; // 반지름의 70%만큼 이동
            const offsetX = Math.cos(correctedAngle) * offsetDistance;
            const offsetY = Math.sin(correctedAngle) * offsetDistance;
            
            // 원래 중심점에서 호의 중심 방향으로 이동
            svgCenterX = centerX + offsetX;
            svgCenterY = -(centerY + offsetY); // Y축 뒤집기 적용
            
            console.log(`   🎯 ARC 문 위치 조정: 중심(${centerX.toFixed(0)}, ${centerY.toFixed(0)}) -> 호중심(${svgCenterX.toFixed(0)}, ${svgCenterY.toFixed(0)})`);
            console.log(`   🎯 각도 정보: 시작=${startDegree.toFixed(1)}°, 끝=${endDegree.toFixed(1)}°, 중간=${(midAngle * 180 / Math.PI).toFixed(1)}°`);
            console.log(`   🎯 이동 거리: ${offsetDistance.toFixed(0)}mm, 방향=(${offsetX.toFixed(0)}, ${offsetY.toFixed(0)})`);
          }
          
          // 🔥 문 타입에 따라 적절한 마커 크기 결정 (문을 완전히 감싸도록)
          let markerSize = 400; // 기본 크기 (40cm) - 이전보다 2배 증가
          
          if (door.type === 'ARC_DOOR' && door.radius) {
            // ARC 문의 경우 반지름에 비례하되 문을 완전히 감쌀 수 있도록 크게
            markerSize = Math.min(Math.max(door.radius * 0.8, 300), 800); // 반지름의 80%, 최소 30cm, 최대 80cm
            console.log(`   ARC 문 마커 크기: 반지름=${door.radius.toFixed(0)}mm -> 마커=${markerSize.toFixed(0)}mm`);
          } else if (door.type === 'INSERT_DOOR') {
            markerSize = 600; // INSERT 블록은 더 크게
          } else if (door.type === 'PATTERN_DOOR') {
            markerSize = Math.min(door.width || 400, door.height || 400, 700); // 패턴 문, 최대 70cm
          } else if (door.type === 'LAYER_DOOR') {
            markerSize = 350; // 레이어 기반 문도 크게
          }
          
          // SVG 표준 사각형 형식으로 빨간색 박스 생성
          const rectX = svgCenterX - markerSize/2;
          const rectY = svgCenterY - markerSize/2;
          
          doorMarkersHtml += `  <rect ` +
                            `x="${rectX.toFixed(1)}" ` +
                            `y="${rectY.toFixed(1)}" ` +
                            `width="${markerSize.toFixed(1)}" ` +
                            `height="${markerSize.toFixed(1)}" ` +
                            `stroke="#ff0000" ` +
                            `stroke-width="12" ` +
                            `fill="rgba(255,0,0,0.15)" ` +
                            `opacity="0.95" ` +
                            `class="door-marker" />\\n`;
          
          // 문 번호 라벨 추가 (SVG 표준 텍스트 형식)
          doorMarkersHtml += `  <text ` +
                            `x="${svgCenterX.toFixed(1)}" ` +
                            `y="${(svgCenterY + 8).toFixed(1)}" ` +
                            `text-anchor="middle" ` +
                            `dominant-baseline="middle" ` +
                            `font-family="Arial, sans-serif" ` +
                            `font-size="18" ` +
                            `font-weight="bold" ` +
                            `fill="#ff0000" ` +
                            `stroke="#ffffff" ` +
                            `stroke-width="2" ` +
                            `class="door-label">문${index + 1}</text>\\n`;
          
          console.log(`   문 ${index + 1}: DXF(${centerX.toFixed(0)}, ${centerY.toFixed(0)}) -> SVG(${svgCenterX.toFixed(0)}, ${svgCenterY.toFixed(0)}) - ${door.type} - 크기=${markerSize.toFixed(0)}mm`);
        });
        
        console.log(`🔥 SVG 표준 빨간색 박스 HTML 생성 완료: ${doorMarkersHtml.length} 바이트`);
        console.log(`🔥 생성된 문 마커 개수: ${doors.length}개`);
        
        // 🔥 결과 객체에 doorMarkersHtml 추가
        const result = {
          doors: uniqueDoors,
          doorMarkersHtml: doorMarkersHtml,
          length: uniqueDoors.length
        };
        
        // 배열처럼 접근할 수 있도록 인덱스 속성 추가
        uniqueDoors.forEach((door, index) => {
          result[index] = door;
        });
        
        return result;
      }
      
      return uniqueDoors;
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
  
  console.log('🔍 helper 객체 확인:', !!helper);
  console.log('🔍 helper.denormalised 확인:', !!helper?.denormalised);
  console.log('🔍 helper.denormalised 길이:', helper?.denormalised?.length || 0);
  console.log('🔍 helper.parsed 확인:', !!helper?.parsed);
  console.log('🔍 helper.parsed.entities 확인:', !!helper?.parsed?.entities);
  console.log('🔍 helper.parsed.entities 길이:', helper?.parsed?.entities?.length || 0);
  
  try {
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
  } catch (error) {
    console.error('❌ performComprehensiveAnalysis 에러:', error.message);
    console.error('❌ 에러 스택:', error.stack);
    throw error;
  }
};

module.exports = {
  analyzeDxfStructure,
  analyzeArcEntities,
  analyzeTextEntities,
  detect90DegreeDoors,
  performComprehensiveAnalysis
}; 