import axios from 'axios';
import { BASE_URL} from './base';

export const EXPECTATIONS_API = {
  uploadSample: (formData) =>
    axios.post(`${BASE_URL}/expectations/upload-sample`, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
        Authorization: `Bearer ${localStorage.getItem("token")}`
      }
  }),

  save: (payload) =>
    axios.post(`${BASE_URL}/expectations/suites`, payload, {
        headers: {
          "Content-Type": "application/json" ,
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
      },
    }),

  getAllSuites: (params) =>
    axios.get(`${BASE_URL}/expectations/suites`, {
      params,
        headers: {
        "Content-Type": "application/json" ,
        "Authorization": `Bearer ${localStorage.getItem("token")}`,
      },
    }),

  getSuiteById: (suiteId) =>
    axios.get(`${BASE_URL}/expectations/suites/${suiteId}`, {
        headers: {
        "Content-Type": "application/json" ,
        "Authorization": `Bearer ${localStorage.getItem("token")}`,
      },
    }),

  getAllResults: (params) =>
    axios.get(`${BASE_URL}/expectations/results`, {
      params,
        headers: {
        "Content-Type": "application/json" ,
        "Authorization": `Bearer ${localStorage.getItem("token")}`,
      },
    }),

  getResultById: (resultId) =>
    axios.get(`${BASE_URL}/expectations/results/${resultId}`, {
        headers: {
        "Content-Type": "application/json" ,
        "Authorization": `Bearer ${localStorage.getItem("token")}`,
      },
    }),

  validateFilesAgainstSuite: (payload) =>
    axios.post(`${BASE_URL}/expectations/validate/files-against-suite`, payload, {
       headers: {
        "Content-Type": "application/json" ,
        "Authorization": `Bearer ${localStorage.getItem("token")}`,
      },
    }),

  validateFileAgainstSuites: (payload) =>
    axios.post(`${BASE_URL}/expectations/validate/file-against-suites`, payload, {
        headers: {
        "Content-Type": "application/json" ,
        "Authorization": `Bearer ${localStorage.getItem("token")}`,
      },
    }),
    
};
