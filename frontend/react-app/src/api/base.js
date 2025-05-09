export const BASE_URL = "http://127.0.0.1/ddm";
export const BASE_AUTH_URL = "http://127.0.0.1:5521";

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
