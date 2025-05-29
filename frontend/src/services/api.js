import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_URL,
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

export const uploadFloorplan = async (file, onUploadProgress) => {
  const formData = new FormData();
  formData.append('file', file);

  console.log('업로드 요청 준비:', {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type
  });

  const response = await api.post('/api/dwg/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      const percentCompleted = Math.round(
        (progressEvent.loaded * 100) / progressEvent.total
      );
      if (onUploadProgress) {
        onUploadProgress(percentCompleted);
      }
    },
  });

  return response.data;
};

export const getFloorplanResult = async (jobId) => {
  const response = await api.get(`/api/dwg/status/${jobId}`);
  return response.data;
};

export default api;