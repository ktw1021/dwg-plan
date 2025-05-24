import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import './ResultViewer.css';

// 상수 정의
const ZOOM_FACTOR = 1.2;
const MIN_SCALE = 0.1;
const MAX_SCALE = 10;
const WHEEL_ZOOM_FACTOR = 0.1;
const VIEWER_HEIGHT = '700px';

const ResultViewer = ({ result, onReset }) => {
  // State 관리
  const [contentType, setContentType] = useState('svg'); // 'svg', 'image', 'pdf'
  const [svgContent, setSvgContent] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [svgLoaded, setSvgLoaded] = useState(false);
  
  // Transform 상태
  const [scale, setScale] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  
  const svgRef = useRef(null); // SVG 뷰어 컨테이너용
  const svgContentRef = useRef(null); // SVG 내용용

  // 상태 초기화 함수
  const resetTransform = useCallback(() => {
    setScale(1);
    setPanX(0);
    setPanY(0);
  }, []);

  // 마우스 이벤트 핸들러들
  const handleMouseDown = useCallback((e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    e.preventDefault();
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging || !svgLoaded) return;
    
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    
    setPanX(prev => prev + deltaX);
    setPanY(prev => prev + deltaY);
    
    setDragStart({ x: e.clientX, y: e.clientY });
  }, [isDragging, svgLoaded, dragStart.x, dragStart.y]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!svgLoaded) return;
    
    const zoomFactor = e.deltaY > 0 ? (1 - WHEEL_ZOOM_FACTOR) : (1 + WHEEL_ZOOM_FACTOR);
    const newScale = Math.max(MIN_SCALE, Math.min(scale * zoomFactor, MAX_SCALE));
    
    if (newScale !== scale) {
      const rect = e.currentTarget.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // 마우스 위치를 기준으로 줌 적용하는 계산 개선
      // 현재 스케일에서 마우스 위치의 실제 좌표 계산
      const scaleRatio = newScale / scale;
      
      // 마우스 위치를 중심으로 줌이 적용되도록 팬 위치 조정
      const newPanX = mouseX - (mouseX - panX) * scaleRatio;
      const newPanY = mouseY - (mouseY - panY) * scaleRatio;
      
      setScale(newScale);
      setPanX(newPanX);
      setPanY(newPanY);
    }
  }, [svgLoaded, scale, panX, panY]);

  // 스크롤바는 유지하면서 SVG 영역에서만 휠 스크롤 방지
  const handleMouseEnter = useCallback(() => {
    // 별도 처리 없음 - CSS로 해결
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 줌 컨트롤 함수들
  const handleZoomIn = useCallback(() => {
    setScale(Math.min(scale * ZOOM_FACTOR, MAX_SCALE));
  }, [scale]);

  const handleZoomOut = useCallback(() => {
    setScale(Math.max(scale / ZOOM_FACTOR, MIN_SCALE));
  }, [scale]);

  // 다운로드 및 내보내기 함수들
  const handleDownload = useCallback(() => {
    if (!result?.imageUrl || !result?.jobId) return;
    const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    const link = document.createElement('a');
    link.href = `${apiUrl}${result.imageUrl}`;
    
    // 파일 타입에 따른 다운로드 파일명 설정
    const ext = result.imageUrl.split('.').pop();
    const filename = contentType === 'svg' ? `cad-visualization-${result.jobId}.svg` :
                     contentType === 'image' ? `floor-plan-image-${result.jobId}.${ext}` :
                     contentType === 'pdf' ? `floor-plan-pdf-${result.jobId}.${ext}` :
                     `file-${result.jobId}.${ext}`;
    
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [result?.imageUrl, result?.jobId, contentType]);
  
  const handleExport = useCallback(() => {
    if (!result) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(result, null, 2));
    const link = document.createElement('a');
    link.href = dataStr;
    link.download = `cad-data-${result.jobId}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [result]);

  // 스타일 객체들 메모이제이션
  const svgViewerStyle = useMemo(() => ({
    cursor: isDragging ? 'grabbing' : 'grab',
    width: '100%',
    height: VIEWER_HEIGHT,
    overflow: 'hidden',
    position: 'relative',
    // SVG 영역에서만 스크롤 방지 (스크롤바는 유지)
    overscrollBehavior: 'none',
    touchAction: 'none',
    // 추가 브라우저 호환성
    WebkitOverscrollBehavior: 'none',
    MsOverscrollBehavior: 'none'
  }), [isDragging]);

  const svgContentStyle = useMemo(() => ({
    width: '100%',
    height: '100%',
    userSelect: 'none',
    transform: `translate(${panX}px, ${panY}px) scale(${scale})`,
    transformOrigin: '0 0'
  }), [panX, panY, scale]);

  const fallbackImageStyle = useMemo(() => ({
    maxWidth: '100%',
    maxHeight: '100%'
  }), []);

  // 콘텐츠 로딩
  useEffect(() => {
    if (!result?.imageUrl) return;

    setIsLoading(true);
    setSvgLoaded(false);
    resetTransform();
    
    const fileType = getFileType(result.imageUrl);
    setContentType(fileType);
    
    if (fileType === 'svg') {
      // SVG 파일의 경우 텍스트로 로딩
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
      
      fetch(`${apiUrl}${result.imageUrl}`)
        .then(response => response.text())
        .then(data => {
          setSvgContent(data);
          setIsLoading(false);
          setSvgLoaded(true);
        })
        .catch(error => {
          console.error("SVG 로딩 오류:", error);
          setIsLoading(false);
        });
    } else {
      // 이미지나 PDF의 경우 URL만 설정
      setSvgContent(null);
      setIsLoading(false);
      setSvgLoaded(true);
    }
  }, [result, resetTransform]);

  // 직접 DOM에 wheel 이벤트 등록 (React의 passive 제한 우회)
  useEffect(() => {
    const svgViewer = svgRef.current; // svg-viewer div 직접 참조
    if (!svgViewer) return;

    const handleWheelDirect = (e) => {
      e.preventDefault(); // 이제 확실히 작동함
      e.stopPropagation();
      
      if (!svgLoaded) return;
      
      const zoomFactor = e.deltaY > 0 ? (1 - WHEEL_ZOOM_FACTOR) : (1 + WHEEL_ZOOM_FACTOR);
      const newScale = Math.max(MIN_SCALE, Math.min(scale * zoomFactor, MAX_SCALE));
      
      if (newScale !== scale) {
        const rect = svgViewer.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // 마우스 위치를 기준으로 줌 적용하는 계산 개선
        // 현재 스케일에서 마우스 위치의 실제 좌표 계산
        const scaleRatio = newScale / scale;
        
        // 마우스 위치를 중심으로 줌이 적용되도록 팬 위치 조정
        const newPanX = mouseX - (mouseX - panX) * scaleRatio;
        const newPanY = mouseY - (mouseY - panY) * scaleRatio;
        
        setScale(newScale);
        setPanX(newPanX);
        setPanY(newPanY);
      }
    };

    // { passive: false }로 등록하여 preventDefault() 사용 가능
    svgViewer.addEventListener('wheel', handleWheelDirect, { passive: false });
    
    return () => {
      svgViewer.removeEventListener('wheel', handleWheelDirect);
    };
  }, [svgLoaded, scale, panX, panY]);

  // 파일 타입 감지 함수
  const getFileType = (imageUrl) => {
    if (!imageUrl) return 'svg';
    const ext = imageUrl.split('.').pop().toLowerCase();
    if (ext === 'pdf') return 'pdf';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
    return 'svg';
  };

  // Early return for invalid result
  if (!result?.imageUrl) {
    return (
      <div className="result-error">
        <h2>결과를 불러올 수 없습니다</h2>
        <p>분석 결과가 없거나 오류가 발생했습니다. 다시 시도해주세요.</p>
        <button className="action-button" onClick={onReset}>새 파일 분석하기</button>
      </div>
    );
  }

  return (
    <div className="result-viewer-container">
      <div className="result-header">
        <h2>
          {contentType === 'svg' ? 'CAD 도면 시각화' : 
           contentType === 'image' ? '도면 이미지 뷰어' :
           contentType === 'pdf' ? 'PDF 도면 뷰어' : '파일 뷰어'}
        </h2>
        <p className="result-subtitle">
          {contentType === 'svg' ? 'DWG 파일이 성공적으로 분석되어 상세한 도면으로 시각화되었습니다.' :
           contentType === 'image' ? '이미지 파일을 확대/축소하며 상세히 확인할 수 있습니다.' :
           contentType === 'pdf' ? 'PDF 파일을 확대/축소하며 상세히 확인할 수 있습니다.' :
           '업로드된 파일을 확인할 수 있습니다.'}
        </p>
      </div>
      
      <div className="result-image-container">
        <div className="svg-controls">
          <button onClick={handleZoomIn} className="svg-control-button">확대 (+)</button>
          <button onClick={handleZoomOut} className="svg-control-button">축소 (-)</button>
          <button onClick={resetTransform} className="svg-control-button">원래 크기</button>
        </div>

        <div 
          className="svg-viewer" 
          ref={svgRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          style={svgViewerStyle}
        >
          {isLoading ? (
            <div className="svg-loading">
              <div className="loading-spinner"></div>
              <p>파일을 불러오는 중...</p>
            </div>
          ) : (
            <>
              {contentType === 'svg' && svgContent ? (
                <div 
                  key={result?.jobId}
                  ref={svgContentRef}
                  dangerouslySetInnerHTML={{ __html: svgContent }} 
                  style={svgContentStyle}
                />
              ) : contentType === 'image' ? (
                <img 
                  src={`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${result.imageUrl}`} 
                  alt="도면 이미지"
                  style={{
                    ...svgContentStyle,
                    maxWidth: 'none',
                    height: 'auto'
                  }}
                  onLoad={() => setSvgLoaded(true)}
                />
              ) : contentType === 'pdf' ? (
                <iframe
                  src={`${process.env.REACT_APP_API_URL || 'http://localhost:5000'}${result.imageUrl}`}
                  title="PDF 도면"
                  style={{
                    ...svgContentStyle,
                    width: '100%',
                    height: '100%',
                    border: 'none'
                  }}
                  onLoad={() => setSvgLoaded(true)}
                />
              ) : (
                <div className="unsupported-format">
                  <p>지원되지 않는 파일 형식입니다.</p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="visualization-info">
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">📐 도면 요소:</span>
              <span className="info-value">{result.entityCount || 0}개</span>
            </div>
            <div className="info-item">
              <span className="info-label">🔍 확대/축소:</span>
              <span className="info-value">마우스 휠 또는 버튼 사용</span>
            </div>
            <div className="info-item">
              <span className="info-label">👆 이동:</span>
              <span className="info-value">클릭 드래그로 이동</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="result-actions">
        <button className="action-button" onClick={onReset}>새 파일 분석하기</button>
        <button className="action-button download" onClick={handleDownload}>도면 다운로드</button>
        <button className="action-button export" onClick={handleExport}>데이터 내보내기</button>
      </div>
    </div>
  );
};

export default ResultViewer; 