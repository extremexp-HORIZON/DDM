// src/api/catalog.js
import axios from "axios";
import { BASE_URL } from "./base";

export const CATALOG_API = {
  fetchCatalog: async (params = {}) => {
    const response = await axios.get(`${BASE_URL}/catalog`, {
      params,
      headers: { "Content-Type": "application/json" },
    });
    return response.data;
  },
  fetchMyCatalog: async (params = {}) => {
    const response = await axios.get(`${BASE_URL}/catalog/my-catalog/`, {
      params,
      headers: { "Content-Type": "application/json" },
    });
    return response.data;
  }
};
