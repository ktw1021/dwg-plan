import React from 'react';
import { useNavigate } from 'react-router-dom';
import FileUpload from '../components/FileUpload';
import { useFileUpload } from '../hooks/useFileUpload';
import styles from '../styles/common.module.css';

const UploadPage = () => {
  const navigate = useNavigate();
  
  const handleUploadSuccess = (jobId) => {
    navigate(`/progress/${jobId}`);
  };

  const {
    file,
    progress,
    error,
    isUploading,
    handleFileSelect,
    uploadFile,
  } = useFileUpload(handleUploadSuccess);

  return (
    <div className={styles.pageContainer}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          자, 이제 우리 오피스를 만들어볼까요?<br/>
          가구, 집기들도 모두 포함된 완성형 공간이 준비되어 있습니다
        </h2>
      </div>
      
      <div className={styles.divider} />
      
      <FileUpload
        file={file}
        error={error}
        progress={progress}
        isUploading={isUploading}
        onFileSelect={handleFileSelect}
        onUpload={uploadFile}
      />
      
      <div className={styles.divider} />
    </div>
  );
};

export default UploadPage; 