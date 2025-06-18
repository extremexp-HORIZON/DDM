import "primereact/resources/themes/lara-light-blue/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";
import "primeflex/primeflex.css";
import React from "react";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { useLogin } from "../hooks/useLogin";

const LoginPage = () => {
  const { username, setUsername, password, setPassword, requestLogin } = useLogin();

  return (
    <div className="flex justify-content-center align-items-center min-h-screen">
      <Card
        title={
          <div className="flex flex-column align-items-center">
            <img src="/logo-carre.png" alt="Logo" style={{ width: 80, marginBottom: "1rem" }} />
            <h3 className="m-0">Login to ExtremeXP</h3>
          </div>
        }
        className="shadow-4 p-4"
        style={{ width: "400px" }}
      >
      <div className="field mb-3">
        <label htmlFor="username" className="block mb-2 flex align-items-center gap-2">
          <i className="pi pi-user" />
          <span>Username</span>
        </label>
        <InputText
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full"
        />
      </div>

      <div className="field mb-3">
        <label htmlFor="password" className="block mb-2 flex align-items-center gap-2">
          <i className="pi pi-lock" />
          <span>Password</span>
        </label>
        <InputText
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full"
        />
      </div>

        <Button
          label="Login"
          icon="pi pi-sign-in"
          className="w-full"
          onClick={requestLogin}
        />
      </Card>
    </div>
  );
};

export default LoginPage;
