// src/pages/BlockchainContracts.jsx
import React, { useRef, useState } from "react";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Tooltip } from "primereact/tooltip";
import { Button } from "primereact/button";
import { useContracts } from "../hooks/useContracts";
import ContractFilters from "../components/ContractFilters";
import ContractEventsDialog from "../components/ContractEventsDialog";
import ContractTxsDialog from "../components/ContractTxsDialog";

function shortAddr(a){ return a ? `${a.slice(0,8)}…${a.slice(-6)}` : ""; }

export default function BlockchainContracts() {
  const { isDarkMode } = useTheme();
  const toast = useToast();
  const tooltipRef = useRef(null);

  const [filters, setFilters] = useState({
    network: [],
    status: [],
    name: [],
    address: [],
  });

  const { contracts, totalRecords, loading, lazyParams, setLazyParams } =
    useContracts(filters, toast);

  const [eventsVisible, setEventsVisible] = useState(false);
  const [txsVisible, setTxsVisible] = useState(false);

  const [selectedContract, setSelectedContract] = useState(null);

  const onPage = (e) => setLazyParams((p) => ({ ...p, first: e.first, rows: e.rows }));
  const onSort = (e) =>
    setLazyParams((p) => ({
      ...p,
      sortField: e.sortField || p.sortField,
      sortOrder: e.sortOrder || p.sortOrder,
    }));

  const tableClass = isDarkMode ? "p-datatable p-datatable-dark" : "p-datatable p-datatable-light";

  return (
    <div className={`dataset-container ${isDarkMode ? "dark-mode" : "light-mode"}`}>
      <h2>Deployed Contracts</h2>
      <Tooltip ref={tooltipRef} />

      <ContractFilters filters={filters} setFilters={setFilters} isDarkMode={isDarkMode} />

      <DataTable
        value={contracts || []}
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
        dataKey="id"
      >
        <Column field="name" header="Name" sortable />
        <Column
          field="address"
          header="Address"
          sortable
          body={(r) => <span title={r.address}>{shortAddr(r.address)}</span>}
        />
        <Column field="network" header="Network" sortable style={{ width: 120 }} />
        <Column field="status" header="Status" sortable style={{ width: 120 }} />
        <Column field="start_block" header="Start" sortable style={{ width: 120 }} />
        <Column field="last_scanned_block" header="Scanned →" sortable style={{ width: 140 }} />
        <Column field="confirmations" header="Conf" sortable style={{ width: 100 }} />
        <Column field="events_count" header="Events" sortable style={{ width: 110 }} />

        <Column
          header="Actions"
          frozen
          alignFrozen="right"
          style={{ width: "13.5rem" }}
          body={(row) => (
            <div className="flex gap-2">
              <Button
                icon="pi pi-history"
                className="p-button-sm p-button-info p-button-text"
                onClick={() => {
                  setSelectedContract(row);
                  setEventsVisible(true);
                }}
                tooltip="View events"
                tooltipOptions={{ position: "top" }}
              />
              <Button
                icon="pi pi-list"
                className="p-button-sm p-button-help p-button-text"
                onClick={() => {
                  setSelectedContract(row);
                  setTxsVisible(true);
                }}
                tooltip="View transactions"
                tooltipOptions={{ position: "top" }}
              />
              <Button
                icon="pi pi-copy"
                className="p-button-sm p-button-secondary p-button-text"
                onClick={() => navigator.clipboard.writeText(row.address)}
                tooltip="Copy address"
                tooltipOptions={{ position: "top" }}
              />
            </div>
          )}
        />

      </DataTable>
      <ContractTxsDialog
        visible={txsVisible}
        onHide={() => setTxsVisible(false)}
        contract={selectedContract}
      />


      <ContractEventsDialog
        visible={eventsVisible}
        onHide={() => setEventsVisible(false)}
        contract={selectedContract}
      />
    </div>
  );
}
