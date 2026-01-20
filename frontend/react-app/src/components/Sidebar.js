import { useState, useRef } from "react";
import { Sidebar } from "primereact/sidebar";
import { Button } from "primereact/button";
import { Avatar } from "primereact/avatar";
import { NavLink } from "react-router-dom";
import { Badge } from "primereact/badge";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useMetamaskContext } from "../context/MetamaskContext";
import { useLogout } from "../hooks/useLogout";
import { useUserProfile } from "../hooks/useUserProfile";
import { ProfileDialog } from "./ProfileDialog";
import { OverlayPanel } from "primereact/overlaypanel";
import { useUserNotifications } from "../hooks/useUserNotifications";
import NotificationDetailsDialog from "./NotificationDetailsDialog";
import "../styles/components/NotificationDetailsDialog.css";
import "primereact/resources/themes/lara-light-blue/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";



const CustomSidebar = ({isOpen, setIsOpen}) => {

  const { isAvailable, wallet, connect, disconnect, balance } = useMetamaskContext();

  const { isDarkMode, toggleTheme } = useTheme();
  const { authenticated, user } = useAuth();
  const { logout } = useLogout();
  const [showProfile, setShowProfile] = useState(false);
  const [showBalance, setShowBalance] = useState(true); 
  const { profile } = useUserProfile(user);
  const notifPanelRef = useRef(null); 
  const [selectedNotif, setSelectedNotif] = useState(null);
  const [notifDialogOpen, setNotifDialogOpen] = useState(false);
  const openInExplorer = (value, type, network) => {
  // Build based on your networks
  const base =
    network?.toLowerCase() === "sepolia"
      ? "https://sepolia.etherscan.io"
      : "https://etherscan.io";

    const path = type === "tx" ? `/tx/${value}` : `/address/${value}`;
    window.open(base + path, "_blank", "noopener,noreferrer");
  };



  const {
    notifications,
    unreadCount,
    loading: notifLoading,
    markAsRead,
    markAllAsRead,
  } = useUserNotifications({
    onlyUnread: false,
    limit: 20,
    enabled: !!authenticated,  // 👈 only fetch when logged in
  });

  const renderNotificationLabel = (n) => {
    switch (n.kind) {
      case "suite_created":
        return `New dataset request #${n.suite_id} created`;
      case "reward_claimed":
        return `Reward claimed on suite #${n.suite_id}`;
      case "suite_closed":
        return `Suite #${n.suite_id} closed`;
      case "dataset_registered":
        return `Dataset registered: ${n.dataset_fingerprint?.slice(0, 10)}…`;
      case "dataset_validated":
        return `Dataset validated: ${n.dataset_fingerprint?.slice(0, 10)}…`;
      default:
        return n.kind || "Notification";
    }
  };


  const backgroundColor = isDarkMode ? "#212529" : "#ffffff";
  const textColor = isDarkMode ? "#ffffff" : "#212529"; 

  const links = [
    {
      children: [
        {
          label: "Explore",
          icon: "pi pi-search",
          children: [
            { label: "Catalog", icon: "pi pi-table", to: "/" },
            { label: "My Catalog", icon: "pi pi-inbox", to: "/my-catalog" },
            { label: "Projects", icon: "pi pi-folder", to: "/projects" },
            { label: "Advanced", icon: "pi pi-bolt", to: "/catalog-advanced" }
          ]
        }
      ]
    },
    {
      children: [
        {
          label: "Upload",
          icon: "pi pi-upload",
          children: [
            { label: "Files", icon: "pi pi-file", to: "/upload" },
            { label: "Chunks", icon: "pi pi-cloud-upload", to: "/upload-async" },
            { label: "Links", icon: "pi pi-link", to: "/upload-links" }
          ]
        }
      ]
    },
    
    {
      children: [
        {
          label: "Data Quality",
          icon: "pi pi-star",
          children: [
            { label: "Expectations", icon: "pi pi-sliders-h", to: "/expectation-suites" },
            { label: "Validations", icon: "pi pi-check-square", to: "/validation-results" },
            { label: "Create Request", icon: "pi pi-file-plus", to: "/set-expectations" }
           
          ]
        }
      ]
    },
    {
      children: [
        {
          label: "Web3 Provenance",
          icon: "pi pi-box", 
          children: [
            { label: "Dashboard", icon: "pi pi-ethereum", to: "/suite-requests-dashboard" },
            { label: "Contracts", icon: "pi pi-book", to: "/blockchain/contracts" },
          ] 
        } 
      ]
    },
    
    
    { label: "Policies", icon: "pi pi-lock", to: "/set-policies" },
    { label: "Settings", icon: "pi pi-cog", to: "/parametrics" },

  ];
  const getInitialExpanded = (items) => {
    const expandedState = {};
    items.forEach((item) => {
      if (item.children) {
        item.children.forEach((child) => {
          if (child.children) expandedState[child.label] = true;
        });
      } else if (item.children) {
        if (item.label) expandedState[item.label] = true;
      }
    });
    return expandedState;
  };
  
  const [expanded, setExpanded] = useState(getInitialExpanded(links));

  const toggleExpand = (label) => {
    setExpanded((prev) => ({
      ...prev,
      [label]: !prev[label]
    }));
  };

  const renderMenuItems = (items, level = 0) => {
    return items.map((item, idx) => {
      const hasChildren = !!item.children;
      const isExpanded = expanded[item.label];
      const paddingLeft = `${1 + level * 1.5}rem`;

      return (
        <li key={item.label + idx}>
          {hasChildren ? (
            <>
              <div
                onClick={() => toggleExpand(item.label)}
                className="flex justify-between align-items-center p-2 border-round hover:bg-primary cursor-pointer"
                style={{ color: textColor, paddingLeft }}
              >
                <div className="flex align-items-center gap-2 flex-grow-1">
                  <i className={item.icon}></i>
                  <span style={{ fontWeight: 650 }}>{item.label}</span>
                </div>
                <i className={`pi ${isExpanded ? "pi-chevron-up" : "pi-chevron-down"}`} />
              </div>
              {isExpanded && (
                <ul className="list-none pl-0 ml-3">
                  {renderMenuItems(item.children, level + 1)}
                </ul>
              )}
            </>
          ) : (
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                `flex align-items-center gap-2 p-2 border-round hover:bg-primary text-sm ${
                  isActive ? "bg-primary text-white" : ""
                }`
              }
              style={{
                color: textColor,
                textDecoration: "none",
                paddingLeft
              }}
            >
              <i className={item.icon}></i>
              <span>{item.label}</span>
            </NavLink>
          )}
        </li>
      );
    });
  };

  return (
    <>
      {!isOpen && (
        <Button
          icon="pi pi-bars"
          className="p-button-text"
          onClick={() => setIsOpen(true)}
          tooltip="Navigate"
          style={{ position: "fixed", top: "0rem", left: "0.5rem", zIndex: 1000 }}
        />
      )}
      <ProfileDialog
        visible={showProfile}
        onHide={() => setShowProfile(false)}
        user={user}
      />

      <Sidebar
        visible={isOpen}
        onHide={() => setIsOpen(false)}
        dismissable={false}
        showCloseIcon={false}
        modal={false}
        className="p-sidebar-md"
        style={{
          backgroundColor,
          width: "16rem",
          color: textColor,
          display: "flex",
          flexDirection: "column",
          padding: 0
        }}
        
        header={(
          <div className="flex items-center gap-3 w-full">
            <div className="flex items-center gap-1">
              <img src="/logo-carre.png" alt="Logo" width={60} height={45} />
              <span
                className="text-xl font-bold"
                style={{
                  color: textColor,
                  lineHeight: '1',       // ✅ Reduce vertical padding
                  display: 'inline-flex',
                  alignItems: 'center'   // ✅ Vertically center the text
                }}
              >
                DDM
              </span>

            </div>
            <Button
              icon="pi pi-times"
              onClick={() => setIsOpen(false)}
              className="p-button-rounded p-button-text p-button-plain ml-auto"
              style={{ color: textColor }}
            />
          </div>
        )}

      >

        {/* Navigation */}
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {authenticated  ? (
          <>
        
          {/* Navigation - scrollable */}
          <div style={{ flexGrow: 1, overflowY: "auto" }}>
          <ul className="list-none sidebar-nav-list">
            {links.map((item) =>
              item.children ? renderMenuItems(item.children) : renderMenuItems([item])
            )}
          </ul>
        </div>

          {/* Footer */}
          <div className="px-1 border-top-1 surface-border ">
            <div className="flex flex-column gap-1 mb-1">
              <div className="flex align-items-center gap-2">
              <Avatar
                  image={profile?.profile_pic}
                  label={
                    !profile?.profile_pic && user?.given_name && user?.family_name
                      ? `${user.given_name[0]}${user.family_name[0]}`
                      : "NA"
                  }
                  shape="circle"
                  size="small"
                  style={{ backgroundColor: "#6c757d", color: "#fff", fontWeight: "bold" }}
                />


                <span style={{ color: textColor }}>{user?.preferred_username || "Unknown"}</span>
               <Button
                  icon="pi pi-pencil"
                  className="p-button-rounded p-button-text p-button-sm"
                  style={{ color: "#f1c40f" }}
                  onClick={() => setShowProfile(true)}
                  tooltip="Edit Profile"
                />
                <div className="relative">
                  <Button
                    icon="pi pi-bell"
                    className="p-button-rounded p-button-text p-button-sm"
                    style={{ color: "#3498db" }}
                    tooltip="Notifications"
                    onClick={(e) => notifPanelRef.current?.toggle(e)}
                  />
                  {unreadCount > 0 && (
                    <Badge
                      value={unreadCount > 99 ? "99+" : unreadCount}
                      style={{
                        position: "absolute",
                        top: "-2px",
                        right: "-2px",
                        backgroundColor: isDarkMode ? "#e74c3c" : "#dc3545",
                        color: "#fff",
                        fontSize: "0.65rem",
                        height: "1rem",
                        minWidth: "1rem",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "50%",
                        border: isDarkMode ? "1px solid #fff" : "none",
                        padding: "0 0.3rem",
                        lineHeight: "1rem",
                      }}
                    />
                  )}
                  <OverlayPanel
                    ref={notifPanelRef}
                    dismissable
                    showCloseIcon
                    className="p-shadow-4"
                    style={{ minWidth: "18rem", maxWidth: "22rem" }}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold text-sm">Notifications</span>
                      {unreadCount > 0 && (
                        <Button
                          className="p-button-text p-button-sm text-xs"
                          icon="pi pi-check"
                          label="Mark all as read"
                          onClick={markAllAsRead}
                          tooltip="Mark all notifications as read"
                          tooltipOptions={{ position: "top" }}
                        />
                      )}
                    </div>

                    {notifLoading && (
                      <div className="text-xs text-muted">Loading…</div>
                    )}

                    {!notifLoading && notifications.length === 0 && (
                      <div className="text-xs text-muted">No notifications yet.</div>
                    )}

                    {!notifLoading && notifications.length > 0 && (
                      <div
                        style={{
                          maxHeight: "260px",
                          overflowY: "auto",
                          paddingRight: "0.25rem",
                        }}
                      >
                      {notifications.map((n) => (
                        <div
                          key={n.id}
                          className="flex justify-between items-start mb-2 p-2 border-round"
                          style={{
                            backgroundColor: n.is_read
                              ? (isDarkMode ? "#2c2f33" : "#f8f9fa")
                              : (isDarkMode ? "#3a3f44" : "#e9f5ff"),
                            cursor: "pointer",
                          }}
                          onClick={() => {
                            // ✅ ONLY open dialog
                            setSelectedNotif(n);
                            setNotifDialogOpen(true);
                          }}
                        >
                          <div className="flex flex-column gap-1 text-xs">
                            <span style={{ fontWeight: n.is_read ? 400 : 600 }}>
                              {renderNotificationLabel(n)}
                            </span>
                            {n.network && (
                              <span className="text-muted">
                                {n.network} · {n.contract_address?.slice(0, 8)}…
                              </span>
                            )}
                          </div>

                          <div className="flex align-items-center gap-2">
                            {!n.is_read && (
                              <>
                                <i
                                  className="pi pi-circle-fill"
                                  style={{ fontSize: "0.5rem", color: "#2ecc71" }}
                                />
                                <Button
                                  icon="pi pi-check"
                                  className="p-button-text p-button-sm"
                                  tooltip="Mark as read"
                                  onClick={(e) => {
                                    e.stopPropagation(); // ✅ prevents opening dialog
                                    markAsRead(n.id);    // ✅ mark read ONLY when button clicked
                                  }}
                                />
                              </>
                            )}
                          </div>
                        </div>
                      ))}

                      </div>
                    )}
                  </OverlayPanel>
                </div>

              </div>

              {wallet && (
                <div className="flex justify-content-between align-items-center gap-2 text-xs w-full">
                  <div>{`${wallet.slice(0, 6)}...${wallet.slice(-4)}`}</div>
                  {balance !== null && (
                    <div className="flex align-items-center gap-2">
                      {showBalance ? `${balance} ETH` : "•••••• ETH"}
                      <Button
                        icon={`pi ${showBalance ? "pi-eye-slash" : "pi-eye"}`}
                        className="p-button-rounded p-button-text p-button-sm"
                        onClick={() => setShowBalance(prev => !prev)}
                        tooltip={showBalance ? "Hide Balance" : "Show Balance"}
                        style={{ color: textColor }}
                      />

                    </div>
                  )}
                </div>
              )}

            </div>

            <div className="flex gap-3 justify-content-between">
              <Button
                icon={`pi ${isDarkMode ? "pi-sun" : "pi-moon"}`}
                className="p-button-rounded p-button-text"
                style={{ color: isDarkMode ? "#f1c40f" : "#007bff" }}
                onClick={toggleTheme}
                tooltip={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              />
              {wallet ? (
                <Button
                  icon="pi pi-times"
                  className="p-button-rounded p-button-text"
                  style={{ color: "#6f42c1" }}
                  onClick={disconnect}
                  tooltip={`Disconnect ${wallet.slice(0, 6)}...${wallet.slice(-4)}`}
                />
              ) : (
                <Button
                  icon="pi pi-wallet"
                  className="p-button-rounded p-button-text"
                  style={{ color: "#6f42c1" }}
                  onClick={connect}
                  tooltip={isAvailable ? "Connect MetaMask (Sepolia)" : "Install MetaMask"}
                />
              )}


              <Button
                icon="pi pi-sign-out"
                className="p-button-rounded p-button-text"
                style={{ color: "#dc3545" }}
                onClick={logout}
                tooltip="Logout"
              />
            </div>
          </div>
          </>
          ) : (
          <>
            {/* Minimal view for unauthenticated user */}
            <div className="flex flex-column align-items-center justify-content-center h-full gap-4 p-4">
              <Button
                label="Login"
                icon="pi pi-sign-in"
                className="p-button-rounded p-button-text"
                style={{ color: "#007bff" }}
                onClick={() => window.location.href = "/login"} // Or your login logic
              />
              <Button
                icon={`pi ${isDarkMode ? "pi-sun" : "pi-moon"}`}
                className="p-button-rounded p-button-text"
                style={{ color: isDarkMode ? "#f1c40f" : "#007bff" }}
                onClick={toggleTheme}
                tooltip={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              />
            </div>
          </>
        )}

        </div>
      </Sidebar>
      <NotificationDetailsDialog
        visible={notifDialogOpen}
        notification={selectedNotif}
        isDarkMode={isDarkMode}
        className="notifications-dialog"
        contentClassName="notif-scroll"
        renderLabel={renderNotificationLabel}
        onHide={() => {
          setNotifDialogOpen(false);
          setSelectedNotif(null);
        }}
        openInExplorer={openInExplorer}
        onMarkAsRead={async () => {
          if (!selectedNotif) return;

          await markAsRead(selectedNotif.id);

          // keep dialog in sync
          setSelectedNotif((prev) =>
            prev ? { ...prev, is_read: true, read_at: new Date().toISOString() } : prev
          );
        }}
      />

    </>
  );
};

export default CustomSidebar;
