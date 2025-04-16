export const getSeverity = (value) => {
  if (!value) {
    return {
      display: "Select Category",
      severity: "info",
      color: "#457b9d",
      icon: "pi pi-tag",
    };
  }

  const normalized = value.toLowerCase();

  const severityMap = {
    // Categories
    crisis: {
      display: "Crisis Management",
      severity: "danger",
      color: "#e63946",
      icon: "pi pi-exclamation-triangle",
    },
    cybersecurity: {
      display: "Cybersecurity",
      severity: "success",
      color: "#2a9d8f",
      icon: "pi pi-shield",
    },
    safety: {
      display: "Public Safety",
      severity: "warning",
      color: "#ffb703",
      icon: "pi pi-users",
    },
    mobility: {
      display: "Mobility",
      severity: "info",
      color: "#457b9d",
      icon: "pi pi-car",
    },
    manufacturing: {
      display: "Manufacturing",
      severity: "secondary",
      color: "#8a5a44",
      icon: "pi pi-cog",
    },

    // Use cases mapped to categories
    i2cat: {
      display: "I2CAT",
      severity: "warning",
      color: "#ffb703",
      icon: "pi pi-shield",
    },
    ideko: {
      display: "IDEKO",
      severity: "secondary",
      color: "#8a5a44",
      icon: "pi pi-cog",
    },
    moby: {
      display: "MOBY",
      severity: "info",
      color: "#457b9d",
      icon: "pi pi-car",
    },
    csgroup: {
      display: "CSGROUP",
      severity: "success",
      color: "#2a9d8f",
      icon: "pi pi-microchip-ai",
    },
    airbus: {
      display: "AIRBUS",
      severity: "danger",
      color: "#e63946",
      icon: "pi pi-exclamation-triangle",
    },
  };

  return severityMap[normalized] || {
    display: value,
    severity: "info",
    color: "#457b9d",
    icon: "pi pi-tag",
  };
};
