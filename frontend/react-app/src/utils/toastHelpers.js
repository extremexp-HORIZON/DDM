export const showError = (toastRef, summary, err) => {
  const msg =
    err?.response?.data?.message ||
    err?.response?.data?.error ||
    err?.message ||
    String(err);

  toastRef.current?.show({ severity: "error", summary, detail: msg });
};

export const showSuccess = (toastRef, summary, detail) => {
  toastRef.current?.show({ severity: "success", summary, detail });
};
