import axios from 'axios';

const api = axios.create({
  baseURL: '',        // Vite will proxy /api → http://localhost:5000
  timeout: 10000,
});

// Automatically attach the JWT from localStorage
api.interceptors.request.use(config => {
  // JWT token
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;

    // Add user email address to header information
  const userStr = localStorage.getItem('user');
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      if (user?.email) {
        config.headers['x-user-email'] = user.email;
      }
    } catch (e) {
      console.error('Unable to parse stored user information', e);
    }
  }

  return config;
});

api.interceptors.request.use(config => {
  // JWT token
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;

  const userStr = localStorage.getItem('user');
  if (userStr) {
    try {
      const user = JSON.parse(userStr);
      if (user?.email) {
        config.headers['x-user-email'] = user.email.toLowerCase();
      }
    } catch (e) {
      console.error('Unable to parse stored user information', e);
    }
  }

  return config;
});

export default api;
