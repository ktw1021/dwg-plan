import { useState } from 'react';
import { uploadFloorplan } from '../services/api';

const ALLOWED_FORMATS = ['.dwg', '.jpg', '.jpeg', '.png', '.pdf'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const useFileUpload = (onUploadSuccess) => {
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const validateFile = (file) => {
    const extension = '.' + file.name.split('.').pop().toLowerCase();
    
    if (!ALLOWED_FORMATS.includes(extension)) {
      return '지원되지 않는 파일 형식입니다. DWG, JPG, JPEG, PNG, PDF 파일만 지원됩니다.';
    }
    
    if (file.size > MAX_FILE_SIZE) {
      return '파일 크기는 최대 10MB까지 지원됩니다.';
    }
    
    return null;
  };

  const handleFileSelect = (selectedFile) => {
    const validationError = validateFile(selectedFile);
    if (validationError) {
      setError(validationError);
      return false;
    }
    
    setError(null);
    setFile(selectedFile);
    return true;
  };

  const uploadFile = async () => {
    if (!file) return;
    
    try {
      setIsUploading(true);
      const response = await uploadFloorplan(file, setProgress);
      
      if (response?.jobId) {
        onUploadSuccess(response.jobId);
      } else {
        setError('서버 응답이 올바르지 않습니다.');
        setIsUploading(false);
      }
    } catch (error) {
      let errorMessage = '파일 업로드 중 오류가 발생했습니다.';
      
      if (error.response) {
        // 서버에서 오류 응답을 받은 경우
        errorMessage = error.response.data?.message || `서버 오류 (${error.response.status})`;
      } else if (error.request) {
        // 요청은 보냈지만 응답을 받지 못한 경우
        errorMessage = '서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.';
      } else {
        // 요청 설정 중 오류가 발생한 경우
        errorMessage = error.message;
      }
      
      setError(errorMessage);
      setIsUploading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setProgress(0);
    setError(null);
    setIsUploading(false);
  };

  return {
    file,
    progress,
    error,
    isUploading,
    handleFileSelect,
    uploadFile,
    reset
  };
}; 