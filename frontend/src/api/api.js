import apiClient from './axios';

// ─── Auth ───
export const authApi = {
  register: (data) => apiClient.post('/auth/register', data),
  login: (data) => apiClient.post('/auth/login', data),
  refresh: () => apiClient.post('/auth/refresh'),
  logout: () => apiClient.post('/auth/logout'),
  me: () => apiClient.get('/auth/me'),
};

// ─── Categories ───
export const categoriesApi = {
  list: () => apiClient.get('/categories'),
  create: (data) => apiClient.post('/categories', data),
  update: (id, data) => apiClient.put(`/categories/${id}`, data),
  delete: (id) => apiClient.delete(`/categories/${id}`),
};

// ─── Suppliers ───
export const suppliersApi = {
  list: () => apiClient.get('/suppliers'),
  create: (data) => apiClient.post('/suppliers', data),
  update: (id, data) => apiClient.put(`/suppliers/${id}`, data),
  delete: (id) => apiClient.delete(`/suppliers/${id}`),
};

// ─── Products ───
export const productsApi = {
  list: (params) => apiClient.get('/products', { params }),
  get: (id) => apiClient.get(`/products/${id}`),
  create: (data) => apiClient.post('/products', data),
  update: (id, data) => apiClient.put(`/products/${id}`, data),
  delete: (id) => apiClient.delete(`/products/${id}`),
  updateStock: (id, data) => apiClient.patch(`/products/${id}/stock`, data),
};

// ─── Sales ───
export const salesApi = {
  record: (data) => apiClient.post('/sales', data),
  list: (params) => apiClient.get('/sales', { params }),
  summary: () => apiClient.get('/sales/summary'),
  byProduct: (productId) => apiClient.get(`/sales/by-product/${productId}`),
};

// ─── Alerts ───
export const alertsApi = {
  list: (type) => apiClient.get('/alerts', { params: type ? { type } : {} }),
  markRead: (id) => apiClient.patch(`/alerts/${id}/read`),
  resolve: (id) => apiClient.patch(`/alerts/${id}/resolve`),
  delete: (id) => apiClient.delete(`/alerts/${id}`),
};

// ─── Predictions ───
export const predictionsApi = {
  list: () => apiClient.get('/predictions'),
  insights: () => apiClient.get('/predictions/insights'),
  product: (id) => apiClient.get(`/predictions/${id}`),
};

// ─── Users ───
export const usersApi = {
  list: () => apiClient.get('/users'),
  updateProfile: (data) => apiClient.put('/users/profile', data),
  changePassword: (data) => apiClient.put('/users/password', data),
  changeRole: (id, role) => apiClient.patch(`/users/${id}/role`, { role }),
};

export default apiClient;
