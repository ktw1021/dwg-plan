import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api/v1';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const uploadFloorplan = async (file, onUploadProgress) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post('/floorplan/upload', formData, {
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
  const response = await api.get(`/floorplan/result/${jobId}`);
  return response.data;
};

export default api; 