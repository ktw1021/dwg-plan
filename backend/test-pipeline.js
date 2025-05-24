/**
 * DWG 처리 파이프라인 테스트 스크립트
 * DWG → ODA File Converter → DXF → dxf library → SVG 전체 흐름 검증
 */

const fs = require('fs');
const path = require('path');
const { processCompleteDxfFile } = require('./utils/dxfProcessor');

async function testPipeline() {
  console.log('🔧 DWG 처리 파이프라인 테스트 시작...\n');
  
  // 테스트용 DWG 파일 확인
  const uploadsDir = path.join(__dirname, 'uploads');
  const dwgFiles = fs.readdirSync(uploadsDir).filter(file => 
    file.toLowerCase().endsWith('.dwg')
  );
  
  if (dwgFiles.length === 0) {
    console.log('❌ uploads/ 디렉토리에 .dwg 파일이 없습니다.');
    console.log('   테스트를 위해 DWG 파일을 uploads/ 폴더에 업로드해주세요.');
    return;
  }
  
  console.log(`📁 테스트 파일 발견: ${dwgFiles.length}개`);
  dwgFiles.forEach(file => console.log(`   - ${file}`));
  console.log('');
  
  // 첫 번째 DWG 파일로 테스트
  const testFile = dwgFiles[0]; // 첫 번째 파일로 다시 변경
  const testFilePath = path.join(uploadsDir, testFile);
  const jobId = 'test-' + Date.now();
  
  console.log(`🎯 테스트 파일: ${testFile}`);
  console.log(`📂 파일 경로: ${testFilePath}`);
  console.log(`🆔 작업 ID: ${jobId}\n`);
  
  try {
    // 진행 상황 출력 콜백
    const progressCallback = (progress, message, data) => {
      console.log(`[${progress}%] ${message}`);
      if (data) {
        console.log(`   추가 정보:`, data);
      }
    };
    
    console.log('🚀 파이프라인 처리 시작...\n');
    
    const startTime = Date.now();
    
    // 메인 처리 함수 실행
    const result = await processCompleteDxfFile(
      jobId, 
      testFile, 
      testFilePath, 
      progressCallback
    );
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(1);
    
    console.log('\n✅ 파이프라인 처리 완료!');
    console.log('📊 결과 요약:');
    console.log(`   - 처리 시간: ${duration}초`);
    console.log(`   - 작업 ID: ${result.jobId}`);
    console.log(`   - SVG 파일: ${result.svgFile}`);
    console.log(`   - 엔티티 개수: ${result.entityCount}개`);
    console.log(`   - 처리 방식: ${result.processingMethod}`);
    console.log(`   - 성공 여부: ${result.success ? '✅' : '❌'}`);
    
    // SVG 파일 존재 확인
    if (fs.existsSync(result.svgFile)) {
      const svgSize = fs.statSync(result.svgFile).size;
      console.log(`   - SVG 크기: ${(svgSize / 1024).toFixed(1)} KB`);
      
      // SVG 내용 간략 확인
      const svgContent = fs.readFileSync(result.svgFile, 'utf8');
      const hasWalls = svgContent.includes('#006400'); // 진한 녹색 벽
      const hasDoors = svgContent.includes('door-marker-90'); // 90도 문 마커
      
      console.log(`   - 벽 색상 변경: ${hasWalls ? '✅' : '❌'}`);
      console.log(`   - 90도 문 감지: ${hasDoors ? '✅' : '❌'}`);
    } else {
      console.log('   - ❌ SVG 파일이 생성되지 않았습니다.');
    }
    
  } catch (error) {
    console.error('\n❌ 파이프라인 처리 실패:');
    console.error(`   오류: ${error.message}`);
    console.error(`   스택: ${error.stack}`);
  }
}

// 스크립트 직접 실행 시
if (require.main === module) {
  testPipeline().catch(console.error);
}

module.exports = { testPipeline }; 