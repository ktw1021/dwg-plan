/**
 * DXF 라이브러리만 사용하는 순수한 처리기
 * DWG → DXF 변환 + dxf 라이브러리 활용 + 90도 ARC 문 감지 + 벽 색상 변경
 */

const fs = require('fs');
const path = require('path');
const { Helper } = require('dxf');
const { spawn } = require('child_process');

/**
 * DWG/DXF 파일 처리 메인 함수
 */
const processCompleteDxfFile = async (jobId, filename, filePath, progressCallback) => {
  try {
    progressCallback(10, '파일 분석 중...');
    
    if (!fs.existsSync(filePath)) {
      throw new Error('파일을 찾을 수 없습니다');
    }
    
    // 파일 확장자 확인
    const fileExt = path.extname(filename).toLowerCase();
    let dxfContent;
    
    if (fileExt === '.dwg') {
      // DWG 파일인 경우 DXF로 변환
      progressCallback(30, 'DWG 파일을 DXF로 변환 중...');
      dxfContent = await convertDwgToDxf(filePath);
    } else if (fileExt === '.dxf') {
      // DXF 파일인 경우 바로 읽기
      progressCallback(30, 'DXF 파일 읽는 중...');
      dxfContent = fs.readFileSync(filePath, 'utf8');
    } else {
      throw new Error('지원하지 않는 파일 형식입니다. DWG 또는 DXF 파일만 업로드해주세요.');
    }
    
    console.log(`파일 크기: ${(dxfContent.length / 1024).toFixed(1)} KB`);
    
    progressCallback(50, 'DXF 파싱 및 SVG 변환 중...');
    
    // dxf 라이브러리의 Helper 클래스 사용
    const helper = new Helper(dxfContent);
    
    console.log('DXF 파싱 성공');
    console.log('파싱된 엔티티:', helper.parsed?.entities?.length || 0);
    console.log('정규화된 엔티티:', helper.denormalised?.length || 0);
    
    // ARC 엔티티 분석
    analyzeArcEntities(helper);
    
    // 텍스트 엔티티 분석
    analyzeTextEntities(helper);
    
    // SVG 생성 (라이브러리 기본 기능 사용)
    let svgContent = helper.toSVG();
    
    progressCallback(60, '벽 색상 변경 및 viewBox 최적화 중...');
    
    // 벽 색상 변경 + viewBox 최적화
    svgContent = changeWallColors(svgContent);
    
    progressCallback(65, '방 이름 텍스트 추가 중...');
    
    // 방 이름 텍스트 추가 (스마트 배치)
    svgContent = addRoomLabels(svgContent, helper);
    
    progressCallback(70, '90도 문 호 감지 및 표시 중...');
    
    // 90도 ARC 문 감지 및 표시
    svgContent = add90DegreeDoorMarkers(svgContent, helper);
    
    progressCallback(80, 'SVG 파일 저장 중...');
    
    const svgFileName = `${jobId}.svg`;
    const svgFilePath = path.join(__dirname, '..', 'results', svgFileName);
    
    const resultsDir = path.dirname(svgFilePath);
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    fs.writeFileSync(svgFilePath, svgContent, 'utf8');
    console.log(`SVG 파일 저장: ${svgFilePath}`);
    
    progressCallback(100, 'DXF 처리 완료');
    
    return {
      jobId,
      svgFile: svgFilePath,
      entityCount: helper.denormalised?.length || 0,
      success: true,
      processingMethod: 'dxf-library-with-dwg-conversion'
    };
    
  } catch (error) {
    console.error(`파일 처리 오류: ${error.message}`);
    throw error;
  }
};

/**
 * DWG를 DXF로 변환 (ODA File Converter 사용)
 */
const convertDwgToDxf = async (dwgFilePath) => {
  try {
    console.log('ODA File Converter를 사용하여 DWG → DXF 변환 시작...');
    
    // ODA File Converter 실행 파일 경로 (일반적인 설치 경로들)
    const possibleOdaPaths = [
      'C:\\Program Files\\ODA\\ODAFileConverter 26.4.0\\ODAFileConverter.exe', // 사용자 시스템
      'C:\\Program Files\\ODA\\ODAFileConverter\\ODAFileConverter.exe',
      'C:\\Program Files (x86)\\ODA\\ODAFileConverter\\ODAFileConverter.exe',
      'C:\\Program Files (x86)\\ODA\\ODAFileConverter 26.4.0\\ODAFileConverter.exe',
      'ODAFileConverter.exe' // PATH에 등록된 경우
    ];
    
    console.log('🔍 ODA File Converter 경로 탐색 중...');
    let odaPath = null;
    for (const pathToCheck of possibleOdaPaths) {
      console.log(`   검사 중: ${pathToCheck}`);
      if (fs.existsSync(pathToCheck)) {
        odaPath = pathToCheck;
        console.log(`   ✅ 발견: ${pathToCheck}`);
        break;
      } else {
        console.log(`   ❌ 없음: ${pathToCheck}`);
      }
    }
    
    if (!odaPath) {
      throw new Error('ODA File Converter를 찾을 수 없습니다. 설치되어 있는지 확인해주세요.');
    }
    
    // 임시 출력 디렉토리 생성
    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const inputDir = path.dirname(dwgFilePath);
    const outputDir = tempDir;
    const dwgFileName = path.basename(dwgFilePath, path.extname(dwgFilePath));
    const dxfFilePath = path.join(outputDir, `${dwgFileName}.dxf`);
    
    // ODA File Converter 실행
    const args = [
      inputDir,        // 입력 디렉토리
      outputDir,       // 출력 디렉토리  
      'ACAD2018',      // 출력 버전
      'DXF',           // 출력 형식
      '1',             // 반복 모드
      '1',             // 감사 정보 포함
      `${dwgFileName}.dwg` // 입력 파일명
    ];
    
    console.log(`ODA 명령어: ${odaPath} ${args.join(' ')}`);
    
    return new Promise((resolve, reject) => {
      const odaProcess = spawn(odaPath, args, {
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let stdout = '';
      let stderr = '';
      
      odaProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      odaProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      odaProcess.on('close', (code) => {
        if (code === 0 && fs.existsSync(dxfFilePath)) {
          console.log('DWG → DXF 변환 완료');
          
          try {
            const dxfContent = fs.readFileSync(dxfFilePath, 'utf8');
            
            // 임시 파일 정리
            try {
              fs.unlinkSync(dxfFilePath);
            } catch (e) {
              console.warn('임시 DXF 파일 삭제 실패:', e.message);
            }
            
            resolve(dxfContent);
          } catch (readError) {
            reject(new Error(`변환된 DXF 파일 읽기 실패: ${readError.message}`));
          }
        } else {
          console.error('ODA 변환 실패:', stderr);
          reject(new Error(`ODA File Converter 실행 실패 (코드: ${code})\n${stderr}`));
        }
      });
      
      odaProcess.on('error', (error) => {
        reject(new Error(`ODA File Converter 실행 오류: ${error.message}`));
      });
      
      // 타임아웃 설정 (30초)
      setTimeout(() => {
        odaProcess.kill();
        reject(new Error('DWG 변환 시간 초과 (30초)'));
      }, 30000);
    });
    
  } catch (error) {
    console.error('DWG 변환 오류:', error.message);
    
    // ODA 실패 시 libredwg-web으로 fallback
    console.log('ODA 변환 실패, libredwg-web으로 재시도...');
    try {
      const { libredwgjs } = require('@mlightcad/libredwg-web');
      const dwgBuffer = fs.readFileSync(dwgFilePath);
      const result = await libredwgjs(dwgBuffer, 'dxf');
      
      if (result && result.content) {
        console.log('libredwg-web 변환 성공');
        return result.content;
      }
    } catch (fallbackError) {
      console.error('Fallback 변환도 실패:', fallbackError.message);
    }
    
    throw new Error(`DWG 파일 변환에 실패했습니다. DXF 파일로 변환하여 업로드해주세요. (ODA 오류: ${error.message})`);
  }
};

/**
 * 벽 색상 변경 (노란색 + 회색 → 진한 녹색) + viewBox 최적화 + 방 이름 텍스트 추가
 */
const changeWallColors = (svgContent) => {
  try {
    console.log('벽 색상을 진한 녹색으로 변경하고 viewBox 최적화 중...');
    
    // 1. 다양한 벽 색상들을 진한 녹색으로 교체
    svgContent = svgContent
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
    
    // 2. viewBox 최적화 (좌표 범위 자동 조정)
    svgContent = optimizeViewBox(svgContent);
    
    return svgContent;
    
  } catch (error) {
    console.warn('벽 색상 변경 실패:', error.message);
    return svgContent;
  }
};

/**
 * SVG viewBox 최적화 (엔티티가 화면 전체에 보이도록 조정)
 */
const optimizeViewBox = (svgContent) => {
  try {
    console.log('SVG viewBox 최적화 중...');
    
    // 현재 viewBox 추출
    const viewBoxMatch = svgContent.match(/viewBox="([^"]+)"/);
    if (!viewBoxMatch) {
      console.warn('viewBox를 찾을 수 없음');
      return svgContent;
    }
    
    const currentViewBox = viewBoxMatch[1];
    const [x, y, width, height] = currentViewBox.split(' ').map(Number);
    
    console.log(`현재 viewBox: x=${x.toFixed(0)}, y=${y.toFixed(0)}, w=${width.toFixed(0)}, h=${height.toFixed(0)}`);
    
    // 모든 path 요소에서 좌표 추출 (더 정확한 방법)
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
      console.log(`현재 면적: ${currentArea.toFixed(0)}, 추출된 면적: ${extractedArea.toFixed(0)}`);
      return svgContent;
    }
    
    // 5% 여백 추가 (더 보수적으로)
    const margin = Math.max(extractedWidth * 0.05, extractedHeight * 0.05, 50);
    const newX = minX - margin;
    const newY = minY - margin;
    const newWidth = extractedWidth + (margin * 2);
    const newHeight = extractedHeight + (margin * 2);
    
    const newViewBox = `${newX.toFixed(2)} ${newY.toFixed(2)} ${newWidth.toFixed(2)} ${newHeight.toFixed(2)}`;
    
    console.log(`최적화된 viewBox: ${newViewBox}`);
    console.log(`크기 변화: ${((newWidth * newHeight) / (width * height) * 100).toFixed(1)}%`);
    
    // viewBox 교체
    svgContent = svgContent.replace(/viewBox="[^"]+"/, `viewBox="${newViewBox}"`);
    
    return svgContent;
    
  } catch (error) {
    console.warn('viewBox 최적화 실패:', error.message);
    return svgContent;
  }
};

/**
 * 90도 ARC 문 감지 및 빨간색 사각형 마커 추가
 */
const add90DegreeDoorMarkers = (svgContent, helper) => {
  try {
    const doors = detect90DegreeDoors(helper);
    console.log(`\n🚪 ${doors.length}개의 90도 문 호 감지됨`);
    
    if (doors.length === 0) {
      return svgContent;
    }
    
    // SVG 닫는 태그 찾기
    const svgEndIndex = svgContent.lastIndexOf('</svg>');
    if (svgEndIndex === -1) {
      return svgContent;
    }
    
    // 문 마커 생성
    let doorMarkersHtml = '\n  <!-- 90도 문 호 마커 -->\n';
    doors.forEach((door, index) => {
      const markerSize = door.radius * 0.4; // 반지름의 40% 크기
      const centerX = door.center.x;
      const centerY = door.center.y;
      
      doorMarkersHtml += `  <rect class="door-marker-90" x="${centerX - markerSize/2}" y="${centerY - markerSize/2}" width="${markerSize}" height="${markerSize}" />\n`;
    });
    
    // 스타일 추가 (빨간색으로 되돌림)
    const styleInsert = `  <style>
    .door-marker-90 { 
      stroke: #ff0000; 
      stroke-width: 4; 
      fill: rgba(255, 0, 0, 0.4); 
      opacity: 0.8;
    }
  </style>\n`;
    
    // 첫 번째 <g> 태그나 적절한 위치 찾기
    const firstGroupIndex = svgContent.indexOf('<g');
    if (firstGroupIndex !== -1) {
      svgContent = svgContent.slice(0, firstGroupIndex) + styleInsert + svgContent.slice(firstGroupIndex);
    }
    
    // 문 마커를 SVG 끝 부분에 추가
    svgContent = svgContent.slice(0, svgEndIndex) + doorMarkersHtml + svgContent.slice(svgEndIndex);
    
    return svgContent;
    
  } catch (error) {
    console.warn('90도 문 마커 추가 실패:', error.message);
    return svgContent;
  }
};

/**
 * 90도 ARC 문 감지
 */
const detect90DegreeDoors = (helper) => {
  const doors = [];
  
  try {
    if (helper.denormalised) {
      console.log('\n🚪 ARC 문 감지 상세 분석:');
      
      helper.denormalised.forEach((entity, index) => {
        if (entity.type === 'ARC' && entity.center && entity.radius) {
          const startAngle = entity.startAngle || 0;
          const endAngle = entity.endAngle || 0;
          
          // 각도를 도(degree)로 변환 (라디안일 수 있음)
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
          
          console.log(`   ARC[${index}]: 반지름=${entity.radius?.toFixed?.(0) || entity.radius}mm, 시작=${startDeg.toFixed(1)}°, 끝=${endDeg.toFixed(1)}°, 차이=${angleDiff.toFixed(1)}°, 레이어=${entity.layer || '기본'}`);
          
          // 문 호 조건 확장: 60도~120도 범위, 반지름 30cm~200cm
          const isValidRadius = entity.radius >= 300 && entity.radius <= 2000; // 30cm~200cm (mm 단위)
          const isValidAngle = angleDiff >= 60 && angleDiff <= 120;
          
          if (isValidRadius && isValidAngle) {
            doors.push({
              center: entity.center,
              radius: entity.radius,
              angle: angleDiff,
              layer: entity.layer || '기본',
              entity: entity
            });
            
            console.log(`   🎯 문 호 후보 발견! 반지름=${entity.radius.toFixed(0)}mm, 각도=${angleDiff.toFixed(1)}°`);
          } else {
            const reasons = [];
            if (!isValidRadius) reasons.push(`반지름=${entity.radius.toFixed(0)}mm (범위밖)`);
            if (!isValidAngle) reasons.push(`각도=${angleDiff.toFixed(1)}° (범위밖)`);
            console.log(`   ❌ 제외: ${reasons.join(', ')}`);
          }
        }
      });
    }
    
  } catch (error) {
    console.warn('90도 문 감지 실패:', error.message);
  }
  
  return doors;
};

/**
 * ARC 엔티티 분석 (문 호 패턴 찾기)
 */
const analyzeArcEntities = (helper) => {
  console.log('\n=== ARC 엔티티 분석 ===');
  
  let arcCount = 0;
  const arcTypes = {};
  const angleGroups = { '90도근처': 0, '기타': 0 };
  
  try {
    if (helper.denormalised) {
      helper.denormalised.forEach((entity, index) => {
        if (entity.type === 'ARC') {
          arcCount++;
          
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
};

/**
 * 텍스트 엔티티 분석 및 방 이름 감지 (개선된 버전)
 */
const analyzeTextEntities = (helper) => {
  console.log('\n=== 상세 텍스트 엔티티 분석 (방 이름 찾기) ===');
  
  const roomKeywords = ['부엌', '주방', 'kitchen', 'WC', '화장실', '욕실', 'toilet', 'bath', 
                       '거실', 'living', '침실', 'bedroom', '방', 'room', '현관', 'entrance',
                       'laundry', '세탁', 'balcony', '발코니', 'master', '안방'];
  const foundTexts = [];
  
  // 전체 엔티티 타입 분석
  const entityTypes = {};
  let totalEntities = 0;
  
  try {
    if (helper.denormalised) {
      console.log(`\n전체 정규화된 엔티티 개수: ${helper.denormalised.length}`);
      
      helper.denormalised.forEach((entity, index) => {
        totalEntities++;
        const entityType = entity.type || 'UNKNOWN';
        
        // 엔티티 타입별 카운트
        if (!entityTypes[entityType]) {
          entityTypes[entityType] = 0;
        }
        entityTypes[entityType]++;
        
        // 텍스트 관련 엔티티들 체크 (더 포괄적으로)
        if (entityType === 'TEXT' || entityType === 'MTEXT' || entityType === 'ATTDEF' || entityType === 'ATTRIB') {
          console.log(`\n🔍 텍스트 엔티티 발견 [${index}]:`);
          console.log(`   타입: ${entityType}`);
          console.log(`   전체 속성:`, Object.keys(entity));
          
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
            const text = foundText.toLowerCase();
            const isRoomName = roomKeywords.some(keyword => 
              text.includes(keyword.toLowerCase())
            );
            
            // 좌표 정보 추출 (MTEXT의 경우 더 상세한 분석)
            console.log(`   좌표 관련 속성들:`, {
              x: entity.x,
              y: entity.y, 
              z: entity.z,
              position: entity.position,
              startPoint: entity.startPoint,
              insertionPoint: entity.insertionPoint,
              transforms: entity.transforms
            });
            
            // transforms 배열에서 좌표 찾기
            let actualPosition = { x: 0, y: 0 };
            
            if (entity.transforms && Array.isArray(entity.transforms) && entity.transforms.length > 0) {
              // 첫 번째 transform에서 좌표 가져오기
              const transform = entity.transforms[0];
              if (transform && typeof transform === 'object') {
                actualPosition.x = transform.x || transform.transformX || transform.translateX || 0;
                actualPosition.y = transform.y || transform.transformY || transform.translateY || 0;
                console.log(`   Transform 좌표: x=${actualPosition.x}, y=${actualPosition.y}`);
              }
            }
            
            // 기본 좌표가 0,0이 아니면 우선 사용
            if (entity.x !== undefined && entity.y !== undefined && (entity.x !== 1 || entity.y !== 0)) {
              actualPosition.x = entity.x;
              actualPosition.y = entity.y;
              console.log(`   직접 좌표: x=${actualPosition.x}, y=${actualPosition.y}`);
            }
            
            foundTexts.push({
              text: foundText,
              position: actualPosition,
              layer: entity.layer || '기본',
              isRoomCandidate: isRoomName,
              entityType: entityType,
              index: index,
              rawEntity: entity // 디버깅용
            });
            
            console.log(`   최종 위치: x=${actualPosition.x?.toFixed?.(0) || actualPosition.x || 'N/A'}, y=${actualPosition.y?.toFixed?.(0) || actualPosition.y || 'N/A'}`);
            console.log(`   레이어: ${entity.layer || '기본'}`);
            console.log(`   방 이름 후보: ${isRoomName ? '✅ YES' : '❌ NO'}`);
          } else {
            console.log(`   ⚠️ 텍스트 내용을 찾을 수 없음`);
          }
        }
        
        // INSERT 엔티티 내부의 텍스트도 확인
        if (entityType === 'INSERT' && entity.attributes) {
          console.log(`\n🔍 INSERT 엔티티의 속성들 [${index}]:`);
          entity.attributes.forEach((attr, attrIndex) => {
            if (attr.text || attr.value) {
              const text = attr.text || attr.value;
              console.log(`   속성 텍스트 [${attrIndex}]: "${text}"`);
              
              if (text && typeof text === 'string' && text.trim()) {
                const isRoomName = roomKeywords.some(keyword => 
                  text.toLowerCase().includes(keyword.toLowerCase())
                );
                
                foundTexts.push({
                  text: text.trim(),
                  position: entity.position || entity.startPoint || { x: 0, y: 0 },
                  layer: entity.layer || '기본',
                  isRoomCandidate: isRoomName,
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
    
    // 원본 parsed 데이터도 확인
    if (helper.parsed && helper.parsed.entities) {
      console.log(`\n원본 파싱된 엔티티 개수: ${helper.parsed.entities.length}`);
      
      // 원본에서 텍스트 엔티티 찾기
      helper.parsed.entities.forEach((entity, index) => {
        if (entity.type === 'TEXT' || entity.type === 'MTEXT') {
          console.log(`\n🔍 원본 텍스트 엔티티 [${index}]:`);
          console.log(`   타입: ${entity.type}`);
          console.log(`   속성들:`, Object.keys(entity));
          
          if (entity.text) {
            console.log(`   텍스트: "${entity.text}"`);
          }
        }
      });
    }
    
    console.log(`\n📝 총 발견된 텍스트: ${foundTexts.length}개`);
    console.log(`🏠 방 이름 후보: ${foundTexts.filter(t => t.isRoomCandidate).length}개`);
    
    if (foundTexts.length > 0) {
      console.log('\n발견된 텍스트 목록:');
      foundTexts.forEach((text, index) => {
        console.log(`   [${index + 1}] "${text.text}" (${text.entityType}) ${text.isRoomCandidate ? '🏠' : ''}`);
      });
    }
    
  } catch (error) {
    console.warn('텍스트 분석 실패:', error.message);
  }
  
  return foundTexts;
};

/**
 * 방 이름 텍스트를 SVG에 추가 (스마트 배치)
 */
const addRoomLabels = (svgContent, helper) => {
  try {
    const roomTexts = analyzeTextEntities(helper);
    
    if (roomTexts.length === 0) {
      console.log('추가할 방 라벨이 없음');
      return svgContent;
    }
    
    console.log(`${roomTexts.length}개의 방 라벨 추가 중... (스마트 배치)`);
    
    // 현재 viewBox에서 도면 크기 계산
    const viewBoxMatch = svgContent.match(/viewBox="([^"]+)"/);
    let centerX = 0, centerY = 0, width = 1000, height = 1000;
    
    if (viewBoxMatch) {
      const [x, y, w, h] = viewBoxMatch[1].split(' ').map(Number);
      centerX = x + w / 2;
      centerY = y + h / 2;
      width = w;
      height = h;
      console.log(`도면 영역: ${width.toFixed(0)} x ${height.toFixed(0)}, 중심: (${centerX.toFixed(0)}, ${centerY.toFixed(0)})`);
    }
    
    // SVG 닫는 태그 찾기
    const svgEndIndex = svgContent.lastIndexOf('</svg>');
    if (svgEndIndex === -1) {
      return svgContent;
    }
    
    // 방 이름별 스마트 배치
    let roomLabelsHtml = '\n  <!-- 방 이름 라벨 (스마트 배치) -->\n';
    const roomPositions = calculateRoomPositions(roomTexts, centerX, centerY, width, height);
    
    roomTexts.forEach((roomText, index) => {
      if (roomText.isRoomCandidate) {
        const pos = roomPositions[index] || { x: centerX, y: centerY };
        const cleanText = roomText.text.replace(/\\pxqc;/g, '').replace(/\\P/g, ' ').trim();
        
        roomLabelsHtml += `  <text class="room-label room-name" x="${pos.x}" y="${pos.y}">${cleanText}</text>\n`;
        console.log(`   "${cleanText}" → (${pos.x.toFixed(0)}, ${pos.y.toFixed(0)})`);
      }
    });
    
    // 스타일 추가
    const styleInsert = `  <style>
    .room-label { 
      font-family: Arial, sans-serif;
      font-size: ${Math.min(width, height) * 0.03}px;
      fill: #333333;
      text-anchor: middle;
      dominant-baseline: middle;
      pointer-events: none;
    }
    .room-name {
      font-weight: bold;
      font-size: ${Math.min(width, height) * 0.04}px;
      fill: #000080;
      text-shadow: 1px 1px 2px rgba(255,255,255,0.8);
    }
  </style>\n`;
    
    // 첫 번째 <g> 태그나 적절한 위치 찾기
    const firstGroupIndex = svgContent.indexOf('<g');
    if (firstGroupIndex !== -1) {
      svgContent = svgContent.slice(0, firstGroupIndex) + styleInsert + svgContent.slice(firstGroupIndex);
    }
    
    // 방 라벨을 SVG 끝 부분에 추가
    svgContent = svgContent.slice(0, svgEndIndex) + roomLabelsHtml + svgContent.slice(svgEndIndex);
    
    return svgContent;
    
  } catch (error) {
    console.warn('방 라벨 추가 실패:', error.message);
    return svgContent;
  }
};

/**
 * 방 이름별 최적 위치 계산
 */
const calculateRoomPositions = (roomTexts, centerX, centerY, width, height) => {
  const positions = [];
  const roomNames = roomTexts.filter(t => t.isRoomCandidate);
  
  // 방별 위치 매핑 (일반적인 아파트 레이아웃 기준)
  const roomLayoutMap = {
    'KITCHEN': { x: centerX - width * 0.2, y: centerY - height * 0.1 },
    'LIVING': { x: centerX + width * 0.1, y: centerY },
    'MASTER BEDROOM': { x: centerX + width * 0.2, y: centerY - height * 0.2 },
    'BEDROOM 1': { x: centerX - width * 0.2, y: centerY - height * 0.3 },
    'BEDROOM 2': { x: centerX + width * 0.2, y: centerY + height * 0.2 },
    'WC 1': { x: centerX - width * 0.1, y: centerY + height * 0.1 },
    'WC 2': { x: centerX + width * 0.3, y: centerY - height * 0.1 },
    'LAUNDRY': { x: centerX - width * 0.3, y: centerY + height * 0.2 },
    'BALCONY': { x: centerX, y: centerY + height * 0.3 }
  };
  
  roomTexts.forEach((roomText, index) => {
    if (roomText.isRoomCandidate) {
      const cleanName = roomText.text.replace(/\\pxqc;/g, '').replace(/\\P/g, ' ').trim();
      const mappedPos = roomLayoutMap[cleanName];
      
      if (mappedPos) {
        positions[index] = mappedPos;
      } else {
        // 기본 위치 (격자 배치)
        const gridIndex = positions.filter(p => p).length;
        const cols = 3;
        const row = Math.floor(gridIndex / cols);
        const col = gridIndex % cols;
        
        positions[index] = {
          x: centerX + (col - 1) * width * 0.25,
          y: centerY + (row - 1) * height * 0.2
        };
      }
    }
  });
  
  return positions;
};

module.exports = {
  processCompleteDxfFile,
  processDwgFile: processCompleteDxfFile, // 컨트롤러 호환성을 위한 별칭
  
  // 개별 함수들도 export (테스트/디버깅용)
  convertDwgToDxf,
  changeWallColors,
  add90DegreeDoorMarkers,
  detect90DegreeDoors,
  analyzeArcEntities,
  analyzeTextEntities,
  addRoomLabels,
  calculateRoomPositions
}; 