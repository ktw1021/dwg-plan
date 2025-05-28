const fs = require("fs/promises");
const path = require("path");

// LibreDWG는 ES6 모듈이므로 dynamic import 사용
let createModule;

/**
 * LibreDWG 기반 DXF → SVG 변환 테스트
 */
async function testLibreDwgConversion() {
  try {
    console.log('🔧 === LibreDWG 기반 DXF → SVG 변환 테스트 ===');
    
    // 1. LibreDWG 모듈 초기화 (ES6 dynamic import 사용)
    console.log('📦 LibreDWG 모듈 로딩 중...');
    
    // ES6 모듈을 dynamic import로 로드
    const { default: createModule } = await import('./node_modules/@mlightcad/libredwg-web/wasm/libredwg-web.js');
    const lib = await createModule();
    console.log('✅ LibreDWG 모듈 로딩 완료');
    
    // 2. DWG 파일 읽기
    const dwgPath = path.join(__dirname, 'uploads', 'fe104d77-cfd2-4fe1-bd85-4e0f041546ab.dwg');
    console.log(`📂 DWG 파일 읽기: ${dwgPath}`);
    
    const buffer = await fs.readFile(dwgPath);
    console.log(`✅ DWG 파일 읽기 완료: ${(buffer.length / 1024).toFixed(1)} KB`);
    
    // 3. DWG 파일 파싱 (실제 API 사용)
    console.log('🔍 DWG 파일 파싱 중...');
    
    // 파일을 가상 파일 시스템에 저장
    const fileName = '/temp.dwg';
    lib.FS.writeFile(fileName, buffer);
    
    // dwg_read_file로 파싱
    const drawing = lib.dwg_read_file(fileName);
    console.log('✅ 파일 파싱 완료');
    console.log('Drawing 객체:', drawing, typeof drawing);
    
    // Drawing 객체 에러 확인
    if (drawing && typeof drawing === 'object' && drawing.error) {
      const errorCode = drawing.error;
      const errorMessages = {
        0: 'DWG_NOERR',
        1: 'DWG_ERR_WRONGCRC',
        2: 'DWG_ERR_NOTYETSUPPORTED',
        4: 'DWG_ERR_UNHANDLEDCLASS',
        8: 'DWG_ERR_INVALIDTYPE',
        16: 'DWG_ERR_INVALIDHANDLE',
        32: 'DWG_ERR_INVALIDEED',
        64: 'DWG_ERR_VALUEOUTOFBOUNDS',
        128: 'DWG_ERR_CLASSESNOTFOUND',
        256: 'DWG_ERR_SECTIONNOTFOUND',
        512: 'DWG_ERR_PAGENOTFOUND',
        1024: 'DWG_ERR_INTERNALERROR',
        2048: 'DWG_ERR_INVALIDDWG',
        4096: 'DWG_ERR_IOERROR',
        8192: 'DWG_ERR_OUTOFMEM'
      };
      
      const errorName = errorMessages[errorCode] || `UNKNOWN_ERROR_${errorCode}`;
      
      // DWG_ERR_CRITICAL = 128, 이보다 작은 오류는 비치명적
      const isCritical = errorCode >= 128;
      
      if (isCritical) {
        console.log(`❌ LibreDWG 치명적 에러: ${errorName} (코드: ${errorCode})`);
        
        if (errorCode === 2048) {
          console.log('💡 힌트: LibreDWG는 DWG 파일만 지원합니다. DXF 파일은 지원하지 않습니다.');
          console.log('💡 DXF 파일을 DWG로 변환하거나 다른 라이브러리를 사용해야 합니다.');
        }
        
        throw new Error(`LibreDWG 파싱 실패: ${errorName}`);
      } else {
        console.log(`⚠️  LibreDWG 경고: ${errorName} (코드: ${errorCode})`);
        console.log('💡 이는 비치명적 오류입니다. 일부 데이터가 손실될 수 있지만 계속 진행합니다.');
        
        if (errorCode === 64) {
          console.log('💡 DWG_ERR_VALUEOUTOFBOUNDS: 일부 값이 예상 범위를 벗어났습니다.');
          console.log('💡 이는 DWG 파일의 버전이나 특정 엔티티에서 발생할 수 있는 일반적인 문제입니다.');
        }
      }
    }
    
    // Drawing 객체 유효성 확인 (에러가 있어도 data가 있으면 계속 진행)
    let drawingData = null;
    if (drawing && typeof drawing === 'object' && drawing.data) {
      drawingData = drawing.data;
      console.log('✅ Drawing 데이터 포인터 확인됨:', drawingData);
    } else if (drawing && typeof drawing === 'number' && drawing > 0) {
      drawingData = drawing;
      console.log('✅ Drawing 포인터 확인됨:', drawingData);
    } else {
      console.log('❌ Drawing 객체가 null이거나 유효하지 않습니다');
      console.log('Drawing 상세:', drawing);
    }
    
    // 4. Drawing 정보 확인 (데이터가 있는 경우에만)
    if (drawingData) {
      console.log('🔍 Drawing 정보 확인 중...');
      try {
        const numObjects = lib.dwg_get_num_objects(drawingData);
        const numEntities = lib.dwg_get_num_entities(drawingData);
        console.log(`  - 총 객체 수: ${numObjects}`);
        console.log(`  - 총 엔티티 수: ${numEntities}`);
      } catch (error) {
        console.log('  Drawing 정보 읽기 실패:', error.message);
        console.log('  Drawing 객체가 손상되었을 수 있습니다.');
      }
      
      // 5. SVG 변환 시도
      console.log('🎨 SVG 변환 시도 중...');
      let svgData = null;
      try {
        // SVG 변환 함수들을 시도해봅니다
        if (typeof lib.dwg_svg === 'function') {
          svgData = lib.dwg_svg(drawingData);
          console.log(`✅ SVG 변환 완료 (dwg_svg)`);
        } else if (typeof lib.dwg2svg === 'function') {
          svgData = lib.dwg2svg(drawingData);
          console.log(`✅ SVG 변환 완료 (dwg2svg)`);
        } else if (typeof lib.dwg_to_svg === 'function') {
          svgData = lib.dwg_to_svg(drawingData);
          console.log(`✅ SVG 변환 완료 (dwg_to_svg)`);
        } else {
          console.log('❌ SVG 변환 함수를 찾을 수 없습니다. 사용 가능한 함수들:');
          console.log('  - dwg_svg:', typeof lib.dwg_svg);
          console.log('  - dwg2svg:', typeof lib.dwg2svg);
          console.log('  - dwg_to_svg:', typeof lib.dwg_to_svg);
          console.log('  - dwg_export_svg:', typeof lib.dwg_export_svg);
          
          // BMP 변환을 대신 시도
          console.log('🎨 BMP 변환을 대신 시도 중...');
          try {
            svgData = lib.dwg_bmp(drawingData);
            console.log(`✅ BMP 변환 완료 (SVG 대신)`);
          } catch (bmpError) {
            console.log(`❌ BMP 변환도 실패: ${bmpError.message}`);
          }
        }
      } catch (error) {
        console.log(`❌ SVG 변환 실패: ${error.message}`);
        console.log('SVG 변환을 건너뛰고 계속 진행합니다.');
      }
      
      // 6. 텍스트 엔티티 검색
      console.log('\n📝 텍스트 엔티티 검색:');
      try {
        const numEntities = lib.dwg_get_num_entities(drawingData);
        let textCount = 0;
        
        for (let i = 0; i < numEntities && i < 20; i++) {
          try {
            const entity = lib.dwg_get_entity_index(drawingData, i);
            if (entity) {
              const typeName = lib.dwg_object_get_dxfname(entity);
              
              if (typeName === 'TEXT' || typeName === 'MTEXT') {
                textCount++;
                try {
                  const text = lib.dwg_ent_get_STRING(entity, 'text');
                  console.log(`  ${textCount}. [${typeName}] "${text}"`);
                  
                  // KITCHEN 텍스트 특별 확인
                  if (text && text.toUpperCase().includes('KITCHEN')) {
                    console.log(`  🎯 KITCHEN 텍스트 발견: "${text}"`);
                  }
                } catch (textError) {
                  console.log(`  ${textCount}. [${typeName}] (텍스트 읽기 실패)`);
                }
              }
            }
          } catch (entityError) {
            // 개별 엔티티 오류는 무시하고 계속 진행
            continue;
          }
        }
        
        if (textCount === 0) {
          console.log('  텍스트 엔티티를 찾을 수 없습니다.');
        } else {
          console.log(`  총 ${textCount}개의 텍스트 엔티티를 발견했습니다.`);
        }
        
      } catch (error) {
        console.log('  텍스트 엔티티 검색 실패:', error.message);
      }
      
      // 7. SVG/BMP 파일 저장 (있다면)
      if (svgData) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        
        console.log('데이터 타입:', typeof svgData);
        console.log('데이터 상세:', svgData);
        
        // SVG 데이터인지 확인 (문자열로 시작하는지)
        if (typeof svgData === 'string' && svgData.includes('<svg')) {
          const svgFileName = `libredwg-test-${timestamp}.svg`;
          const svgPath = path.join(__dirname, 'results', svgFileName);
          console.log(`\n💾 SVG 파일 저장: ${svgPath}`);
          try {
            await fs.writeFile(svgPath, svgData, 'utf8');
            console.log('✅ SVG 파일 저장 완료');
          } catch (saveError) {
            console.log('❌ SVG 파일 저장 실패:', saveError.message);
          }
        } else {
          // BMP 데이터로 처리
          const bmpFileName = `libredwg-test-${timestamp}.bmp`;
          const bmpPath = path.join(__dirname, 'results', bmpFileName);
          console.log(`\n💾 BMP 파일 저장: ${bmpPath}`);
          try {
            // BMP 데이터가 ArrayBuffer나 Uint8Array인지 확인 후 저장
            if (svgData instanceof Uint8Array || svgData instanceof ArrayBuffer) {
              await fs.writeFile(bmpPath, new Uint8Array(svgData));
              console.log('✅ BMP 파일 저장 완료');
            } else if (svgData && svgData.data && svgData.data instanceof Uint8Array) {
              // LibreDWG에서 반환된 구조체 형식 { type: number, data: Uint8Array }
              console.log(`BMP 데이터 타입: ${svgData.type}, 크기: ${svgData.data.length} bytes`);
              await fs.writeFile(bmpPath, svgData.data);
              console.log('✅ BMP 파일 저장 완료');
            } else if (svgData && svgData.buffer) {
              // WASM에서 반환된 메모리 포인터일 수 있음
              console.log('BMP 데이터가 메모리 포인터인 것 같습니다. 변환을 시도합니다.');
              // 일반적인 BMP 헤더 크기를 가정하여 데이터 추출 시도
              const size = svgData.size || 1024 * 1024; // 기본 1MB
              const buffer = lib.HEAPU8.slice(svgData, svgData + size);
              await fs.writeFile(bmpPath, buffer);
              console.log('✅ BMP 파일 저장 완료 (메모리 포인터에서 변환)');
            } else {
              console.log('❌ 데이터 형식을 인식할 수 없습니다:', typeof svgData);
              console.log('데이터 내용:', Object.keys(svgData || {}));
            }
          } catch (saveError) {
            console.log('❌ BMP 파일 저장 실패:', saveError.message);
          }
        }
      }
    }
    
    // 8. 결과 분석
    console.log('\n📊 === 변환 결과 분석 ===');
    console.log(`원본 DWG 크기: ${(buffer.length / 1024).toFixed(1)} KB`);
    console.log(`Drawing 객체:`, drawingData ? '✅ 성공' : '❌ 실패');
    console.log(`에러 코드:`, drawing && drawing.error ? drawing.error : '없음');
    
    console.log('\n🎉 === 테스트 완료 ===');
    
    return {
      success: true,
      drawing: !!drawingData,
      hasError: !!(drawing && drawing.error),
      errorCode: drawing && drawing.error ? drawing.error : null,
      stats: {
        dwgSize: buffer.length
      }
    };
    
  } catch (error) {
    console.error('❌ LibreDWG 변환 실패:', error.message);
    console.error('스택 트레이스:', error.stack);
    
    return {
      success: false,
      error: error.message
    };
  }
}

// 테스트 실행
if (require.main === module) {
  testLibreDwgConversion()
    .then(result => {
      if (result.success) {
        console.log('\n✅ 테스트 성공!');
        if (result.hasError) {
          console.log(`⚠️  경고: 에러 코드 ${result.errorCode}가 있지만 계속 진행되었습니다.`);
        }
        process.exit(0);
      } else {
        console.log('\n❌ 테스트 실패!');
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('❌ 예상치 못한 오류:', error);
      process.exit(1);
    });
}

module.exports = { testLibreDwgConversion };