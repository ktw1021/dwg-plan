const { parseDxfFile } = require('./utils/dxfProcessor');
const { generateSvg } = require('./utils/dxfProcessor');
const path = require('path');

async function testImprovedSvg() {
  try {
    console.log('개선된 SVG 생성 테스트 시작...');
    
    // DXF 파싱
    const entities = await parseDxfFile('./temp/5ad67fb1-07f2-4e7a-9d46-390f5f8d436d.dxf');
    console.log(`파싱된 엔티티: ${entities.length}개`);
    
    // 새로운 SVG 파일 경로
    const svgPath = path.join(__dirname, 'results', 'improved-svg.svg');
    
    // SVG 생성 (개선된 범위 계산 적용)
    await generateSvg(entities, svgPath);
    
    console.log(`개선된 SVG 생성 완료: ${svgPath}`);
    
  } catch (error) {
    console.error('테스트 실패:', error.message);
  }
}

testImprovedSvg(); 