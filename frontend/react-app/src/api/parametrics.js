import axios from "axios";
import { BASE_URL } from "./base";

export const PARAMETRICS_API = {

    getSupportedFileTypes: async () => {
        try {
            const response = await axios.get(`${BASE_URL}/parametrics/df-supported-file-types`);
        return response.data;
        } catch (error) {
            throw new Error("Failed to fetch supported file types");
        }
    },
  
    getAllSupportedFileTypes: async () => {
        try {
            const response = await axios.get(`${BASE_URL}/parametrics/all-supported-file-types`);
        return response.data;
        } catch (error) {
            throw new Error("Failed to fetch supported file types");
        }
    }
}