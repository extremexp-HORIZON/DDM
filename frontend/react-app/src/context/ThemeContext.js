import React, { createContext, useContext, useState } from "react";

// Create the ThemeContext
const ThemeContext = createContext();

// Create a provider for the theme context
export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);

  const toggleTheme = () => {
    const nextMode = !isDarkMode;
    setIsDarkMode(nextMode);
  
    // Set theme attribute (e.g., for Bootstrap or others)
    document.body.setAttribute("data-bs-theme", nextMode ? "dark" : "light");
  
    // ✅ Add or remove .dark-mode class on <body>
    document.body.classList.toggle("dark-mode", nextMode);
  };
  
  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Hook to use the ThemeContext
export const useTheme = () => useContext(ThemeContext);
