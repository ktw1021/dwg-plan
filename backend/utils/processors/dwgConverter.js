const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

/**
 * DWG를 DXF로 변환 (ODA File Converter 사용)
 */
const convertDwgToDxf = async (dwgFilePath) => {
  try {
    // 환경변수에서 ODA File Converter 경로 가져오기
    const odaPath = process.env.ODA_CONVERTER_PATH;
    
    if (!odaPath) {
      throw new Error('ODA_CONVERTER_PATH 환경변수가 설정되지 않았습니다. .env 파일을 확인해주세요.');
    }
    
    if (!fs.existsSync(odaPath)) {
      throw new Error(`ODA File Converter를 찾을 수 없습니다: ${odaPath}`);
    }
    
    // 임시 출력 디렉토리 생성 (backend/temp)
    const tempDir = path.join(__dirname, '..', '..', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const inputDir = path.dirname(dwgFilePath);
    const outputDir = tempDir;
    const dwgFileName = path.basename(dwgFilePath, path.extname(dwgFilePath));
    const dxfFilePath = path.join(outputDir, `${dwgFileName}.dxf`);
    
    // ODA File Converter 실행 인자
    const args = [
      inputDir,        // 입력 디렉토리
      outputDir,       // 출력 디렉토리  
      'ACAD2018',      // 출력 버전
      'DXF',           // 출력 형식
      '1',             // 반복 모드
      '1',             // 감사 정보 포함
      `${dwgFileName}.dwg` // 입력 파일명
    ];
    
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
          try {
            const dxfContent = fs.readFileSync(dxfFilePath, 'utf8');
            resolve(dxfContent);
          } catch (readError) {
            reject(new Error(`변환된 DXF 파일 읽기 실패: ${readError.message}`));
          }
        } else {
          reject(new Error(`ODA File Converter 실행 실패 (코드: ${code})\n${stderr || stdout}`));
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
    throw new Error(`DWG 파일 변환에 실패했습니다. DXF 파일로 변환하여 업로드해주세요. (ODA 오류: ${error.message})`);
  }
};

/**
 * 파일 확장자에 따른 DXF 콘텐츠 로드
 */
const loadDxfContent = async (filename, filePath) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`파일을 찾을 수 없습니다: ${filePath}`);
  }
  
  const fileExt = path.extname(filename).toLowerCase();
  
  if (fileExt === '.dwg') {
    return await convertDwgToDxf(filePath);
  } else if (fileExt === '.dxf') {
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      throw new Error(`DXF 파일 읽기 실패: ${error.message}`);
    }
  } else {
    throw new Error('지원하지 않는 파일 형식입니다. DWG 또는 DXF 파일만 업로드해주세요.');
  }
};

module.exports = {
  convertDwgToDxf,
  loadDxfContent
}; 