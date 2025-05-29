import { useState, useEffect, useCallback, useRef } from 'react';

const ZOOM_FACTOR = 1.2;
const MIN_SCALE = 0.1;
const MAX_SCALE = 10;
const WHEEL_ZOOM_FACTOR = 0.1;

export const useViewer = (result) => {
  const [contentType, setContentType] = useState('svg');
  const [svgContent, setSvgContent] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [svgLoaded, setSvgLoaded] = useState(false);
  
  // Transform 상태
  const [scale, setScale] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  
  // 드래그 상태
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const viewerRef = useRef(null);

  const resetTransform = useCallback(() => {
    setScale(1);
    setPanX(0);
    setPanY(0);
  }, []);

  const handleZoomIn = useCallback(() => {
    setScale(prev => Math.min(prev * ZOOM_FACTOR, MAX_SCALE));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale(prev => Math.max(prev / ZOOM_FACTOR, MIN_SCALE));
  }, []);

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
  }, [isDragging, svgLoaded, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    if (!svgLoaded) return;
    
    const zoomFactor = e.deltaY > 0 ? (1 - WHEEL_ZOOM_FACTOR) : (1 + WHEEL_ZOOM_FACTOR);
    const newScale = Math.max(MIN_SCALE, Math.min(scale * zoomFactor, MAX_SCALE));
    
    if (newScale !== scale) {
      const rect = e.currentTarget.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const scaleRatio = newScale / scale;
      const newPanX = mouseX - (mouseX - panX) * scaleRatio;
      const newPanY = mouseY - (mouseY - panY) * scaleRatio;
      
      setScale(newScale);
      setPanX(newPanX);
      setPanY(newPanY);
    }
  }, [svgLoaded, scale, panX, panY]);

  const getFileType = useCallback((imageUrl) => {
    if (!imageUrl) return 'svg';
    const ext = imageUrl.split('.').pop().toLowerCase();
    if (ext === 'pdf') return 'pdf';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image';
    return 'svg';
  }, []);

  // 콘텐츠 로딩
  useEffect(() => {
    if (!result?.imageUrl) return;

    setIsLoading(true);
    setSvgLoaded(false);
    resetTransform();
    
    const fileType = getFileType(result.imageUrl);
    setContentType(fileType);
    
    if (fileType === 'svg') {
      const apiUrl = process.env.REACT_APP_API_URL;
      
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
      setSvgContent(null);
      setIsLoading(false);
      setSvgLoaded(true);
    }
  }, [result, resetTransform, getFileType]);

  // 휠 이벤트 등록
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    const handleWheelDirect = (e) => {
      e.preventDefault();
      handleWheel(e);
    };

    viewer.addEventListener('wheel', handleWheelDirect, { passive: false });
    
    return () => {
      viewer.removeEventListener('wheel', handleWheelDirect);
    };
  }, [handleWheel]);

  return {
    contentType,
    svgContent,
    isLoading,
    svgLoaded,
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
  };
}; 