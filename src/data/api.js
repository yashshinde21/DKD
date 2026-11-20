import axios from 'axios';

const API = axios.create({
  baseURL: 'https://dkd-fruits-backend.onrender.com/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default API;