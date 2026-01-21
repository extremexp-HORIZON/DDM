import React, { useState, useRef } from "react";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import { useExpectationSuites } from "../hooks/useExpectationSuites";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Tooltip } from "primereact/tooltip";
import ExpectationSuiteFilters from "../components/ExpectationSuiteFilters";
import { formatDate } from '../utils/dateFormatter';
import { useSupportedFileTypes } from '../hooks/useSupportedFileTypes';
import { itemTemplate } from '../utils/categoryOptions';
import { Button } from "primereact/button"; 
import { getFileIconFromExt } from "../utils/icons";
import ExpecationSuiteViewerDialog from "../components/ExpectationSuiteViewerDialog";
import SuiteRegisterDialog from "../components/SuiteRegisterDialog";
import { Dialog } from "primereact/dialog";
import { Tag } from "primereact/tag"; 
import Big from "big.js";



const fileTypesWithIconsTemplate = (rowData) => {
  if (!rowData.file_types?.length) return null;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
      {rowData.file_types.map((ext, idx) => {
        const icon = getFileIconFromExt(ext);
        const id = `ft-icon-${rowData.id}-${idx}`; // unique id for tooltip target

        return (
          <div
            key={id}
            id={id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "2rem",
              height: "2rem",
              borderRadius: "4px",
              cursor: "default",
            }}
          >
            {icon}
            <Tooltip target={`#${id}`} content={ext} position="top" />
          </div>
        );
      })}
    </div>
  );
};

const formatEth = (weiStr) => {
  if (!weiStr) return "-";
  try {
    const v = Big(weiStr);
    const eth = Number(v) / 1e18;
    return `${eth.toFixed(4)} ETH`;
  } catch {
    return weiStr;
  }
};

const explorerAddressUrl = (network, address) => {
  if (!network || !address) return null;
  if (network === "mainnet") {
    return `https://etherscan.io/address/${address}`;
  }
  return `https://${network}.etherscan.io/address/${address}`;
};


const ExpectationSuites = () => {
  const { isDarkMode } = useTheme();
  const toast = useToast();
  const tooltipRef = useRef(null);
  const [onchainDialogVisible, setOnchainDialogVisible] = useState(false);
  const [onchainDialogSuite, setOnchainDialogSuite] = useState(null); // whole row
  const [onchainDialogRequests, setOnchainDialogRequests] = useState([]);
  const handleOnchainClick = (rowData) => {
    const reqs = Array.isArray(rowData.onchain_requests)
      ? rowData.onchain_requests
      : [];
    setOnchainDialogSuite(rowData);
    setOnchainDialogRequests(reqs);
    setOnchainDialogVisible(true);
  };


  const [filters, setFilters] = useState({
    suite_name: [],
    file_types: [],
    category: [],
    use_case: [],
    user_id: [],
    created_from: null,
    created_to: null,
  });
  const [requestDlgOpen, setRequestDlgOpen] = useState(false);
  const [requestSuitePayload, setRequestSuitePayload] = useState(null);

  const openRequestDialogForRow = (rowData) => {
    // Build suitePayload from rowData shape (adjust as needed)
    const payload = {
      expectation_suite_id: String(rowData.id),
      name: rowData?.suite_name || "",
      description: rowData?.use_case || "",
      category: rowData?.category || "mobility",
      fileFormats: rowData?.file_types || [],
      expectations: rowData?.expectations || [],
      tableExpectations: rowData?.tableExpectations || [],
      selectedExpectations: rowData?.selectedExpectations || [],
    };
    setRequestSuitePayload(payload);
    setRequestDlgOpen(true);
  };


  const [selectedFileTypes, setSelectedFileTypes] = useState([]);
  const [viewDialogVisible, setViewDialogVisible] = useState(false);
  const [selectedSuite, setSelectedSuite] = useState(null);
  const { 
    fileTypes, 
    loading: fileTypesLoading, 
    error: fileTypesError 
  } = useSupportedFileTypes();

  const {
    suites,
    lazyParams,
    setLazyParams,
    loading,
    totalRecords,
  } = useExpectationSuites(filters, toast);


  const tableClass = isDarkMode
    ? "p-datatable p-datatable-dark"
    : "p-datatable p-datatable-light";

  const onPage = (event) => {
    setLazyParams((prev) => ({ ...prev, first: event.first, rows: event.rows }));
  };

  const onSort = (event) => {
    setLazyParams((prev) => ({
      ...prev,
      sortField: event.sortField || prev.sortField,
      sortOrder: event.sortOrder || prev.sortOrder,
    }));
  };

  const handleView = (rowData) => {
    setSelectedSuite(rowData);
    setViewDialogVisible(true);
  };

  const handleDownload = (id) => {
    const result = suites.find((r) => r.id === id);
    if (!result) return;
  
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
  
    const a = document.createElement("a");
    a.href = url;
    a.download = `${result.dataset_name || "expectation_suite"}_${id}.json`;
    a.click();
  
    URL.revokeObjectURL(url);
  };
  
  
 

  return (
    <div className={`dataset-container ${isDarkMode ? "dark-mode" : "light-mode"}`}>
      <h2>Expectation Suites</h2>
      <Tooltip ref={tooltipRef} />
      
      <ExpectationSuiteFilters 
        filters={filters} 
        setFilters={setFilters} 
        selectedFileTypes={selectedFileTypes}
        setSelectedFileTypes={setSelectedFileTypes}
        itemTemplate={itemTemplate}
        fileTypes={fileTypes}
        fileTypesLoading={fileTypesLoading}
        fileTypesError={fileTypesError}
        isDarkMode={isDarkMode}
        />

      <DataTable
        value={suites}
        loading={loading}
        paginator
        lazy
        rows={lazyParams.rows}
        first={lazyParams.first}
        className={tableClass}
        scrollable
        totalRecords={totalRecords}
        sortField={lazyParams.sortField}
        sortOrder={lazyParams.sortOrder}
        onPage={onPage}
        onSort={onSort}
        rowsPerPageOptions={[10, 25, 50]}
        paginatorTemplate="RowsPerPageDropdown FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink"
        currentPageReportTemplate="{first} to {last} of {totalRecords}"
        >
        <Column field="suite_name" header="Suite Name" sortable />

        <Column
          field="category"
          header="Category"
          sortable
          body={(rowData) => itemTemplate({ value: rowData.category })}
        />
        <Column 
          field="file_types" 
          header="File Types" 
          body={fileTypesWithIconsTemplate} 
          sortable 
        />
        <Column 
          field="user_id" 
          header="User ID" 
          sortable 
        />
        <Column 
          field="created" 
          header="Created" 
          body={(rowData) => formatDate(rowData.created)} 
          sortable 
        />
        <Column
          header="Actions"
          body={(rowData) => (
            <div className="flex gap-2">
              <Button
                icon="pi pi-eye"
                className="p-button-sm p-button-info p-button-text"
                onClick={() => handleView(rowData)}
                tooltip="View details"
                tooltipOptions={{ position: "top" }}
              />
              
              <Button
                icon="pi pi-send"
                className="p-button-sm p-button-help p-button-text"
                onClick={() => openRequestDialogForRow(rowData)}
                tooltip="Prepare / Create on-chain"
                tooltipOptions={{ position: "top" }}
              />
              <Button
                icon="pi pi-download"
                className="p-button-sm p-button-success p-button-text"
                onClick={() => handleDownload(rowData.id)}
                tooltip="Download file"
                tooltipOptions={{ position: "top" }}
              />
              <Button
                icon="pi pi-copy"
                className="p-button-sm p-button-secondary p-button-text"
                onClick={() => {
                  navigator.clipboard.writeText(rowData.id)
                    .then(() => {
                      // Optional: toast or feedback
                      console.log("ID copied:", rowData.id);
                    })
                    .catch((err) => {
                      console.error("Failed to copy:", err);
                    });
                }}
                tooltip="Copy ID"
                tooltipOptions={{ position: "top" }}
              />
             {Array.isArray(rowData.onchain_requests) &&
                rowData.onchain_requests.length > 0 && (
                  <Button
                    icon="pi pi-link"
                    className="p-button-sm p-button-warning p-button-text"
                    onClick={() => handleOnchainClick(rowData)}
                    tooltip="View linked on-chain requests"
                    tooltipOptions={{ position: "top" }}
                  />
              )}
            </div>
          )}
          frozen
          alignFrozen="right"
          style={{ width: "10rem" }}
        />

      </DataTable>
      <SuiteRegisterDialog
        visible={requestDlgOpen}
        onHide={() => setRequestDlgOpen(false)}
        network="sepolia"
        suitePayload={requestSuitePayload || {}}
        initialCategoryKey={requestSuitePayload?.category || "mobility"}
        initialFileFormatKey={(requestSuitePayload?.fileFormats?.[0] || "csv")}
        initialBountyEth={0.05}
        initialTotalExpected={10}
        // Here you can choose to allow only backend prepare:
        enableBackend={true}
        enableOnchain={true}  
        onPrepared={() => {
          // optional toast
        }}
      />
      <ExpecationSuiteViewerDialog
        visible={viewDialogVisible}
        onHide={() => setViewDialogVisible(false)}
        suite={selectedSuite}
        isDarkMode={isDarkMode}
      />
      <Dialog
        header={
          onchainDialogSuite
            ? `On-chain Requests for “${onchainDialogSuite.suite_name}”`
            : "On-chain Requests"
        }
        visible={onchainDialogVisible}
        style={{ width: "40rem", maxWidth: "90vw" }}
        modal
        onHide={() => setOnchainDialogVisible(false)}
        contentStyle={{ maxHeight: "70vh", overflowY: "auto" }}
      >
        {!onchainDialogRequests?.length && (
          <p>No on-chain requests found for this suite.</p>
        )}

        {onchainDialogRequests?.map((r, idx) => {
          const addrUrl = explorerAddressUrl(r.network, r.contract_address);
          const isClosed = !!r.is_closed;
          const deadlineDate =
            r.deadline ? new Date(r.deadline * 1000).toLocaleString() : "-";

          return (
            <div
              key={`${r.network}-${r.contract_address}-${r.suite_id || idx}`}
              style={{
                border: "1px solid var(--surface-border, #ddd)",
                borderRadius: 8,
                padding: "0.75rem 1rem",
                marginBottom: "0.75rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <div style={{ fontWeight: 600 }}>
                  Request ID: {r.suite_id ?? "-"}
                </div>
                <Tag
                  value={isClosed ? "Closed" : "Open"}
                  severity={isClosed ? "danger" : "success"}
                />
              </div>

              <div style={{ fontSize: "0.9rem", lineHeight: 1.5 }}>
                <div>
                  <strong>Network:</strong> {r.network}
                </div>
                <div>
                  <strong>Contract:</strong>{" "}
                  {addrUrl ? (
                    <a
                      href={addrUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ textDecoration: "underline" }}
                    >
                      {r.contract_address}
                    </a>
                  ) : (
                    r.contract_address
                  )}
                </div>
                <div>
                  <strong>Bounty:</strong> {formatEth(r.bounty_wei)}
                </div>
                <div>
                  <strong>Total expected datasets:</strong>{" "}
                  {r.total_expected ?? "-"}
                </div>
                <div>
                  <strong>Deadline (on-chain):</strong> {deadlineDate}
                </div>
                <div>
                  <strong>Total claims:</strong> {r.total_claims ?? 0}
                </div>
              </div>
            </div>
          );
        })}
      </Dialog>

    </div>
  );
};

export default ExpectationSuites;
