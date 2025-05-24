import React, { useRef, useState } from 'react';
import { uploadFloorplan } from '../services/api';
import './FileUpload.css';
import uploadIcon from '../assets/step1_cloud_upload.webp';

const FileUpload = ({ onUploadProgress, onUploadSuccess, progress }) => {
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      validateAndSetFile(selectedFile);
    }
  };
  
  const validateAndSetFile = (file) => {
    // Check file type - support multiple formats
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    const allowedFormats = ['.dwg', '.jpg', '.jpeg', '.png', '.pdf'];
    
    if (!allowedFormats.includes(fileExtension)) {
      setUploadError('지원되지 않는 파일 형식입니다. DWG, JPG, JPEG, PNG, PDF 파일만 지원됩니다.');
      return;
    }
    
    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('파일 크기는 최대 10MB까지 지원됩니다.');
      return;
    }
    
    // Clear any previous errors
    setUploadError(null);
    setFile(file);
  };
  
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };
  
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };
  
  const handleUpload = async () => {
    if (!file) return;
    
    try {
      setIsUploading(true);
      const response = await uploadFloorplan(file, onUploadProgress);
      
      if (response && response.jobId) {
        onUploadSuccess(response.jobId);
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError(error.response?.data?.message || '파일 업로드 중 오류가 발생했습니다.');
      setIsUploading(false);
    }
  };
  
  const handleBrowseClick = () => {
    fileInputRef.current.click();
  };
  
  const getFileTypeInfo = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    switch (ext) {
      case 'dwg':
        return { type: 'CAD 도면', color: '#4CAF50', icon: '📐' };
      case 'jpg':
      case 'jpeg':
        return { type: 'JPEG 이미지', color: '#FF9800', icon: '🖼️' };
      case 'png':
        return { type: 'PNG 이미지', color: '#2196F3', icon: '🖼️' };
      case 'pdf':
        return { type: 'PDF 문서', color: '#F44336', icon: '📄' };
      default:
        return { type: '파일', color: '#666', icon: '📁' };
    }
  };
  
  return (
    <div className="file-upload-container">
      <div className="upload-header">
        <h2>자, 이제 우리 오피스를 만들어볼까요? 가구,<br/>집기들도 모두 포함된 완성형 공간이 준비되어 있습니다</h2>
      </div>
      
      <div className="divider"></div>
      
      <div 
        className={`upload-area ${isDragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleBrowseClick}
      >
        <div className="upload-icon">
          <img src={uploadIcon} alt="Upload" className="cloud-upload-icon" />
        </div>
        
        <div className="upload-text">
          {file ? (
            <div className="file-info">
              <div className="file-icon" style={{ color: getFileTypeInfo(file.name).color }}>
                {getFileTypeInfo(file.name).icon}
              </div>
              <p className="file-name">{file.name}</p>
              <p className="file-type" style={{ color: getFileTypeInfo(file.name).color }}>
                {getFileTypeInfo(file.name).type}
              </p>
            </div>
          ) : (
            <>
              <p className="main-instruction">이곳에 도면 파일을 끌어놓거나, 내 컴퓨터에서 업로드<br/>할 도면 파일을 선택해주세요</p>
              <div className="format-info">
                <p className="upload-info">업로드 가능한 파일 포맷 : DWG, JPG, JPEG, PDF</p>
                <p className="upload-info">최대 파일 크기 : 10mb</p>
              </div>
            </>
          )}
        </div>
        
        <input 
          type="file" 
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".dwg,.jpg,.jpeg,.png,.pdf"
          style={{ display: 'none' }}
        />
      </div>
      
      <div className="divider"></div>
      
      {uploadError && (
        <div className="error-message">
          {uploadError}
        </div>
      )}
      
      {file && !isUploading && (
        <button 
          className="upload-button"
          onClick={handleUpload}
          disabled={isUploading}
        >
          분석 시작하기
        </button>
      )}
      
      {isUploading && (
        <div className="upload-progress">
          <div className="progress-bar">
            <div 
              className="progress-bar-fill" 
              style={{ width: `${progress || 0}%` }}
            ></div>
          </div>
          <span className="progress-text">{progress || 0}%</span>
        </div>
      )}
    </div>
  );
};

export default FileUpload; 