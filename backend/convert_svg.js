const fs = require('fs');
const { exec } = require('child_process');

// SVG를 PNG로 변환 (Chrome headless 사용)
function convertSvgToPng(svgFile, pngFile) {
    const command = `chrome --headless --disable-gpu --screenshot="${pngFile}" --window-size=1920,1080 "${svgFile}"`;
    
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error('변환 오류:', error);
            return;
        }
        console.log(`PNG 파일 생성 완료: ${pngFile}`);
    });
}

// 사용 예시
const svgFile = 'file://' + __dirname + '/results/b7cc3ed2-44dd-4f51-9ea1-eb95149f5ffa.svg';
const pngFile = __dirname + '/results/drawing.png';

convertSvgToPng(svgFile, pngFile); 