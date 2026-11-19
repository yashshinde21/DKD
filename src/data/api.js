
import axios from 'axios';

const API = axios.create({
  baseURL: 'http://10.194.194.102:5050/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export default API;
