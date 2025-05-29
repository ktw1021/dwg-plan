import React from 'react';
import { useProgress } from '../hooks';
import styles from '../styles/common.module.css';
import magnifierIcon from '../assets/step2_image.webp';

const ProgressTracker = ({ jobId, onProcessingComplete }) => {
  const { progress, message, error } = useProgress(jobId, onProcessingComplete);
  
  const filename = jobId?.includes("-") ? jobId.split("-")[0] + ".dwg" : "test.dwg";

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>{error}</div>
        <p style={{ textAlign: 'center', color: '#666' }}>
          업로드된 파일이름: <span style={{ fontWeight: '500' }}>{filename}</span>
        </p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <img src={magnifierIcon} alt="분석 중" style={{ width: '80px', height: '80px', marginBottom: '20px' }} />
        <h2 className={styles.title}>공간을 분석하고 있어요</h2>
      </div>
      
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>
        <span style={{ fontSize: '18px', fontWeight: '500' }}>{progress}%</span>
      </div>
      
      <div style={{ textAlign: 'center', marginBottom: '20px', color: '#666' }}>
        {message}
      </div>
      
      <p style={{ textAlign: 'center', color: '#666' }}>
        업로드된 파일이름 : <span style={{ fontWeight: '500' }}>{filename}</span>
      </p>
    </div>
  );
};

export default ProgressTracker; 