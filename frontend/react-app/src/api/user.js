// src/api/user.js
import axios from "axios";
import { BASE_URL } from "./base";

export const USER_API = {
  // Fetch a single user's profile by username
  fetchUserProfile: async (username) => {
    const response = await axios.get(`${BASE_URL}/users/user/profile/${username}`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    const user = response.data.user;

    return { user };
  },

  // Update a user's public key or profile picture
  updateUserProfile: async (username, formData) => {
    const response = await axios.post(`${BASE_URL}/users/user/profile/${username}`, formData, {
      headers: {
        "Authorization": `Bearer ${localStorage.getItem("token")}`,
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  fetchProfilePicBlob: async (filename) => {
  const response = await axios.get(`${BASE_URL}/users/user/profile_pic/${filename}`, {
    headers: {
      "Authorization": `Bearer ${localStorage.getItem("token")}`,
      "Content-Type": "multipart/form-data",
    },
    
    responseType: "blob", 
  });

  return URL.createObjectURL(response.data);
},


fetchNotifications: async ({ onlyUnread = false, limit = 50 } = {}) => {
    const params = new URLSearchParams();
    if (onlyUnread) params.append("onlyUnread", "true");
    if (limit) params.append("limit", String(limit));

    const response = await axios.get(
      `${BASE_URL}/users/user/notifications?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json",
        },
      }
    );

    // { data, total, unread }
    return response.data;
  },

  markNotificationRead: async (id) => {
    const response = await axios.post(
      `${BASE_URL}/users/user/notifications/${id}/read`,
      {},
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  },

  markAllNotificationsRead: async () => {
    const response = await axios.post(
      `${BASE_URL}/users/user/notifications/mark_all_read`,
      {},
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data;
  },

  fetchPreferredQueries: async ({ limit = 50 } = {}) => {
      const response = await axios.get(
        `${BASE_URL}/users/user/queries`,
        {
          params: { limit },
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
            "Content-Type": "application/json",
          },
        }
      );
      return response.data; // { data: [...], total: n }
    },

    savePreferredQuery: async ({ name = null, query }) => {
      const response = await axios.post(
        `${BASE_URL}/users/user/queries`,
        { name, query },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
            "Content-Type": "application/json",
          },
        }
      );
      return response.data; // { message, query: {...} }
    },

    deletePreferredQuery: async (id) => {
      const response = await axios.post(
        `${BASE_URL}/users/user/queries/${id}/delete`,
        {},
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
            "Content-Type": "application/json",
          },
        }
      );
      return response.data; // { message, id }
    },

};
