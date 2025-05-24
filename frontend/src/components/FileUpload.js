import React, { useRef } from 'react';
import { useFileUpload } from '../hooks/useFileUpload';
import { getFileTypeInfo } from '../utils/fileUtils';
import styles from '../styles/common.module.css';
import uploadIcon from '../assets/step1_cloud_upload.webp';

const FileUpload = ({ onUploadSuccess }) => {
  const fileInputRef = useRef(null);
  const { file, progress, error, isUploading, handleFileSelect, uploadFile } = useFileUpload(onUploadSuccess);

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    if (e.target.files?.[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>
          자, 이제 우리 오피스를 만들어볼까요?<br/>
          가구, 집기들도 모두 포함된 완성형 공간이 준비되어 있습니다
        </h2>
      </div>
      
      <div className={styles.divider} />
      
      <div 
        style={{
          border: '2px dashed #ddd',
          borderRadius: '12px',
          padding: '40px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          background: file ? '#f8f9fa' : 'white'
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={handleBrowseClick}
      >
        <div style={{ marginBottom: '20px' }}>
          <img src={uploadIcon} alt="Upload" style={{ width: '60px', height: '60px' }} />
        </div>
        
        {file ? (
          <div>
            <div style={{ fontSize: '24px', marginBottom: '8px', color: getFileTypeInfo(file.name).color }}>
              {getFileTypeInfo(file.name).icon}
            </div>
            <p style={{ fontWeight: '500', margin: '8px 0' }}>{file.name}</p>
            <p style={{ color: getFileTypeInfo(file.name).color, margin: 0 }}>
              {getFileTypeInfo(file.name).type}
            </p>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: '18px', marginBottom: '16px', color: '#333' }}>
              이곳에 도면 파일을 끌어놓거나, 내 컴퓨터에서 업로드<br/>
              할 도면 파일을 선택해주세요
            </p>
            <div style={{ color: '#666', fontSize: '14px' }}>
              <p>업로드 가능한 파일 포맷 : DWG, JPG, JPEG, PNG, PDF</p>
              <p>최대 파일 크기 : 10MB</p>
            </div>
          </div>
        )}
        
        <input 
          type="file" 
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".dwg,.jpg,.jpeg,.png,.pdf"
          style={{ display: 'none' }}
        />
      </div>
      
      <div className={styles.divider} />
      
      {error && <div className={styles.error}>{error}</div>}
      
      {file && !isUploading && (
        <div style={{ textAlign: 'center' }}>
          <button className={styles.button} onClick={uploadFile}>
            분석 시작하기
          </button>
        </div>
      )}
      
      {isUploading && (
        <div style={{ textAlign: 'center' }}>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${progress}%` }} />
          </div>
          <span>{progress}%</span>
        </div>
      )}
    </div>
  );
};

export default FileUpload; 