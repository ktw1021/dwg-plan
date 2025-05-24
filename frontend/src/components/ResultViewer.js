import React, { useCallback } from 'react';
import { useViewer } from '../hooks';
import { downloadFile, exportData } from '../utils';
import styles from '../styles/common.module.css';

const ResultViewer = ({ result, onReset }) => {
  const {
    contentType,
    svgContent,
    isLoading,
    scale,
    panX,
    panY,
    isDragging,
    viewerRef,
    resetTransform,
    handleZoomIn,
    handleZoomOut,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    setSvgLoaded
  } = useViewer(result);

  const handleDownload = useCallback(() => {
    if (!result?.imageUrl || !result?.jobId) return;
    
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    const ext = result.imageUrl.split('.').pop();
    const filename = contentType === 'svg' ? `cad-visualization-${result.jobId}.svg` :
                     contentType === 'image' ? `floor-plan-image-${result.jobId}.${ext}` :
                     contentType === 'pdf' ? `floor-plan-pdf-${result.jobId}.${ext}` :
                     `file-${result.jobId}.${ext}`;
    
    downloadFile(`${apiUrl}${result.imageUrl}`, filename);
  }, [result, contentType]);
  
  const handleExport = useCallback(() => {
    if (!result) return;
    exportData(result, `cad-data-${result.jobId}.json`);
  }, [result]);

  if (!result?.imageUrl) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>결과를 불러올 수 없습니다</h2>
          <p>분석 결과가 없거나 오류가 발생했습니다. 다시 시도해주세요.</p>
          <button className={styles.button} onClick={onReset}>새 파일 분석하기</button>
        </div>
      </div>
    );
  }

  const getTitle = () => {
    switch (contentType) {
      case 'svg': return 'CAD 도면 시각화';
      case 'image': return '도면 이미지 뷰어';
      case 'pdf': return 'PDF 도면 뷰어';
      default: return '파일 뷰어';
    }
  };

  const getSubtitle = () => {
    switch (contentType) {
      case 'svg': return 'DWG 파일이 성공적으로 분석되어 상세한 도면으로 시각화되었습니다.';
      case 'image': return '이미지 파일을 확대/축소하며 상세히 확인할 수 있습니다.';
      case 'pdf': return 'PDF 파일을 확대/축소하며 상세히 확인할 수 있습니다.';
      default: return '업로드된 파일을 확인할 수 있습니다.';
    }
  };

  const viewerStyle = {
    cursor: isDragging ? 'grabbing' : 'grab',
    width: '100%',
    height: '700px',
    overflow: 'hidden',
    position: 'relative',
    border: '1px solid #ddd',
    borderRadius: '8px',
    background: '#f8f9fa'
  };

  const contentStyle = {
    width: '100%',
    height: '100%',
    userSelect: 'none',
    transform: `translate(${panX}px, ${panY}px) scale(${scale})`,
    transformOrigin: '0 0'
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>{getTitle()}</h2>
        <p className={styles.subtitle}>{getSubtitle()}</p>
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '20px' }}>
          <button onClick={handleZoomIn} className={styles.button}>확대 (+)</button>
          <button onClick={handleZoomOut} className={styles.button}>축소 (-)</button>
          <button onClick={resetTransform} className={styles.buttonSecondary}>원래 크기</button>
        </div>

        <div 
          ref={viewerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={viewerStyle}
        >
          {isLoading ? (
            <div className={styles.loading}>
              <div className={styles.spinner} />
              <p>파일을 불러오는 중...</p>
            </div>
          ) : (
            <>
              {contentType === 'svg' && svgContent ? (
                <div 
                  dangerouslySetInnerHTML={{ __html: svgContent }} 
                  style={contentStyle}
                />
              ) : contentType === 'image' ? (
                <img 
                  src={`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${result.imageUrl}`} 
                  alt="도면 이미지"
                  style={{ ...contentStyle, maxWidth: 'none', height: 'auto' }}
                  onLoad={() => setSvgLoaded(true)}
                />
              ) : contentType === 'pdf' ? (
                <iframe
                  src={`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${result.imageUrl}`}
                  title="PDF 도면"
                  style={{ ...contentStyle, border: 'none' }}
                  onLoad={() => setSvgLoaded(true)}
                />
              ) : (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <p>지원되지 않는 파일 형식입니다.</p>
                </div>
              )}
            </>
          )}
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
        <button className={styles.button} onClick={onReset}>새 파일 분석하기</button>
        <button className={styles.buttonSecondary} onClick={handleDownload}>도면 다운로드</button>
        <button className={styles.buttonDanger} onClick={handleExport}>데이터 내보내기</button>
      </div>
    </div>
  );
};

export default ResultViewer; 