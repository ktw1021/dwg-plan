import React, { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { getFloorplanResult } from '../services/api';
import './ProgressTracker.css';
import magnifierIcon from '../assets/step2_image.webp';

const ProgressTracker = ({ jobId, onProcessingProgress, onProcessingComplete, progress }) => {
  const [error, setError] = useState(null);
  const [message, setMessage] = useState("준비 중...");
  const [filename, setFilename] = useState("");
  const socket = useSocket();
  
  useEffect(() => {
    // Get filename from jobId (in a real app, fetch this from server)
    // Here we're just using a simple extraction or default
    const extractedName = jobId.includes("-") ? 
      jobId.split("-")[0] + ".dwg" : "test.dwg";
    setFilename(extractedName);
    
    // Poll for results in case socket connection fails
    const checkResultInterval = setInterval(async () => {
      try {
        const result = await getFloorplanResult(jobId);
        
        if (result.status === 'done') {
          clearInterval(checkResultInterval);
          onProcessingComplete(result);
        } else if (result.status === 'error') {
          clearInterval(checkResultInterval);
          setError(result.error || '분석 중 오류가 발생했습니다.');
        }
      } catch (error) {
        console.error('Error checking result:', error);
      }
    }, 3000); // Check every 3 seconds
    
    // Clean up interval on unmount
    return () => clearInterval(checkResultInterval);
  }, [jobId, onProcessingComplete]);
  
  useEffect(() => {
    if (!socket) return;
    
    // Join the room for this job
    socket.emit('join', { jobId });
    
    // Listen for progress updates
    socket.on('progress', (data) => {
      if (data.jobId === jobId) {
        onProcessingProgress(data.percent);
        
        // Update message if provided
        if (data.message) {
          setMessage(data.message);
          console.log(`Progress update: ${data.percent}% - ${data.message}`);
        }
        
        // If progress reaches 100%, fetch the result
        if (data.percent === 100) {
          getFloorplanResult(jobId)
            .then(result => {
              if (result.status === 'done') {
                onProcessingComplete(result);
              }
            })
            .catch(error => {
              console.error('Error fetching result:', error);
            });
        }
      }
    });
    
    // Listen for error events
    socket.on('error', (data) => {
      if (data.jobId === jobId) {
        setError(data.message || '분석 중 오류가 발생했습니다.');
      }
    });
    
    // Clean up event listeners on unmount
    return () => {
      socket.off('progress');
      socket.off('error');
    };
  }, [socket, jobId, onProcessingProgress, onProcessingComplete]);
  
  if (error) {
    return (
      <div className="progress-tracker-container">
        <div className="error-message">
          {error}
        </div>
        <p className="error-filename">
          업로드된 파일이름: <span>{filename}</span>
        </p>
      </div>
    );
  }
  
  return (
    <div className="progress-tracker-container">
      <div className="magnifier-container">
        <img src={magnifierIcon} alt="분석 중" className="magnifier-image" />
      </div>
      
      <h2 className="analysis-title">공간을 분석하고 있어요</h2>
      
      <div className="progress-container">
        <div className="progress-bar">
          <div 
            className="progress-bar-fill" 
            style={{ width: `${progress || 0}%` }}
          ></div>
        </div>
        <span className="progress-text">{progress || 0}%</span>
      </div>
      
      <div className="progress-message">
        {message}
      </div>
      
      <p className="upload-filename">
        업로드된 파일이름 : <span>{filename}</span>
      </p>
    </div>
  );
};

export default ProgressTracker; 