import { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { getFloorplanResult } from '../services/api';

export const useProgress = (jobId, onComplete) => {
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("준비 중...");
  const [error, setError] = useState(null);
  const socket = useSocket();

  useEffect(() => {
    if (!jobId) return;

    // 폴링으로 결과 확인
    const checkResultInterval = setInterval(async () => {
      try {
        const result = await getFloorplanResult(jobId);
        
        if (result.status === 'done') {
          clearInterval(checkResultInterval);
          onComplete(result);
        } else if (result.status === 'error') {
          clearInterval(checkResultInterval);
          setError(result.error || '분석 중 오류가 발생했습니다.');
        }
      } catch (error) {
        console.error('Error checking result:', error);
      }
    }, 3000);

    return () => clearInterval(checkResultInterval);
  }, [jobId, onComplete]);

  useEffect(() => {
    if (!socket || !jobId) return;

    socket.emit('join', { jobId });

    const handleProgress = (data) => {
      if (data.jobId === jobId) {
        setProgress(data.percent);
        if (data.message) setMessage(data.message);
        
        if (data.percent === 100) {
          getFloorplanResult(jobId)
            .then(result => {
              if (result.status === 'done') {
                onComplete(result);
              }
            })
            .catch(console.error);
        }
      }
    };

    const handleError = (data) => {
      if (data.jobId === jobId) {
        setError(data.message || '분석 중 오류가 발생했습니다.');
      }
    };

    socket.on('progress', handleProgress);
    socket.on('error', handleError);

    return () => {
      socket.off('progress', handleProgress);
      socket.off('error', handleError);
    };
  }, [socket, jobId, onComplete]);

  return { progress, message, error };
}; 