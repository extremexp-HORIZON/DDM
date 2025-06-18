import React, { createContext, useContext } from "react";
import { useMetamask as useMetamaskHook } from "../hooks/useMetamask";

const MetamaskContext = createContext(null);

export const MetamaskProvider = ({ children }) => {
  const metamask = useMetamaskHook();

  return (
    <MetamaskContext.Provider value={metamask}>
      {children}
    </MetamaskContext.Provider>
  );
};

export const useMetamaskContext = () => {
  const context = useContext(MetamaskContext);
  if (!context) {
    throw new Error("useMetamaskContext must be used within a MetamaskProvider");
  }
  return context;
};
