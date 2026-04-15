import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const apiClient = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor – attach access token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('ss_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor – refresh on 401
let isRefreshing = false;
let queue = [];

apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          queue.push({ resolve, reject });
        }).then((token) => {
          original.headers.Authorization = `Bearer ${token}`;
          return apiClient(original);
        });
      }
      original._retry = true;
      isRefreshing = true;
      try {
        const { data } = await axios.post(`${BACKEND_URL}/api/auth/refresh`, {}, { withCredentials: true });
        const newToken = data.data?.access_token;
        if (newToken) {
          localStorage.setItem('ss_token', newToken);
          queue.forEach(({ resolve }) => resolve(newToken));
          queue = [];
          original.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(original);
        }
      } catch {
        queue.forEach(({ reject }) => reject(error));
        queue = [];
        localStorage.removeItem('ss_token');
        localStorage.removeItem('ss_user');
        window.location.href = '/login';
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;
