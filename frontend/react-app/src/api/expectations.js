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

  getAllSuites: (params) =>
    axios.get(`${BASE_URL}/expectations/suites`, {
      params,
      headers: defaultHeaders.json,
    }),

  getSuiteById: (suiteId) =>
    axios.get(`${BASE_URL}/expectations/suites/${suiteId}`, {
      headers: defaultHeaders.json,
    }),

  getAllResults: (params) =>
    axios.get(`${BASE_URL}/expectations/results`, {
      params,
      headers: defaultHeaders.json,
    }),

  getResultById: (resultId) =>
    axios.get(`${BASE_URL}/expectations/results/${resultId}`, {
      headers: defaultHeaders.json,
    }),

  validateFilesAgainstSuite: (payload) =>
    axios.post(`${BASE_URL}/expectations/validate/files-against-suite`, payload, {
      headers: defaultHeaders.json,
    }),

  validateFileAgainstSuites: (payload) =>
    axios.post(`${BASE_URL}/expectations/validate/file-against-suites`, payload, {
      headers: defaultHeaders.json,
    }),
    
};
