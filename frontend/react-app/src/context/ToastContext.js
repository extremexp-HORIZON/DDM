// src/context/ToastContext.js
import React, { createContext, useContext, useRef } from "react";
import { Toast } from "primereact/toast";

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const toastRef = useRef(null);

  return (
    <ToastContext.Provider value={toastRef}>
      <>
        <Toast ref={toastRef} position="bottom-right" />
        {children}
      </>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
