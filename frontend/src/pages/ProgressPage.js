import React, { useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useProgress } from '../hooks';
import ProgressTracker from '../components/ProgressTracker';
import styles from '../styles/common.module.css';

const ProgressPage = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const uploadedFile = location.state?.file;

  useEffect(() => {
    // 직접 URL 접근 시 파일 정보가 없으면 업로드 페이지로 리다이렉트
    if (!uploadedFile) {
      navigate('/upload', { replace: true });
    }
  }, [uploadedFile, navigate]);

  const handleProcessingComplete = (resultData) => {
    navigate(`/result/${jobId}`, { 
      state: { 
        result: resultData,
        file: uploadedFile // 파일 정보를 결과 페이지로도 전달
      } 
    });
  };

  const { progress, message, error } = useProgress(jobId, handleProcessingComplete);
  const filename = uploadedFile?.name || (jobId?.includes("-") ? jobId.split("-")[0] + ".dwg" : "unknown.dwg");

  if (!uploadedFile) {
    return null; // 리다이렉트 되기 전까지 아무것도 렌더링하지 않음
  }

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