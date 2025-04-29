import axios from 'axios';
import { BASE_URL, defaultHeaders } from './base';

export const VALIDATIONS_API = {

  getAllResults: (params) =>
    axios.get(`${BASE_URL}/validations/results`, {
      params,
      headers: defaultHeaders.json,
    }),

  getResultById: (resultId) =>
    axios.get(`${BASE_URL}/validations/results/${resultId}`, {
      headers: defaultHeaders.json,
    }),

  validateFilesAgainstSuite: (payload) =>
    axios.post(`${BASE_URL}/validations/validate/files-against-suite`, payload, {
      headers: defaultHeaders.json,
    }),

  validateFileAgainstSuites: (payload) =>
    axios.post(`${BASE_URL}/validations/validate/file-against-suites`, payload, {
      headers: defaultHeaders.json,
    }),
    
};
