import React, { useEffect, useState } from 'react';
import styles from '../styles/common.module.css';

const ResultViewer = ({
  contentType,
  svgContent,
  isLoading,
  error,
  scale,
  panX,
  panY,
  isDragging,
  viewerRef,
  handleZoomIn,
  handleZoomOut,
  resetTransform,
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
  setSvgLoaded,
  result,
  onDownload,
  onExport,
  onReset
}) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    console.log('ResultViewer: Props update', {
      contentType,
      hasSvgContent: !!svgContent,
      isLoading,
      hasError: !!error,
      contentStart: svgContent?.substring(0, 50)
    });
  }, [contentType, svgContent, isLoading, error]);

  const viewerStyle = {
    cursor: isDragging ? 'grabbing' : 'grab',
    width: '100%',
    height: '700px',
    overflow: 'hidden',
    position: 'relative',
    border: !isDarkMode ? '1px solid #333' : '1px solid #fff',
    borderRadius: '8px',
    background: !isDarkMode ? '#fff' : '#1a1a1a',
    color: !isDarkMode ? '#000' : '#fff'
  };

  const contentStyle = {
    width: '100%',
    height: '100%',
    userSelect: 'none',
    transform: `translate(${panX}px, ${panY}px) scale(${scale})`,
    transformOrigin: '0 0',
    filter: isDarkMode ? 'invert(1) brightness(1.5) contrast(1.5)' : 'none'
  };

  const renderContent = () => {
    console.log('ResultViewer: Rendering content', {
      isLoading,
      hasError: !!error,
      hasSvgContent: !!svgContent,
      svgContentLength: svgContent?.length,
      svgContentStart: svgContent?.substring(0, 100),
      contentType
    });

    if (isLoading) {
      return (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>도면을 불러오는 중입니다...</p>
        </div>
      );
    }

    if (error) {
      console.error('ResultViewer: Error rendering content:', error);
      return (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p style={{ color: '#dc3545', marginBottom: '10px' }}>도면을 불러오는데 실패했습니다</p>
          <p style={{ fontSize: '0.9em', color: '#6c757d' }}>{error}</p>
        </div>
      );
    }

    if (!svgContent) {
      console.warn('ResultViewer: No SVG content available');
      return (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>도면 데이터가 없습니다</p>
        </div>
      );
    }

    console.log('ResultViewer: Attempting to render SVG content');
    return (
      <div 
        dangerouslySetInnerHTML={{ __html: svgContent }} 
        style={contentStyle}
        onLoad={() => {
          console.log('ResultViewer: SVG content loaded successfully');
          setSvgLoaded(true);
        }}
        onError={(e) => {
          console.error('ResultViewer: SVG rendering error:', e);
        }}
      />
    );
  };

  return (
    <div className={styles.viewerContainer}>
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '20px' }}>
          <button 
            onClick={handleZoomIn}
            className={styles.button}
            disabled={isLoading || error}
          >
            확대 (+)
          </button>
          <button 
            onClick={handleZoomOut}
            className={styles.button}
            disabled={isLoading || error}
          >
            축소 (-)
          </button>
          <button 
            onClick={resetTransform}
            className={styles.buttonSecondary}
            disabled={isLoading || error}
          >
            초기화
          </button>
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            style={{
              padding: '12px 24px',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              background: isDarkMode ? '#fff' : '#000',
              color: isDarkMode ? '#000' : '#fff',
              border: isDarkMode ? '1px solid #333' : '1px solid #ddd'
            }}
            disabled={isLoading || error}
          >
            {isDarkMode ? '🌞 라이트 모드' : '🌙 다크 모드'}
          </button>
        </div>

        <div 
          ref={viewerRef}
          style={viewerStyle}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {renderContent()}
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '20px', 
          marginTop: '20px',
          padding: '20px',
          background: '#f8f9fa',
          borderRadius: '8px'
        }}>
          <div>
            <span style={{ fontWeight: '500' }}>📐 도면 요소:</span>
            <span style={{ marginLeft: '8px' }}>{result.entityCount || 0}개</span>
          </div>
          <div>
            <span style={{ fontWeight: '500' }}>🔍 확대/축소:</span>
            <span style={{ marginLeft: '8px' }}>마우스 휠 또는 버튼 사용</span>
          </div>
          <div>
            <span style={{ fontWeight: '500' }}>👆 이동:</span>
            <span style={{ marginLeft: '8px' }}>클릭 드래그로 이동</span>
          </div>
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
        <button 
          onClick={onReset}
          className={styles.button}
        >
          새 도면 업로드
        </button>
        <button 
          onClick={onDownload}
          className={styles.buttonSecondary}
          disabled={isLoading || error}
        >
          도면 다운로드
        </button>
        <button 
          onClick={onExport}
          className={styles.buttonDanger}
          disabled={isLoading || error}
        >
          데이터 내보내기
        </button>
      </div>
    </div>
  );
};

export default ResultViewer; 