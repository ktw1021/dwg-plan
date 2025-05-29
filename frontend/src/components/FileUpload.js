import React from 'react';
import styles from '../styles/common.module.css';
import uploadIcon from '../assets/step1_cloud_upload.webp';
import { getFileTypeInfo } from '../utils/fileUtils';

const FileUpload = ({ 
  onFileSelect,
  file = null,
  error = null,
  isUploading = false,
  progress = 0,
  onUpload
}) => {
  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length > 0) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  return (
    <div className={styles.uploadContainer}>
      <div 
        className={styles.dropzone}
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
        onClick={() => document.getElementById('fileInput').click()}
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
          id="fileInput"
          type="file" 
          onChange={(e) => {
            if (e.target.files?.[0]) {
              onFileSelect(e.target.files[0]);
            }
          }}
          accept=".dwg,.jpg,.jpeg,.png,.pdf"
          style={{ display: 'none' }}
        />
      </div>
      
      {error && (
        <div className={styles.error} style={{ textAlign: 'center', marginTop: '20px' }}>
          {error}
        </div>
      )}
      
      {file && !isUploading && (
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button 
            className={styles.button} 
            onClick={onUpload}
            disabled={isUploading}
          >
            분석 시작하기
          </button>
        </div>
      )}
      
      {isUploading && (
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
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