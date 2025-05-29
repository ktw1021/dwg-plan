import React from 'react';
import styles from '../styles/common.module.css';
import magnifierIcon from '../assets/step2_image.webp';

const ProgressTracker = ({ 
  progress, 
  message, 
  error, 
  filename 
}) => {
  if (error) {
    return (
      <div className={styles.progressContainer}>
        <div className={styles.error}>{error}</div>
        <p style={{ textAlign: 'center', color: '#666' }}>
          업로드된 파일이름: <span style={{ fontWeight: '500' }}>{filename}</span>
        </p>
      </div>
    );
  }

  return (
    <div className={styles.progressContainer}>
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <img 
          src={magnifierIcon} 
          alt="분석 중" 
          style={{ width: '400px', marginBottom: '20px' }} 
        />
      </div>
      
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <div className={styles.progressBar}>
          <div 
            className={styles.progressFill} 
            style={{ width: `${progress}%` }} 
          />
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