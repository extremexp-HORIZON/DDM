// src/api/user.js
import axios from "axios";
import { BASE_URL, defaultHeaders } from "./base";

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
}

};
