import React from "react";
import Sidebar from "./Sidebar";

const Layout = ({ children }) => {
  return (
    <div className="layout-container">
      <Sidebar />
      <div className="content-container">
        {children}
      </div>
    </div>
  );
};

export default Layout;
