const API_URL = 'http://localhost:3001/api';

export const endpoints = {
  login: `${API_URL}/auth/login`,
  register: `${API_URL}/auth/register`,
  profile: `${API_URL}/profile`,
  exchange: `${API_URL}/exchange`,
  admin: `${API_URL}/admin`
};

export default API_URL; 