import axios from 'axios';
import { BASE_URL } from './base';

export const VALIDATIONS_API = {

  getAllResults: (params) =>
    axios.get(`${BASE_URL}/validations/results`, {
      params,
        headers: {
        "Content-Type": "application/json" ,
        "Authorization": `Bearer ${localStorage.getItem("token")}`,
      },
    }),

  getResultById: (resultId) =>
    axios.get(`${BASE_URL}/validations/results/${resultId}`, {
      headers: {
        "Content-Type": "application/json" ,
        "Authorization": `Bearer ${localStorage.getItem("token")}`,
      },
    }),

  validateFilesAgainstSuite: (payload) =>
    axios.post(`${BASE_URL}/validations/validate/files-against-suite`, payload, {
      headers: {
        "Content-Type": "application/json" ,
        "Authorization": `Bearer ${localStorage.getItem("token")}`,
      },
    }),

  validateFileAgainstSuites: (payload) =>
    axios.post(`${BASE_URL}/validations/validate/file-against-suites`, payload, {
      headers: {
        "Content-Type": "application/json" ,
        "Authorization": `Bearer ${localStorage.getItem("token")}`,
      },
    }),
    
};
