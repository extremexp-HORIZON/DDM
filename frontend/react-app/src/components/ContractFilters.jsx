// src/components/ContractFilters.jsx
import React from "react";
import { MultiSelect } from "primereact/multiselect";
import { InputText } from "primereact/inputtext";
import { InputNumber } from "primereact/inputnumber";
import "../styles/components/contract_filters.css";

const networkOptions = ["sepolia","mainnet","besu private","polygon"].map(n => ({ label:n, value:n }));
const statusOptions = ["active","paused","error"].map(s => ({ label:s, value:s }));

export default function ContractFilters({ filters, setFilters, isDarkMode }) {
  return (
    <div className="filters-row">
      <MultiSelect
        value={filters.network}
        options={networkOptions}
        onChange={(e) => setFilters(f => ({ ...f, network: e.value || [] }))}
        placeholder="Network"
        display="comma"            // <- prevents big chips stretching height
        maxSelectedLabels={1}      // <- stays one line
        className="w-full"
        panelHeaderTemplate={null}
      />

      <MultiSelect
        value={filters.status}
        options={statusOptions}
        onChange={(e) => setFilters(f => ({ ...f, status: e.value || [] }))}
        placeholder="Status"
        display="comma"
        maxSelectedLabels={1}
        className="w-full"
        panelHeaderTemplate={null}
      />

      <InputText
        value={(filters.name && filters.name[0]) || ""}
        onChange={(e) => {
          const v = e.target.value?.trim();
          setFilters(f => ({ ...f, name: v ? [v] : [] }));
        }}
        placeholder="Name contains…"
        className="w-full"
      />

      <InputText
        value={(filters.address && filters.address[0]) || ""}
        onChange={(e) => {
          const v = e.target.value?.trim();
          setFilters(f => ({ ...f, address: v ? [v] : [] }));
        }}
        placeholder="Address (0x…)"
        className="w-full"
      />

      <InputNumber
        placeholder="Block from"
        value={filters.block_from ?? null}
        onValueChange={(e) =>
          setFilters(f => ({ ...f, block_from: e.value ?? null }))
        }
        className="w-full"
        inputClassName="w-full"
      />

      <InputNumber
        placeholder="Block to"
        value={filters.block_to ?? null}
        onValueChange={(e) =>
          setFilters(f => ({ ...f, block_to: e.value ?? null }))
        }
        className="w-full"
        inputClassName="w-full"
      />
    </div>

  );
}
