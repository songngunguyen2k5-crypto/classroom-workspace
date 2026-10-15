import axios from 'axios';
import type { ApiResponse } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Interceptor xử lý response chung
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const errorData: ApiResponse = error.response?.data || {
      success: false,
      status: error.response?.status || 500,
      message: error.message || 'Lỗi kết nối máy chủ',
      data: null,
    };
    return Promise.reject(errorData);
  }
);

export default apiClient;
