import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';

// 상수 정의
const ZOOM_FACTOR = 1.2;
const MIN_SCALE = 0.1;
const MAX_SCALE = 10;
const WHEEL_ZOOM_FACTOR = 0.1;
const POLLING_INTERVAL = 1000; // 1초마다 폴링

/**
 * SVG 뷰어 훅
 * @param {Object} result - 초기 결과 데이터
 * @returns {Object} 뷰어 상태 및 제어 함수들
 */
export const useViewer = (result) => {
  // 상태 관리
  const [contentType, setContentType] = useState('svg');
  const [svgContent, setSvgContent] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [svgLoaded, setSvgLoaded] = useState(false);
  const [error, setError] = useState(null);
  
  // Transform 상태
  const [scale, setScale] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  
  // 드래그 상태
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const viewerRef = useRef(null);
  const pollingRef = useRef(null);

  // SVG 컨텐츠 폴링
  const pollSvgContent = useCallback(async (jobId) => {
    try {
      const response = await api.get(`/api/dwg/svg/${jobId}`);

      if (response.data.success) {
        if (response.data.status === 'done' && response.data.svgContent) {
          setSvgContent(response.data.svgContent);
          setContentType('svg');
          setIsLoading(false);
          setSvgLoaded(true);
          
          // 폴링 중단
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      } else {
        throw new Error(response.data.message || '도면 데이터를 불러오는데 실패했습니다.');
      }
    } catch (error) {
      setError(error.message);
      setIsLoading(false);
      
      // 에러 발생 시 폴링 중단
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }
  }, []);

  // 폴링 시작
  useEffect(() => {
    if (!result?.jobId) {
      return;
    }
    
    // 상태 초기화
    setIsLoading(true);
    setSvgLoaded(false);
    setError(null);
    resetTransform();

    // 즉시 한 번 실행
    pollSvgContent(result.jobId);

    // 폴링 시작
    pollingRef.current = setInterval(() => {
      pollSvgContent(result.jobId);
    }, POLLING_INTERVAL);

    return () => {
      // 정리: 폴링 중단
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [result?.jobId, pollSvgContent]);

  /**
   * Transform 초기화
   */
  const resetTransform = useCallback(() => {
    setScale(1);
    setPanX(0);
    setPanY(0);
  }, []);

  /**
   * 확대
   */
  const handleZoomIn = useCallback(() => {
    setScale(prev => Math.min(prev * ZOOM_FACTOR, MAX_SCALE));
  }, []);

  /**
   * 축소
   */
  const handleZoomOut = useCallback(() => {
    setScale(prev => Math.max(prev / ZOOM_FACTOR, MIN_SCALE));
  }, []);

  /**
   * 마우스 드래그 시작
   */
  const handleMouseDown = useCallback((e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    e.preventDefault();
  }, []);

  /**
   * 마우스 드래그 중
   */
  const handleMouseMove = useCallback((e) => {
    if (!isDragging || !svgLoaded) return;
    
    const deltaX = e.clientX - dragStart.x;
    const deltaY = e.clientY - dragStart.y;
    
    setPanX(prev => prev + deltaX);
    setPanY(prev => prev + deltaY);
    
    setDragStart({ x: e.clientX, y: e.clientY });
  }, [isDragging, svgLoaded, dragStart]);

  /**
   * 마우스 드래그 종료
   */
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  /**
   * 마우스 휠 확대/축소
   */
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
    handleWheel,
    setSvgLoaded,
    svgLoaded,
    setSvgContent
  };
}; 