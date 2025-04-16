import { getSeverity } from './severity';

export const categoryOptions = [
  { label: "Crisis Management", value: "crisis" },
  { label: "Cybersecurity", value: "cybersecurity" },
  { label: "Public Safety", value: "safety" },
  { label: "Mobility", value: "mobility" },
  { label: "Manufacturing", value: "manufacturing" },
  { label: "Other", value: "other" },
];

export const itemTemplate = (option) => {
  const { icon, color, display } = getSeverity(option?.value);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", color: !option ? "#9ca3af" : undefined }}>
      <i className={icon} style={{ color }} />
      <span>{display}</span>
    </div>
  );
};


