import "primereact/resources/themes/lara-light-blue/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";
import "primeflex/primeflex.css";
import React, {useState} from "react";
import {Button} from "primereact/button";
import {InputText} from "primereact/inputtext";
import axios from "axios";
import {BASE_AUTH_URL} from "../api/base";
import {useNavigate} from "react-router-dom";

const LoginPage = () => {
    const navigate = useNavigate();
    const [username, setUsername] = useState(null);
    const [password, setPassword] = useState(null);

    const requestLogin = async () => {
        const data = {
            username: username,
            password: password
        };
        const response = await axios.post(`${BASE_AUTH_URL}/extreme_auth/api/v1/person/login`, data);
        if (response.status === 200) {
            console.log(response);
            const token = response.data["access_token"];
            localStorage.setItem("token", token);
            navigate("/");
        }
    }

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                gap: "15px",
                justifyContent: "center",
                marginTop: "20px",
                width: "100%",
            }}
        >
            <div className="filter-item">
                <label>Username</label>
                <InputText
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={username?.length ? "" : "  Type your username"}
                />
            </div>
            <div className="filter-item">
                <label>Password</label>
                <InputText
                    value={password}
                    type={"password"}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={password?.length ? "" : "  Type your password"}
                />
            </div>
            <div className="filter-item">
                <Button
                    label="Login"
                    className="p-button-rounded p-button-text"
                    style={{ border: "none" }}
                    onClick={requestLogin}
                />
            </div>
        </div>
    );
}

export default LoginPage;