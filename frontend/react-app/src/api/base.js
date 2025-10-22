const BASE_URL = process.env.REACT_APP_BASE_URL;
const BASE_AUTH_URL = process.env.REACT_APP_BASE_AUTH_URL;

export { BASE_URL, BASE_AUTH_URL };

export const defaultHeaders = {
  json: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${localStorage.getItem("token")}`,
  },
  formData: {
    "Content-Type": "multipart/form-data",
    "Authorization": `Bearer ${localStorage.getItem("token")}`,
  },
};
