import {createContext, useContext, useEffect, useState} from "react";
import {useNavigate} from "react-router-dom";
import {BASE_AUTH_URL} from "../api/base";

const AuthContext = createContext(null);

export const AuthProvider = ({children}) => {
    const navigate = useNavigate();
    const [authenticated, setAuthenticated] = useState(null); // null = loading, false = rejected, true = ok

    useEffect(() => {
        console.log("Get user authenticated", localStorage.getItem('token'));
        const token = localStorage.getItem('token');

        if (!token) {
            navigate('/login', {replace: true});
            setAuthenticated(false);
            return;
        }

        // Validate token with backend
        fetch(BASE_AUTH_URL + '/extreme_auth/api/v1/person/userinfo', {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })
            .then(res => {
                if (!res.ok) throw new Error('Invalid token');
                return res.json();
            })
            .then(() => {
                setAuthenticated(true);
            })
            .catch(() => {
                localStorage.removeItem('token');
                setAuthenticated(false);
                navigate('/login', {replace: true});
            });
    }, [navigate]);

    if (authenticated === null) {
        return <div>Loading...</div>; // Or a loading spinner
    }

    return (
        <AuthContext.Provider value={{ authenticated }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);