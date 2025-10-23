// src/api/catalog.js
import axios from "axios";
import { BASE_URL } from "./base";

export const CATALOG_API = {
  fetchCatalog: async (params = {}) => {
    const response = await axios.get(`${BASE_URL}/catalog/list`, {
      params,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("token")}`,
      },
    });
    return response.data;
  },
  
  fetchMyCatalog: async (params = {}) => {
    const response = await axios.get(`${BASE_URL}/catalog/my-catalog`, {
      params,
      headers: {
        "Content-Type": "application/json" ,
        "Authorization": `Bearer ${localStorage.getItem("token")}`,
      },
    });
    return response.data;
  },

  fetchFileOptions: async (params = {}) => {
      const response = await axios.get(`${BASE_URL}/catalog/options`, {
        params,
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`,
        },
      });
      return response.data;
    },


  fetchTree: async (params = {}) => {
    const response = await axios.get(`${BASE_URL}/catalog/tree`, {
      params,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("token")}`,
      },
    });
    return response.data;
  },

  advancedQuery: async (queryPayload) => {
    const response = await axios.post(`${BASE_URL}/catalog/advanced`, queryPayload, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("token")}`,
      },
    });
    return response.data;
  },
  
};
