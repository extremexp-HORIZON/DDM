// src/api/tutorials.js
import axios from "axios";
import { BASE_URL } from "./base";

export const TUTORIALS_API = {
  fetchTutorialProgress: async (username, mode = "ui") => {
    try {
      if (!username) {
        throw new Error("Missing username");
      }

      const response = await axios.get(`${BASE_URL}/tutorials/progress`, {
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        params: {
          username,
          mode,
        },
      });

      if (response.status !== 200) {
        throw new Error("Failed to fetch tutorial progress");
      }

      return response.data || {};
    } catch (error) {
      const message =
        error?.response?.data?.error ||          // your backend returns {"error": "..."}
        error?.response?.data?.message ||
        error.message ||
        "Failed to fetch tutorial progress";

      throw new Error(message);
    }
  },
};
