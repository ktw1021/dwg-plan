import { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { getJobStatus } from '../services/api';

export const useProgress = (jobId, onComplete) => {
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("준비 중...");
  const [error, setError] = useState(null);
  const socket = useSocket();

  // 폴링으로 상태 확인
  useEffect(() => {
    if (!jobId) return;

    const checkStatus = async () => {
      try {
        const response = await getJobStatus(jobId);
        if (!response.success) {
          setError(response.message || '분석 중 오류가 발생했습니다.');
          return;
        }

        setProgress(response.progress || 0);
        setMessage(response.message || '처리 중...');

        if (response.status === 'done') {
          onComplete(response);
        } else if (response.status === 'error') {
          setError(response.message || '분석 중 오류가 발생했습니다.');
        }
      } catch (error) {
        console.error('상태 확인 중 오류:', error);
      }
    };

    const interval = setInterval(checkStatus, 3000);
    checkStatus(); // 초기 상태 확인

    return () => clearInterval(interval);
  }, [jobId, onComplete]);

  // 소켓 이벤트 처리
  useEffect(() => {
    if (!socket || !jobId) return;

    console.log('Joining room for job:', jobId);
    socket.emit('join', { jobId });

    const handleProgress = (data) => {
      if (data.jobId === jobId) {
        setProgress(data.percent || 0);
        if (data.message) setMessage(data.message);
        
        if (data.percent === 100) {
          getJobStatus(jobId)
            .then(response => {
              if (response.success && response.status === 'done') {
                onComplete(response);
              }
            })
            .catch(error => {
              console.error('결과 확인 중 오류:', error);
            });
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