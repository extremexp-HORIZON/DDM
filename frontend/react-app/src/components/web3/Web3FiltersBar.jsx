// components/web3/Web3FiltersBar.jsx
import React from "react";
import { Dropdown } from "primereact/dropdown";
import { InputText } from "primereact/inputtext";

export default function Web3FiltersBar({
  network,
  onChangeNetwork,
  statusFilter,
  onChangeStatusFilter,
  categoryFilter,
  onChangeCategoryFilter,
  categoryOptions,
  fileFormatFilter,
  onChangeFileFormatFilter,
  fileFormatOptions,
  globalFilter,
  onChangeGlobalFilter,
  renderCategoryChip,
  renderFileFormatChip,
}) {
  return (
    <div className="flex justify-between items-center mb-3">
      <div className="flex gap-2 items-center">
        {/* Network */}
        <Dropdown
          value={network}
          options={[
            { label: "sepolia", value: "sepolia" },
            { label: "eth", value: "eth" },
            { label: "polygon", value: "polygon" },
            { label: "ganache", value: "ganache" },
          ]}
          onChange={(e) => onChangeNetwork(e.value)}
          placeholder="Network"
          style={{ minWidth: 140 }}
        />

        {/* Status */}
        <Dropdown
          value={statusFilter}
          options={[
            { label: "All statuses", value: null },
            { label: "Open", value: "open" },
            { label: "Closed", value: "closed" },
            { label: "Expired", value: "expired" },
          ]}
          onChange={(e) => onChangeStatusFilter(e.value)}
          placeholder="Status"
          style={{ minWidth: 150 }}
        />

        {/* Category */}
     
        <Dropdown
            value={categoryFilter}
            options={categoryOptions}
            optionLabel="label"
            // ❌ remove optionValue="value"
            onChange={(e) => onChangeCategoryFilter(e.value)}
            placeholder="Category"
            style={{ minWidth: 160 }}
            showClear
            itemTemplate={(option) =>
                option?.value
                ? renderCategoryChip(option.value)
                : <span>{option.label}</span>
            }
            valueTemplate={(option, props) => {
                if (!option || option.value == null) {
                    return (
                        <span className={props.placeholderClassName}>
                        {props.placeholder}
                        </span>
                    );
                }
            return renderCategoryChip(option.value);
            }}
        />

        {/* File format */}
        <Dropdown
            value={fileFormatFilter}
            options={fileFormatOptions}
            optionLabel="label"
            // ❌ remove optionValue="value"
            onChange={(e) => onChangeFileFormatFilter(e.value)}
            placeholder="File format"
            style={{ minWidth: 160 }}
            showClear
            itemTemplate={(option) =>
                option?.value
                ? renderFileFormatChip(option.value)
                : <span>{option.label}</span>
            }
            valueTemplate={(option, props) => {
                if (!option || option.value == null) {
                    return (
                        <span className={props.placeholderClassName}>
                        {props.placeholder}
                        </span>
                    );
                }
                return renderFileFormatChip(option.value);
            }}
        />


        {/* Global search */}
        <span className="p-input-icon-left">
          <i className="pi pi-search" />
          <InputText
            value={globalFilter}
            onChange={(e) => onChangeGlobalFilter(e.target.value)}
            placeholder="  Search datasets/requests..."
          />
        </span>
      </div>
    </div>
  );
}
