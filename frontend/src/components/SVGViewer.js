import React, { useRef, useEffect, useState } from 'react';
import './SVGViewer.css';

const SVGViewer = ({ svgPath, onError }) => {
  const [svgContent, setSvgContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [zoom, setZoom] = useState(1);

  // SVG 파일 로드
  useEffect(() => {
    if (!svgPath) return;

    const loadSVG = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log('🎨 SVG 로딩 시작:', svgPath);
        
        const response = await fetch(svgPath);
        console.log('📡 응답 상태:', response.status, response.statusText);
        
        if (!response.ok) {
          throw new Error(`SVG 로드 실패: ${response.status} ${response.statusText}`);
        }
        
        const svgText = await response.text();
        console.log('✅ SVG 로딩 완료:', svgText.length, '문자');
        
        setSvgContent(svgText);
        setLoading(false);
        
      } catch (err) {
        console.error('❌ SVG 로딩 오류:', err);
        setError(err.message);
        setLoading(false);
        if (onError) onError(err);
      }
    };

    loadSVG();
  }, [svgPath]);

  const zoomIn = () => {
    setZoom(prev => Math.min(prev * 1.2, 5));
  };

  const zoomOut = () => {
    setZoom(prev => Math.max(prev * 0.8, 0.1));
  };

  const resetZoom = () => {
    setZoom(1);
  };

  if (loading) {
    return (
      <div className="svg-viewer-container">
        <div className="svg-loading">
          <div className="loading-spinner"></div>
          <p>도면을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="svg-viewer-container">
        <div className="svg-error">
          <h3>도면 로딩 오류</h3>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>다시 시도</button>
        </div>
      </div>
    );
  }

  return (
    <div className="svg-viewer-container">
      {/* 컨트롤 패널 */}
      <div className="svg-controls">
        <button onClick={zoomIn} title="확대">🔍+</button>
        <button onClick={zoomOut} title="축소">🔍-</button>
        <button onClick={resetZoom} title="원본 크기">📐</button>
        <span className="zoom-level">{Math.round(zoom * 100)}%</span>
        <a 
          href={svgPath} 
          target="_blank" 
          rel="noopener noreferrer"
          style={{ 
            marginLeft: '10px', 
            padding: '6px 10px', 
            background: '#28a745', 
            color: 'white', 
            textDecoration: 'none', 
            borderRadius: '4px',
            fontSize: '12px'
          }}
        >
          새 탭에서 열기
        </a>
      </div>

      {/* SVG 뷰어 */}
      <div 
        className="svg-container"
        style={{ 
          overflow: 'auto',
          width: '100%',
          height: '100%',
          background: 'white'
        }}
      >
        <div 
          style={{
            zoom: zoom,
            transformOrigin: 'top left',
            minWidth: '100%',
            minHeight: '100%'
          }}
          dangerouslySetInnerHTML={{ __html: svgContent }} 
        />
      </div>

      {/* 정보 패널 */}
      <div className="svg-info">
        <span>SVG 뷰어 | 마우스 휠: 스크롤 | 버튼: 줌</span>
      </div>
    </div>
  );
};

export default SVGViewer; 