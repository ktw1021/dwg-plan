import { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { getJobStatus } from '../services/api';

export const useProgress = (jobId, onComplete) => {
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("준비 중...");
  const [error, setError] = useState(null);
  const socket = useSocket();

  useEffect(() => {
    if (!jobId) return;

    // 폴링으로 상태 확인
    const checkStatusInterval = setInterval(async () => {
      try {
        const response = await getJobStatus(jobId);
        console.log('Status check response:', response);
        
        if (!response.success) {
          clearInterval(checkStatusInterval);
          setError(response.message || '분석 중 오류가 발생했습니다.');
          return;
        }

        setProgress(response.progress || 0);
        setMessage(response.message || '처리 중...');

        if (response.status === 'done') {
          console.log('Job completed via polling:', response);
          clearInterval(checkStatusInterval);
          onComplete(response);
        } else if (response.status === 'error') {
          clearInterval(checkStatusInterval);
          setError(response.message || '분석 중 오류가 발생했습니다.');
        }
      } catch (error) {
        console.error('상태 확인 중 오류:', error);
      }
    }, 3000);

    return () => clearInterval(checkStatusInterval);
  }, [jobId, onComplete]);

  useEffect(() => {
    if (!socket || !jobId) return;

    socket.emit('join', { jobId });

    const handleProgress = async (data) => {
      console.log('Socket progress event:', data);
      if (data.jobId === jobId) {
        setProgress(data.percent);
        if (data.message) setMessage(data.message);
        
        if (data.percent === 100) {
          try {
            const response = await getJobStatus(jobId);
            console.log('Final status check response:', response);
            if (response.success && response.status === 'done') {
              onComplete(response);
            }
          } catch (error) {
            console.error('결과 확인 중 오류:', error);
            setError('결과를 가져오는 중 오류가 발생했습니다.');
          }
        }
      }
    };

    const handleError = (data) => {
      if (data.jobId === jobId) {
        console.error('Socket error event:', data);
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