export const showMessage = (toastRef, type, message) => {
    const summaryMap = {
      success: "Success",
      error: "Error",
      info: "Information",
    };
  
    toastRef.current?.show({
      severity: type,
      summary: summaryMap[type] || "Notification",
      detail: message,
      life: 5000,
    });
  };