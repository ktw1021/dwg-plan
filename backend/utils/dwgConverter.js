const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

/**
 * DWG를 DXF로 변환 (ODA File Converter 사용)
 */
const convertDwgToDxf = async (dwgFilePath) => {
  try {
    console.log('🔄 ODA File Converter를 사용하여 DWG → DXF 변환 시작...');
    
    // ODA File Converter 실행 파일 경로 (일반적인 설치 경로들)
    const possibleOdaPaths = [
      'C:\\Program Files\\ODA\\ODAFileConverter 26.4.0\\ODAFileConverter.exe',
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
          console.log('✅ DWG → DXF 변환 완료');
          
          try {
            const dxfContent = fs.readFileSync(dxfFilePath, 'utf8');
            
            // 임시 파일 보존 (디버깅 및 확인용)
            console.log(`📁 변환된 DXF 파일 보존됨: ${dxfFilePath}`);
            
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
    console.log('🔄 ODA 변환 실패, libredwg-web으로 재시도...');
    try {
      const { libredwgjs } = require('@mlightcad/libredwg-web');
      const dwgBuffer = fs.readFileSync(dwgFilePath);
      const result = await libredwgjs(dwgBuffer, 'dxf');
      
      if (result && result.content) {
        console.log('✅ libredwg-web 변환 성공');
        return result.content;
      }
    } catch (fallbackError) {
      console.error('Fallback 변환도 실패:', fallbackError.message);
    }
    
    throw new Error(`DWG 파일 변환에 실패했습니다. DXF 파일로 변환하여 업로드해주세요. (ODA 오류: ${error.message})`);
  }
};

/**
 * 파일 확장자에 따른 DXF 콘텐츠 로드
 */
const loadDxfContent = async (filename, filePath) => {
  const fileExt = path.extname(filename).toLowerCase();
  
  if (fileExt === '.dwg') {
    console.log('📁 DWG 파일 감지 - DXF로 변환 중...');
    return await convertDwgToDxf(filePath);
  } else if (fileExt === '.dxf') {
    console.log('📁 DXF 파일 감지 - 직접 로드 중...');
    return fs.readFileSync(filePath, 'utf8');
  } else {
    throw new Error('지원하지 않는 파일 형식입니다. DWG 또는 DXF 파일만 업로드해주세요.');
  }
};

module.exports = {
  convertDwgToDxf,
  loadDxfContent
}; 