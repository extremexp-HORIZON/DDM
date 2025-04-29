import React, { useState } from "react";
import {
  CDBSidebar,
  CDBSidebarContent,
  CDBSidebarFooter,
  CDBSidebarHeader,
  CDBSidebarMenu,
  CDBSidebarMenuItem
} from "cdbreact";
import { NavLink } from "react-router-dom";
import { useTheme } from "../context/ThemeContext"; // Import useTheme
import "../styles/components/sidebar.css"; // Import your CSS file

const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { isDarkMode, toggleTheme } = useTheme(); // Consume the context

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <div className={`sidebar-container ${isCollapsed ? "collapsed" : ""}`}>
      <CDBSidebar
        textColor={isDarkMode ? "#fff" : "#333"}
        backgroundColor={isDarkMode ? "#333" : "#fff"}
        className={`cdb-sidebar ${isDarkMode ? "sidebar-dark" : "sidebar-light"}`}
      >
        <CDBSidebarHeader
          prefix={
            <i
              className="fa fa-bars"
              style={{ cursor: "pointer" }}
              onClick={toggleSidebar}
            ></i>
          }
        >
          {!isCollapsed && (
            <a href="/" className="text-decoration-none" style={{ color: "inherit" }}>
              ExtremeXp-DDM
            </a>
          )}
        </CDBSidebarHeader>
        <CDBSidebarContent>
          <CDBSidebarMenu>
                      <NavLink to="/" activeClassName="activeClicked">
              <CDBSidebarMenuItem
                icon="table"
                textFontSize="14px"
                style={{ color: isDarkMode ? "#fff" : "#333" }}
              >
                {isCollapsed ? "" : "Catalog"}
              </CDBSidebarMenuItem>
            </NavLink>
            <NavLink to="/my-catalog" activeClassName="activeClicked">
              <CDBSidebarMenuItem
                icon="inbox"
                textFontSize="14px"
                style={{ color: isDarkMode ? "#fff" : "#333" }}
              >
                {isCollapsed ? "" : "My Catalog"}
              </CDBSidebarMenuItem>
            </NavLink>
            <NavLink to="/upload" activeClassName="activeClicked">
              <CDBSidebarMenuItem
                icon="upload"
                textFontSize="14px"
                style={{ color: isDarkMode ? "#fff" : "#333" }}
              >
                {isCollapsed ? "" : "Upload Files"}
              </CDBSidebarMenuItem>
            </NavLink>
            <NavLink to="/upload-async" activeClassName="activeClicked">
              <CDBSidebarMenuItem
                icon="cloud-upload-alt"
                textFontSize="14px"
                style={{ color: isDarkMode ? "#fff" : "#333" }}
              >
                {isCollapsed ? "" : "Chunk Upload"}
              </CDBSidebarMenuItem>
            </NavLink>
            <NavLink to="/upload-links" exact="true" activeClassName="activeClicked">
              <CDBSidebarMenuItem
                icon="link"
                textFontSize="14px"
                style={{ color: isDarkMode ? "#fff" : "#333" }}
              >
                {isCollapsed ? "" : "Share Files"}
              </CDBSidebarMenuItem>
            </NavLink>
            <NavLink to="/expectation-suites" exact="true" activeClassName="activeClicked">
              <CDBSidebarMenuItem
                icon="clipboard-list"
                textFontSize="14px"
                style={{ color: isDarkMode ? "#fff" : "#333" }}
              >
                {isCollapsed ? "" : "Expectation Suites"}
              </CDBSidebarMenuItem>
            </NavLink>
            <NavLink to="/set-expectations" exact="true" activeClassName="activeClicked">
              <CDBSidebarMenuItem
                icon="balance-scale"
                textFontSize="14px"
                style={{ color: isDarkMode ? "#fff" : "#333" }}
              >
                {isCollapsed ? "" : "Set Expectations"}
              </CDBSidebarMenuItem>
            </NavLink>
            <NavLink to="/validation-results" exact="true" activeClassName="activeClicked">
              <CDBSidebarMenuItem
                icon="check-circle"
                textFontSize="14px"
                style={{ color: isDarkMode ? "#fff" : "#333" }}
              >
                {isCollapsed ? "" : "Validation Results"}
              </CDBSidebarMenuItem>
            </NavLink>
            <NavLink to="/set-policies" exact="true" activeClassName="activeClicked">
              <CDBSidebarMenuItem
                icon="lock"
                textFontSize="14px"
                style={{ color: isDarkMode ? "#fff" : "#333" }}
              >
                {isCollapsed ? "" : "Set Policies"}
              </CDBSidebarMenuItem>
            </NavLink>
            <NavLink to="/experiment-cards" exact="true" activeClassName="activeClicked">
              <CDBSidebarMenuItem
                icon="flask"
                textFontSize="14px"
                style={{ color: isDarkMode ? "#fff" : "#333" }}
              >
                {isCollapsed ? "" : "Experiment Cards"}
              </CDBSidebarMenuItem>
            </NavLink>
            <NavLink to="/parametrics" activeClassName="activeClicked">
              <CDBSidebarMenuItem
                icon="cog"
                textFontSize="14px"
                style={{ color: isDarkMode ? "#fff" : "#333" }}
              >
                {isCollapsed ? "" : "Settings"}
              </CDBSidebarMenuItem>
            </NavLink>
          </CDBSidebarMenu>
        </CDBSidebarContent>


        {/* Footer with Theme Toggle */}
        <CDBSidebarFooter style={{ textAlign: "center" }}>
          <div
            className="theme-switch-container"
            style={{
              cursor: "pointer",
              transition: "color 0.3s ease",
              color: isDarkMode ? "#f1c40f" : "#007bff",
            }}
            onClick={toggleTheme}
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            <i
              className={`fa ${isDarkMode ? "fa-sun" : "fa-moon"} fa-2x`}
              aria-hidden="true"
            ></i>
          </div>
        </CDBSidebarFooter>
      </CDBSidebar>
    </div>
  );
};

export default Sidebar;
