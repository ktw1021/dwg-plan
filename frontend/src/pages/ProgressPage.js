import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProgress } from '../hooks';
import ProgressTracker from '../components/ProgressTracker';
import styles from '../styles/common.module.css';

const ProgressPage = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();

  const handleProcessingComplete = (resultData) => {
    navigate(`/result/${jobId}`, { state: { result: resultData } });
  };

  const { progress, message, error } = useProgress(jobId, handleProcessingComplete);
  const filename = jobId?.includes("-") ? jobId.split("-")[0] + ".dwg" : "test.dwg";

  return (
    <div className={styles.pageContainer}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          공간을 분석하고 있어요<br/>
          잠시만 기다려주세요
        </h2>
      </div>
      
      <div className={styles.divider} />
      
      <ProgressTracker 
        progress={progress}
        message={message}
        error={error}
        filename={filename}
      />
      
      <div className={styles.divider} />
    </div>
  );
};

export default ProgressPage; 