import {useNavigate} from "react-router-dom";
import {useEffect} from "react";

const Logout = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // delete token
    delete localStorage.removeItem("token");
    navigate("/login");
  }, [navigate]);
}

export default Logout;