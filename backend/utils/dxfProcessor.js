/**
 * DWG 파일 처리 모듈
 * ODAFileConverter를 활용한 DWG -> DXF 변환 및 도면 추출
 */
const fs = require('fs');
const path = require('path');
const { execSync, exec } = require('child_process');
const { promisify } = require('util');
const execPromise = promisify(exec);
const DxfParser = require('dxf-parser');
const { parseString } = require('@dxfjs/parser');
const os = require('os');

/**
 * DWG 파일 처리 메인 함수
 */
const processDwgFile = async (jobId, filename, filePath, progressCallback) => {
  try {
    progressCallback(0, 'DWG 파일 처리 시작...');
    
    if (!fs.existsSync(filePath)) {
      throw new Error('DWG 파일을 찾을 수 없습니다');
    }
    
    const fileSize = fs.statSync(filePath).size;
    console.log(`DWG 파일 크기: ${fileSize} bytes`);
    console.log(`파일명: ${filename}, 파일 경로: ${filePath}`);
    
    // 파일 헤더 확인
    progressCallback(10, 'DWG 파일 검증 중...');
    const dwgHeader = await readDwgHeader(filePath);
    
    // AC 시그니처 확인 (DWG 파일 검증)
    if (!dwgHeader.signature.startsWith('AC')) {
      throw new Error(`유효하지 않은 DWG 파일 시그니처: ${dwgHeader.signature}`);
    }
    
    console.log(`DWG 시그니처: ${dwgHeader.signature}, 버전: ${dwgHeader.version}`);
    progressCallback(20, `DWG 파일 검증됨: ${dwgHeader.signature} (${dwgHeader.version})`);
    
    // SVG 파일 경로 설정
    const svgFileName = `${jobId}.svg`;
    const svgFilePath = path.join(__dirname, '..', 'results', svgFileName);
    
    // 임시 DXF 경로 설정
    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const dxfFilePath = path.join(tempDir, `${jobId}.dxf`);
    
    // DWG -> DXF 변환 (ODAFileConverter 사용)
    progressCallback(30, 'DWG 파일을 DXF로 변환 중...');
    const dxfPath = await convertDwgToDxf(filePath, dxfFilePath);
    
    if (!dxfPath || !fs.existsSync(dxfPath)) {
      throw new Error('DWG에서 DXF로 변환에 실패했습니다');
    }
    
    progressCallback(50, 'DXF 파일 분석 중...');
    
    // DXF 파일 파싱하여 엔티티 추출
    const entities = await parseDxfFile(dxfPath);
    
    if (!entities || entities.length === 0) {
      throw new Error('DXF 파일에서 도면 엔티티를 추출할 수 없습니다');
    }
    
    console.log(`추출된 엔티티: ${entities.length}개`);
    
    // 엔티티 통계 (서비스용)
    const entityTypes = {};
    const layerStats = {};
    
    entities.forEach(entity => {
      entityTypes[entity.type] = (entityTypes[entity.type] || 0) + 1;
      layerStats[entity.layer] = (layerStats[entity.layer] || 0) + 1;
    });
    
    // 주요 레이어 식별 (엔티티가 많은 상위 5개 레이어)
    const majorLayers = Object.entries(layerStats)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([layer, count]) => ({ layer, count }));
    
    console.log(`도면 분석 완료: ${entities.length}개 엔티티, ${Object.keys(layerStats).length}개 레이어`);
    
    progressCallback(70, `도면 분석: ${entities.length}개 요소`);
    
    // SVG 생성
    await generateSvg(entities, svgFilePath);
    progressCallback(90, 'SVG 도면 생성 완료');
    
    // 문 감지 비활성화 (사용자에게는 순수한 도면만 표시)
    const doors = [];
    progressCallback(100, 'DWG 파일 분석 완료');
    
    // 임시 파일 정리
    try {
      if (fs.existsSync(dxfPath)) {
        fs.unlinkSync(dxfPath);
      }
    } catch (cleanError) {
      console.error('임시 파일 정리 오류:', cleanError);
    }
    
    // 결과 반환
    return {
      jobId,
      doors,
      svgFile: svgFilePath,
      entityCount: entities.length,
      success: true
    };
    
  } catch (error) {
    console.error(`DWG 처리 오류: ${error.message}`);
    throw error;
  }
};

/**
 * DWG 파일 헤더 읽기
 */
const readDwgHeader = async (filePath) => {
  return new Promise((resolve, reject) => {
    try {
      // 파일의 첫 1024바이트를 읽어 헤더 파싱
      const headerBuffer = Buffer.alloc(1024);
      const fd = fs.openSync(filePath, 'r');
      fs.readSync(fd, headerBuffer, 0, 1024, 0);
      fs.closeSync(fd);
      
      // 시그니처 추출 (첫 6바이트)
      const signature = headerBuffer.toString('ascii', 0, 6);
      
      // 버전 정보 추출 시도
      let version = 'Unknown';
      if (signature === 'AC1027') version = 'AutoCAD 2013/2014/2015/2016/2017/2018';
      else if (signature === 'AC1024') version = 'AutoCAD 2010/2011/2012';
      else if (signature === 'AC1021') version = 'AutoCAD 2007/2008/2009';
      else if (signature === 'AC1018') version = 'AutoCAD 2004/2005/2006';
      else if (signature === 'AC1015') version = 'AutoCAD 2000/2000i/2002';
      else if (signature === 'AC1014') version = 'AutoCAD 14/14.01';
      else if (signature === 'AC1012') version = 'AutoCAD 13/13c3/13c4';
      else if (signature.startsWith('AC')) version = 'AutoCAD (기타 버전)';
      
      // 파일 크기
      const fileSize = fs.statSync(filePath).size;
      
      // 헤더 정보 객체 반환
      resolve({
        signature,
        version,
        fileSize
      });
    } catch (error) {
      console.error('DWG 헤더 분석 오류:', error.message);
      reject(error);
    }
  });
};

/**
 * ODA File Converter를 사용하여 DWG에서 DXF로 변환
 */
const convertDwgToDxf = async (dwgFilePath, dxfFilePath) => {
  try {
    console.log(`DWG -> DXF 변환 시도: ${dwgFilePath} -> ${dxfFilePath}`);
    
    // 출력 디렉토리 확인
    const outputDir = path.dirname(dxfFilePath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // ODAFileConverter 경로 찾기
    const odaConverterPath = findOdaConverter();
    
    if (!odaConverterPath) {
      throw new Error('ODAFileConverter를 찾을 수 없습니다. 설치 후 다시 시도하세요.');
    }
    
    console.log(`ODAFileConverter 발견: ${odaConverterPath}`);
    
    // 입출력 경로
    const inputDir = path.dirname(dwgFilePath);
    const outputDirPath = path.dirname(dxfFilePath);
    
    // ODAFileConverter 명령 구성 - 올바른 형식 사용
    // 형식: ODAFileConverter "input_folder" "output_folder" "output_version" "output_file_type" "recurse" "audit" ["input_filter"]
    const command = `"${odaConverterPath}" "${inputDir}" "${outputDirPath}" "ACAD2018" "DXF" "0" "1"`;
    
    console.log(`실행 명령: ${command}`);
    
    // 타임아웃 설정 (60초)
    const timeoutMs = 60000;
    
    // ODAFileConverter 실행
    const { stdout, stderr } = await execPromise(command, { timeout: timeoutMs });
    
    console.log('ODAFileConverter 실행 완료');
    
    if (stderr && stderr.length > 0) {
      console.error('ODAFileConverter stderr:', stderr);
      // stderr가 있어도 성공적으로 변환될 수 있으므로 바로 오류 처리하지 않음
    }
    
    if (stdout && stdout.length > 0) {
      console.log('ODAFileConverter stdout:', stdout);
    }
    
    // 잠시 대기 (파일 시스템 동기화)
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 출력 파일 경로 재계산 (ODAFileConverter는 원본 파일명을 유지하되 확장자만 변경)
    const originalBaseName = path.basename(dwgFilePath, '.dwg');
    const expectedDxfPath = path.join(outputDirPath, `${originalBaseName}.dxf`);
    
    // 원래 요청된 경로와 실제 생성된 경로가 다르면 이동
    if (expectedDxfPath !== dxfFilePath && fs.existsSync(expectedDxfPath)) {
      console.log(`파일 이동: ${expectedDxfPath} -> ${dxfFilePath}`);
      fs.renameSync(expectedDxfPath, dxfFilePath);
    }
    
    // 결과 파일 확인
    if (fs.existsSync(dxfFilePath)) {
      console.log('DXF 파일 생성 성공:', dxfFilePath);
      return dxfFilePath;
    } else {
      // 대안 경로들 확인
      const alternativePaths = [
        expectedDxfPath,
        path.join(outputDirPath, `${originalBaseName}.DXF`),
        path.join(outputDirPath, `${path.basename(dwgFilePath, '.dwg')}.dxf`)
      ];
      
      for (const altPath of alternativePaths) {
        if (fs.existsSync(altPath)) {
          console.log(`대안 경로에서 DXF 파일 발견: ${altPath}`);
          if (altPath !== dxfFilePath) {
            fs.renameSync(altPath, dxfFilePath);
          }
          return dxfFilePath;
        }
      }
      
      throw new Error('DXF 파일이 생성되지 않았습니다');
    }
  } catch (error) {
    console.error(`DWG -> DXF 변환 오류: ${error.message}`);
    
    // 타임아웃 오류인 경우 더 자세한 메시지 제공
    if (error.message.includes('timeout')) {
      throw new Error('DWG 파일 변환이 시간 초과되었습니다. 파일이 너무 크거나 복잡할 수 있습니다.');
    }
    
    throw error;
  }
};

/**
 * ODAFileConverter 실행 파일 경로 찾기
 */
const findOdaConverter = () => {
  try {
    // Windows에서 일반적인 설치 경로
    const commonPaths = [
      'C:\\Program Files\\ODA\\ODAFileConverter 26.4.0\\ODAFileConverter.exe',
      'C:\\Program Files (x86)\\ODA\\ODAFileConverter\\ODAFileConverter.exe'
    ];
    
    // 환경 변수에 설정된 경로 확인
    if (process.env.ODA_CONVERTER_PATH) {
      const envPath = process.env.ODA_CONVERTER_PATH;
      if (fs.existsSync(envPath)) {
        return envPath;
      }
    }
    
    // 일반적인 설치 경로 확인
    for (const path of commonPaths) {
      if (fs.existsSync(path)) {
        return path;
      }
    }
    
    console.error('ODAFileConverter를 찾을 수 없습니다');
    return null;
  } catch (error) {
    console.error('ODAFileConverter 검색 오류:', error.message);
    return null;
  }
};

/**
 * DXF 파일 파싱
 */
const parseDxfFile = async (dxfFilePath) => {
  try {
    console.log(`DXF 파일 파싱 시작: ${dxfFilePath}`);
    
    if (!fs.existsSync(dxfFilePath)) {
      throw new Error(`DXF 파일을 찾을 수 없습니다: ${dxfFilePath}`);
    }
    
    // 파일 크기 확인
    const fileStats = fs.statSync(dxfFilePath);
    if (fileStats.size === 0) {
      throw new Error('DXF 파일이 비어있습니다');
    }
    
    // DXF 파일 내용 읽기
    const dxfContent = fs.readFileSync(dxfFilePath, 'utf8');
    
    // DXF 파일 시작 확인
    if (!dxfContent.includes('SECTION') || !dxfContent.includes('ENTITIES')) {
      throw new Error('유효하지 않은 DXF 파일 형식입니다');
    }
    
    // DXF 파서 생성 및 파싱
    const parser = new DxfParser();
    const dxf = parser.parseSync(dxfContent);
    
    // 엔티티 추출
    const entities = [];
    const entityStats = {}; // 엔티티 타입별 통계
    
    if (dxf.entities && Array.isArray(dxf.entities)) {
      console.log(`DXF 엔티티 발견: ${dxf.entities.length}개`);
      
      // 각 엔티티 처리
      dxf.entities.forEach(entity => {
        try {
          // 통계 업데이트
          entityStats[entity.type] = (entityStats[entity.type] || 0) + 1;
          
          switch (entity.type) {
            case 'LINE':
              entities.push({
                type: 'LINE',
                layer: entity.layer || 'default',
                color: entity.color || 7,
                start: { 
                  x: entity.vertices?.[0]?.x || entity.startPoint?.x || 0, 
                  y: entity.vertices?.[0]?.y || entity.startPoint?.y || 0 
                },
                end: { 
                  x: entity.vertices?.[1]?.x || entity.endPoint?.x || 0, 
                  y: entity.vertices?.[1]?.y || entity.endPoint?.y || 0 
                }
              });
              break;
              
            case 'LWPOLYLINE':
            case 'POLYLINE':
              if (entity.vertices && entity.vertices.length > 0) {
                entities.push({
                  type: 'POLYLINE',
                  layer: entity.layer || 'default',
                  color: entity.color || 7,
                  closed: entity.shape === true || entity.closed === true,
                  vertices: entity.vertices.map(v => ({ x: v.x || 0, y: v.y || 0 }))
                });
              }
              break;
              
            case 'CIRCLE':
              entities.push({
                type: 'CIRCLE',
                layer: entity.layer || 'default',
                color: entity.color || 7,
                center: { x: entity.center?.x || 0, y: entity.center?.y || 0 },
                radius: entity.radius || 0
              });
              break;
              
            case 'ARC':
              entities.push({
                type: 'ARC',
                layer: entity.layer || 'default',
                color: entity.color || 7,
                center: { x: entity.center?.x || 0, y: entity.center?.y || 0 },
                radius: entity.radius || 0,
                startAngle: entity.startAngle || 0,
                endAngle: entity.endAngle || 0
              });
              break;
              
            case 'TEXT':
            case 'MTEXT':
              entities.push({
                type: 'TEXT',
                layer: entity.layer || 'default',
                color: entity.color || 7,
                text: entity.text || '',
                position: { x: entity.position?.x || 0, y: entity.position?.y || 0 },
                height: entity.height || 12
              });
              break;
          }
        } catch (entityError) {
          // 엔티티 변환 오류는 조용히 건너뛰기
        }
      });
      
      // 엔티티 타입별 통계 출력
      console.log('DXF 엔티티 타입별 통계:');
      Object.entries(entityStats).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}개`);
      });
      console.log(`변환된 엔티티: ${entities.length}개`);
    }
    
    // 블록 참조 처리 (INSERT) - 공간명 표시용
    if (dxf.blocks && dxf.entities) {
      const blockInserts = dxf.entities.filter(e => e.type === 'INSERT');
      
      blockInserts.forEach(insert => {
        try {
          const blockName = insert.name;
          const block = dxf.blocks[blockName];
          
          if (block && block.entities) {
            // 블록 엔티티 변환 및 추가
            block.entities.forEach(blockEntity => {
              // INSERT 위치 기반 변환
              const transformedEntity = transformBlockEntity(blockEntity, insert);
              if (transformedEntity) {
                entities.push(transformedEntity);
              }
            });
          }
          
          // 블록 이름이 공간명인 경우 텍스트로 추가
          if (insert.position && isRoomName(blockName)) {
            entities.push({
              type: 'TEXT',
              layer: insert.layer || 'ROOM_LABELS',
              color: 0,
              text: blockName,
              position: { x: insert.position.x || 0, y: insert.position.y || 0 },
              height: 20
            });
          }
        } catch (blockError) {
          // 블록 처리 오류는 조용히 건너뛰기
        }
      });
    }
    
    return entities;
  } catch (error) {
    console.error(`DXF 파싱 오류: ${error.message}`);
    throw error;
  }
};

/**
 * 블록 엔티티 변환
 */
const transformBlockEntity = (entity, insert) => {
  try {
    const insertPoint = insert.position || { x: 0, y: 0 };
    const scale = insert.scale || { x: 1, y: 1 };
    const rotation = insert.rotation || 0;
    
    // 변환된 엔티티의 기본 속성
    const transformed = {
      type: entity.type,
      layer: entity.layer || insert.layer || 'default',
      color: entity.color !== 0 ? entity.color : insert.color || 7  // 0은 BYLAYER
    };
    
    // 좌표 변환 함수
    const transformPoint = (point) => {
      if (!point) return { x: 0, y: 0 };
      
      // 스케일 적용
      const scaled = {
        x: point.x * scale.x,
        y: point.y * scale.y
      };
      
      // 회전 적용 (라디안으로 변환)
      const rotRad = rotation * Math.PI / 180;
      const rotated = {
        x: scaled.x * Math.cos(rotRad) - scaled.y * Math.sin(rotRad),
        y: scaled.x * Math.sin(rotRad) + scaled.y * Math.cos(rotRad)
      };
      
      // 위치 이동
      return {
        x: rotated.x + insertPoint.x,
        y: rotated.y + insertPoint.y
      };
    };
    
    // 엔티티 유형별 변환
    switch (entity.type) {
      case 'LINE':
        transformed.start = transformPoint(entity.vertices?.[0] || entity.startPoint);
        transformed.end = transformPoint(entity.vertices?.[1] || entity.endPoint);
        break;
        
      case 'LWPOLYLINE':
      case 'POLYLINE':
        if (entity.vertices && entity.vertices.length > 0) {
          transformed.closed = entity.shape === true || entity.closed === true;
          transformed.vertices = entity.vertices.map(v => transformPoint(v));
        }
        break;
        
      case 'CIRCLE':
        transformed.center = transformPoint(entity.center);
        transformed.radius = entity.radius * Math.max(scale.x, scale.y);
        break;
        
      case 'ARC':
        transformed.center = transformPoint(entity.center);
        transformed.radius = entity.radius * Math.max(scale.x, scale.y);
        transformed.startAngle = entity.startAngle + rotation;
        transformed.endAngle = entity.endAngle + rotation;
        break;
        
      case 'TEXT':
      case 'MTEXT':
        transformed.position = transformPoint(entity.position);
        transformed.text = entity.text || '';
        transformed.height = (entity.height || 12) * Math.max(scale.x, scale.y);
        transformed.rotation = (entity.rotation || 0) + rotation;
        break;
        
      default:
        return null;  // 지원되지 않는 엔티티 유형
    }
    
    return transformed;
  } catch (error) {
    console.error('블록 엔티티 변환 오류:', error.message);
    return null;
  }
};

/**
 * 문(도어) 감지 함수
 */
const findDoors = (entities) => {
  const doors = [];
  
  // DOOR 레이어에서 엔티티 검색
  entities.forEach((entity, index) => {
    const layer = entity.layer ? entity.layer.toUpperCase() : '';
    const isDoorLayer = layer === 'DOOR' || layer.includes('DOOR');
    
    if (isDoorLayer) {
      if (entity.type === 'LINE') {
        doors.push({
          id: doors.length,
          type: 'door',
          layer: entity.layer,
          position: {
            x: Math.min(entity.start.x, entity.end.x),
            y: Math.min(entity.start.y, entity.end.y)
          },
          width: Math.abs(entity.end.x - entity.start.x) || 20,
          height: Math.abs(entity.end.y - entity.start.y) || 20
        });
      } else if ((entity.type === 'POLYLINE' || entity.type === 'LWPOLYLINE') && entity.vertices && entity.vertices.length >= 2) {
        // 폴리라인의 경계 상자 계산
        const xValues = entity.vertices.map(v => v.x || 0);
        const yValues = entity.vertices.map(v => v.y || 0);
        const minX = Math.min(...xValues);
        const minY = Math.min(...yValues);
        const maxX = Math.max(...xValues);
        const maxY = Math.max(...yValues);
        
        doors.push({
          id: doors.length,
          type: 'door',
          layer: entity.layer,
          position: { x: minX, y: minY },
          width: maxX - minX || 20,
          height: maxY - minY || 20
        });
      }
    } else if (entity.type === 'INSERT' && entity.name && 
              (entity.name.toUpperCase().includes('DOOR') || 
               entity.name.toUpperCase().includes('DR'))) {
      // 도어 블록 처리
      const pos = entity.position || { x: 0, y: 0 };
      const scale = entity.scale || { x: 1, y: 1 };
      
      doors.push({
        id: doors.length,
        type: 'door',
        layer: entity.layer || 'DOOR',
        position: { x: pos.x, y: pos.y },
        width: 30 * scale.x,  // 기본 문 크기 추정
        height: 10 * scale.y
      });
    }
  });
  
  return doors;
};

/**
 * RGB 색상을 16진수 형식으로 변환
 */
const rgbToHex = (r, g, b) => {
  return '#' + [r, g, b].map(x => {
    const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
};

/**
 * ACI 색상 인덱스를 RGB로 변환 (AutoCAD 색상 인덱스)
 */
const aciToRgb = (colorIndex) => {
  // AutoCAD 색상 테이블 (주요 색상만 포함)
  const aciColors = {
    1: [255, 0, 0],     // 빨강
    2: [255, 255, 0],   // 노랑
    3: [0, 255, 0],     // 초록
    4: [0, 255, 255],   // 청록
    5: [0, 0, 255],     // 파랑
    6: [255, 0, 255],   // 마젠타
    7: [255, 255, 255], // 흰색
    8: [128, 128, 128], // 회색
    9: [192, 192, 192]  // 밝은 회색
  };
  
  if (colorIndex === 0 || colorIndex === 256) {
    return '#000000'; // BYBLOCK 또는 BYLAYER
  }
  
  if (aciColors[colorIndex]) {
    return rgbToHex(...aciColors[colorIndex]);
  }
  
  // 기본 검정
  return '#000000';
};

/**
 * SVG 생성 함수
 */
const generateSvg = async (entities, filePath) => {
  try {
    // 엔티티가 없으면 오류 발생
    if (!entities || entities.length === 0) {
      throw new Error('SVG를 생성할 엔티티가 없습니다');
    }
    
    // 뷰포트 계산 - 개선된 방법 사용
    const tightBounds = calculateTightBounds(entities);
    
    if (!tightBounds) {
      throw new Error('유효한 도면 범위를 계산할 수 없습니다');
    }
    
    console.log(`tightBounds 계산 결과:`, tightBounds);
    
    let minX = tightBounds.minX;
    let minY = tightBounds.minY;
    let maxX = tightBounds.maxX;
    let maxY = tightBounds.maxY;
    
    console.log(`padding 적용 전: minX=${minX.toFixed(2)}, minY=${minY.toFixed(2)}, maxX=${maxX.toFixed(2)}, maxY=${maxY.toFixed(2)}`);
    
    // 여백 추가 (더 크게)
    const padding = Math.max((maxX - minX) * 0.1, (maxY - minY) * 0.1, 50);
    console.log(`계산된 padding: ${padding.toFixed(2)}`);
    
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;
    
    const width = maxX - minX;
    const height = maxY - minY;
    
    console.log(`padding 적용 후: minX=${minX.toFixed(2)}, minY=${minY.toFixed(2)}, maxX=${maxX.toFixed(2)}, maxY=${maxY.toFixed(2)}`);
    console.log(`최종 viewBox: "${minX} ${-maxY} ${width} ${height}"`);
    console.log(`도면 범위: (${minX}, ${minY}) - (${maxX}, ${maxY}), 크기: ${width} x ${height}`);
    
    // SVG 생성 (Y축 반전 적용)
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" 
                viewBox="${minX} ${-maxY} ${width} ${height}" preserveAspectRatio="xMidYMid meet">
<style>
  * { stroke-width: 1.0; fill: none; stroke: #111; vector-effect: non-scaling-stroke; }
  .background { fill: #fff; stroke: none; }
  .layer-0 { stroke: #111; stroke-width: 1.0; }
  .layer-wall { stroke: #000; stroke-width: 2.0; }
  .layer-door { stroke: #333; stroke-width: 1.5; }
  .layer-window { stroke: #555; stroke-width: 1.0; }
</style>
<g transform="scale(1, -1)">
<rect class="background" x="${minX}" y="${minY}" width="${width}" height="${height}" />
`;
    
    // 엔티티 그리기
    entities.forEach(entity => {
      try {
        // 기본 색상은 검은색, 레이어에 따라 다른 색상 적용
        let strokeColor = '#111111';
        let strokeWidth = '1.0';
        
        // 레이어별 색상 설정
        if (entity.layer) {
          const layer = entity.layer.toLowerCase();
          if (layer.includes('wall') || layer.includes('벽')) {
            strokeColor = '#000000';
            strokeWidth = '2.0';
          } else if (layer.includes('door') || layer.includes('문')) {
            strokeColor = '#333333';
            strokeWidth = '1.5';
          } else if (layer.includes('window') || layer.includes('창')) {
            strokeColor = '#555555';
            strokeWidth = '1.0';
          }
        }
        
        const layerClass = entity.layer ? ` class="layer-${entity.layer.replace(/[^a-zA-Z0-9]/g, '')}"` : '';
        const strokeStyle = ` stroke="${strokeColor}" stroke-width="${strokeWidth}"`;
        
        switch (entity.type) {
          case 'LINE':
            if (entity.start && entity.end) {
              svg += `<line x1="${entity.start.x || 0}" y1="${entity.start.y || 0}" 
                     x2="${entity.end.x || 0}" y2="${entity.end.y || 0}"${layerClass}${strokeStyle} />\n`;
            }
            break;
          
          case 'POLYLINE':
          case 'LWPOLYLINE':
            if (entity.vertices && entity.vertices.length > 0) {
              // 유효하지 않은 좌표 필터링
              const validVertices = entity.vertices.filter(v => v && (v.x !== undefined && v.y !== undefined));
              
              if (validVertices.length > 0) {
                let points = validVertices.map(v => `${v.x || 0},${v.y || 0}`).join(' ');
                if (entity.closed) {
                  svg += `<polygon points="${points}"${layerClass}${strokeStyle} />\n`;
                } else {
                  svg += `<polyline points="${points}"${layerClass}${strokeStyle} />\n`;
                }
              }
            }
            break;
          
          case 'CIRCLE':
            if (entity.center) {
              svg += `<circle cx="${entity.center.x || 0}" cy="${entity.center.y || 0}" 
                     r="${entity.radius || 0}"${layerClass}${strokeStyle} />\n`;
            }
            break;
          
          case 'ARC':
            if (entity.center && entity.radius) {
              // SVG path로 변환
              const startAngle = entity.startAngle || 0;
              const endAngle = entity.endAngle || 360;
              
              const startRad = startAngle * Math.PI / 180;
              const endRad = endAngle * Math.PI / 180;
              
              const start = {
                x: (entity.center.x || 0) + (entity.radius || 0) * Math.cos(startRad),
                y: (entity.center.y || 0) + (entity.radius || 0) * Math.sin(startRad)
              };
              
              const end = {
                x: (entity.center.x || 0) + (entity.radius || 0) * Math.cos(endRad),
                y: (entity.center.y || 0) + (entity.radius || 0) * Math.sin(endRad)
              };
              
              const largeArc = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;
              const sweep = endAngle > startAngle ? 1 : 0;
              
              svg += `<path d="M ${start.x} ${start.y} A ${entity.radius || 0} ${entity.radius || 0} 0 ${largeArc} ${sweep} ${end.x} ${end.y}"${layerClass}${strokeStyle} />\n`;
            }
            break;
          
          case 'TEXT':
          case 'MTEXT':
            if (entity.position && entity.text && entity.text.trim()) {
              const text = entity.text.trim();
              const isRoomLabel = isRoomName(text);
              
              // 모든 텍스트를 표시하되, 공간명은 더 크게
              let fontSize = '14';
              let fontWeight = '600';
              
              if (isRoomLabel) {
                fontSize = '18';
                fontWeight = '700';
                strokeColor = '#000000'; // 공간명은 검은색으로
              } else {
                strokeColor = '#333333'; // 일반 텍스트는 조금 연하게
              }
              
              const fillStyle = ` fill="${strokeColor}"`;
              // Y축 반전을 상쇄하기 위해 텍스트에 다시 반전 적용
              svg += `<text x="${entity.position.x || 0}" y="${entity.position.y || 0}" 
                     font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="${fontWeight}"
                     transform="scale(1, -1) translate(0, ${-2 * (entity.position.y || 0)})"${layerClass}${fillStyle}>${text}</text>\n`;
            }
            break;
        }
      } catch (err) {
        // 오류 무시하고 계속
      }
    });
    
    // SVG 닫기
    svg += '</g></svg>';
    
    // 저장 디렉토리 확인
    const resultsDir = path.dirname(filePath);
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    // 파일에 저장 (프로미스 사용)
    await fs.promises.writeFile(filePath, svg, 'utf8');
    console.log(`SVG 파일 저장 완료: ${filePath}`);
    
    return filePath;
  } catch (error) {
    console.error(`SVG 생성 오류: ${error.message}`);
    throw error;
  }
};

/**
 * 실제 엔티티가 있는 영역만 계산하는 함수
 */
const calculateTightBounds = (entities) => {
  if (!entities || entities.length === 0) {
    return null;
  }

  // 모든 엔티티의 좌표 수집
  const points = [];
  
  entities.forEach(entity => {
    try {
      switch (entity.type) {
        case 'LINE':
          if (entity.start && entity.end) {
            points.push(entity.start, entity.end);
          }
          break;
          
        case 'POLYLINE':
        case 'LWPOLYLINE':
          if (entity.vertices) {
            points.push(...entity.vertices);
          }
          break;
          
        case 'CIRCLE':
        case 'ARC':
          if (entity.center && entity.radius) {
            const r = entity.radius;
            points.push(
              { x: entity.center.x - r, y: entity.center.y - r },
              { x: entity.center.x + r, y: entity.center.y + r }
            );
          }
          break;
          
        case 'TEXT':
        case 'MTEXT':
          if (entity.position) {
            points.push(entity.position);
          }
          break;
      }
    } catch (err) {
      // 오류 무시하고 계속
    }
  });

  if (points.length === 0) {
    return null;
  }

  // 유효한 좌표만 필터링
  const validPoints = points.filter(p => p && 
    typeof p.x === 'number' && typeof p.y === 'number' &&
    isFinite(p.x) && isFinite(p.y)
  );

  if (validPoints.length === 0) {
    return null;
  }

  // 아웃라이어 제거를 위한 좌표별 정렬
  const xCoords = validPoints.map(p => p.x).sort((a, b) => a - b);
  const yCoords = validPoints.map(p => p.y).sort((a, b) => a - b);
  
  // 상위/하위 2%를 아웃라이어로 간주하여 제거
  const outlierPercent = 0.02;
  const xStart = Math.floor(xCoords.length * outlierPercent);
  const xEnd = Math.ceil(xCoords.length * (1 - outlierPercent));
  const yStart = Math.floor(yCoords.length * outlierPercent);
  const yEnd = Math.ceil(yCoords.length * (1 - outlierPercent));
  
  const minX = xCoords[xStart];
  const maxX = xCoords[xEnd - 1];
  const minY = yCoords[yStart];  
  const maxY = yCoords[yEnd - 1];

  // 결과가 유효한지 확인
  if (maxX - minX <= 0 || maxY - minY <= 0) {
    console.warn('아웃라이어 제거 후 유효하지 않은 범위, 전체 범위 사용');
    return {
      minX: Math.min(...xCoords),
      maxX: Math.max(...xCoords),
      minY: Math.min(...yCoords),
      maxY: Math.max(...yCoords)
    };
  }

  console.log(`아웃라이어 제거: ${validPoints.length}개 포인트 중 ${xCoords.length - (xEnd - xStart)}개 X 아웃라이어, ${yCoords.length - (yEnd - yStart)}개 Y 아웃라이어 제거`);
  console.log(`정제된 범위: X(${minX.toFixed(2)} ~ ${maxX.toFixed(2)}), Y(${minY.toFixed(2)} ~ ${maxY.toFixed(2)})`);

  return { minX, minY, maxX, maxY };
};

/**
 * 공간명인지 확인하는 함수 (더 포괄적으로)
 */
const isRoomName = (text) => {
  if (!text || typeof text !== 'string') return false;
  
  const roomKeywords = [
    // 한국어 공간명
    '화장실', '욕실', 'bathroom', 'toilet', 'wc',
    '침실', 'bedroom', 'bed room', 'br',
    '거실', 'living', 'living room', 'lr',
    '주방', '부엌', 'kitchen', 'k',
    '다이닝', 'dining', 'dining room', 'dr',
    '서재', '공부방', 'study', 'study room',
    '드레스룸', 'dress room', 'closet', 'walk-in',
    '발코니', 'balcony', 'veranda',
    '현관', 'entrance', 'entry', 'foyer',
    '팬트리', 'pantry',
    '세탁실', 'laundry', 'utility',
    '계단', 'stairs', 'stair',
    '복도', 'hall', 'corridor',
    '창고', 'storage', 'store',
    // 기타 공간
    'room', '실', '방'
  ];
  
  const lowerText = text.toLowerCase().trim();
  
  // 숫자나 기타 문자가 붙어있어도 매칭하도록 개선
  return roomKeywords.some(keyword => 
    lowerText.includes(keyword.toLowerCase())
  );
};

module.exports = {
  processDwgFile,
  parseDxfFile,
  generateSvg
}; 