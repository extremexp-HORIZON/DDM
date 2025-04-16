import axios from 'axios';
import { BASE_URL, defaultHeaders } from './base';

export const EXPECTATIONS_API = {

  uploadSample: (formData) =>
    axios.post(`${BASE_URL}/expectations/upload-sample`, formData, {
    headers: defaultHeaders.formData,
  }),

  save: (payload) =>
    axios.post(`${BASE_URL}/expectations/suites`, payload, {
      headers: defaultHeaders.json,
    }),
    
};
