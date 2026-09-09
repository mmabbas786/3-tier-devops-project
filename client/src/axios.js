// src/axios.js
import axios from 'axios';

const apiBase = (process.env.REACT_APP_API && !process.env.REACT_APP_API.includes('54.87.253.5'))
  ? process.env.REACT_APP_API
  : '/api';

const instance = axios.create({
  baseURL: apiBase,
});

instance.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

export default instance;
