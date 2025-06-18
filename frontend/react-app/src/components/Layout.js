import React, { useState } from "react";
import CustomSidebar from "./Sidebar";

const Layout = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="layout-container flex">
      <CustomSidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div
        className="content-container transition-all duration-300"
        style={{
          marginLeft: isSidebarOpen ? "16rem" : "3.5rem", // match sidebar width
          width: `calc(100% - ${isSidebarOpen ? "16rem" : "3.5rem"})`,
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default Layout;
