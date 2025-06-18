import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { BASE_AUTH_URL } from "../api/base";

export const useLogin = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const requestLogin = async () => {
    try {
      const response = await axios.post(`${BASE_AUTH_URL}/extreme_auth/api/v1/person/login`, {
        username,
        password,
      });
      console.log(response.data,response.headers);

      if (response.status === 200) {
        localStorage.setItem("token", response.data.access_token);
        navigate("/");
      }
    } catch (error) {
      console.error("Login failed:", error);
      alert("Invalid credentials or server error.");
    }
  };

  return {
    username,
    setUsername,
    password,
    setPassword,
    requestLogin,
  };
};
