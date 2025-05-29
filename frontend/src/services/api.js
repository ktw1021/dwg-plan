/**
 * API 서비스
 * 백엔드와의 통신을 담당하는 서비스 모듈
 */

import axios from 'axios';

// API 기본 URL 설정
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// axios 인스턴스 생성 및 기본 설정
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 요청 인터셉터 추가
api.interceptors.request.use(
  (config) => {
    console.log('API 요청:', {
      method: config.method,
      url: config.url,
      baseURL: config.baseURL,
      fullURL: `${config.baseURL}${config.url}`,
      headers: config.headers
    });
    return config;
  },
  (error) => {
    console.error('API 요청 오류:', error);
    return Promise.reject(error);
  }
);

// 응답 인터셉터 추가
api.interceptors.response.use(
  (response) => {
    console.log('API 응답:', {
      status: response.status,
      data: response.data,
      headers: response.headers
    });
    return response;
  },
  (error) => {
    console.error('API 응답 오류:', {
      message: error.message,
      response: error.response,
      request: error.request,
      config: error.config
    });
    return Promise.reject(error);
  }
);

/**
 * 도면 파일 업로드
 * @param {File} file - 업로드할 도면 파일
 * @param {Function} onProgress - 업로드 진행률 콜백 함수
 * @returns {Promise} 업로드 결과
 */
export const uploadFloorplan = async (file, onProgress) => {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await axios.post(`${API_BASE_URL}/api/dwg/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percentCompleted);
      },
    });

    return response.data;
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
};

/**
 * 작업 상태 조회
 * @param {string} jobId - 작업 ID
 * @returns {Promise} 작업 상태 정보
 */
export const getJobStatus = async (jobId) => {
  const response = await api.get(`/api/dwg/status/${jobId}`);
  return response.data;
};

export default api;