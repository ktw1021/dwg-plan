import React, { useCallback, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useViewer } from '../hooks';
import { useSocket } from '../context/SocketContext';
import { downloadFile, exportData } from '../utils';
import ResultViewer from '../components/ResultViewer';
import styles from '../styles/common.module.css';

const ResultPage = () => {
  const { jobId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const socket = useSocket();
  const result = location.state?.result;
  const uploadedFile = location.state?.file;

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
    setSvgLoaded,
    setSvgContent
  } = useViewer(result);

  useEffect(() => {
    // 직접 URL 접근 시 결과 데이터가 없으면 업로드 페이지로 리다이렉트
    if (!result || !uploadedFile) {
      navigate('/upload', { replace: true });
    }
  }, [result, uploadedFile, navigate]);

  // WebSocket 이벤트 핸들러 설정
  useEffect(() => {
    if (!socket || !jobId) return;

    // 작업 룸에 참가
    socket.emit('join', { jobId });
  }, [socket, jobId]);

  const handleReset = () => {
    navigate('/upload');
  };

  const handleDownload = useCallback(() => {
    if (!result?.imageUrl || !jobId) return;
    
    const apiUrl = process.env.REACT_APP_API_URL;
    const ext = result.imageUrl.split('.').pop();
    const filename = contentType === 'svg' ? `cad-visualization-${jobId}.svg` :
                    contentType === 'image' ? `floor-plan-image-${jobId}.${ext}` :
                    contentType === 'pdf' ? `floor-plan-pdf-${jobId}.${ext}` :
                    `file-${jobId}.${ext}`;
    
    downloadFile(`${apiUrl}${result.imageUrl}`, filename);
  }, [result, contentType, jobId]);
  
  const handleExport = useCallback(() => {
    if (!result || !jobId) return;
    exportData(result, `cad-data-${jobId}.json`);
  }, [result, jobId]);

  if (!result || !uploadedFile) {
    return null; // 리다이렉트 되기 전까지 아무것도 렌더링하지 않음
  }

  if (!result?.imageUrl && !svgContent) {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.error}>
          <h2>결과를 불러올 수 없습니다</h2>
          <p>분석 결과가 없거나 오류가 발생했습니다. 다시 시도해주세요.</p>
          <button className={styles.button} onClick={handleReset}>새 파일 분석하기</button>
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

  return (
    <div className={styles.pageContainer}>
      <div className={styles.header}>
        <h2 className={styles.title}>{getTitle()}</h2>
        <p className={styles.subtitle}>{getSubtitle()}</p>
      </div>
      
      <div className={styles.divider} />
      
      <ResultViewer
        contentType={contentType}
        svgContent={svgContent}
        isLoading={isLoading}
        scale={scale}
        panX={panX}
        panY={panY}
        isDragging={isDragging}
        viewerRef={viewerRef}
        handleZoomIn={handleZoomIn}
        handleZoomOut={handleZoomOut}
        resetTransform={resetTransform}
        handleMouseDown={handleMouseDown}
        handleMouseMove={handleMouseMove}
        handleMouseUp={handleMouseUp}
        setSvgLoaded={setSvgLoaded}
        result={result}
        onDownload={handleDownload}
        onExport={handleExport}
        onReset={handleReset}
      />
      
      <div className={styles.divider} />
    </div>
  );
};

export default ResultPage; 