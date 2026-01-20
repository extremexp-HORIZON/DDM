import React, { useState, useEffect, useCallback, useRef } from "react";
import { QueryBuilder, formatQuery } from "react-querybuilder";
import { QueryBuilderDnD } from "@react-querybuilder/dnd";
import { QueryBuilderFluent } from "@react-querybuilder/fluent";
import * as ReactDnD from "react-dnd";
import * as ReactDndHtml5Backend from "react-dnd-html5-backend";

import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import { Toast } from "primereact/toast";

import { FluentProvider, webLightTheme, webDarkTheme } from "@fluentui/react-components";

import { useTheme } from "../context/ThemeContext";
import { showMessage } from "../utils/messages";
import { CATALOG_API } from "../api/catalog";
import { USER_API } from "../api/user";
import "../styles/components/file-query-builder.css";


const FileQueryBuilder = () => {
  const { isDarkMode } = useTheme();
  const toastRef = useRef(null);

  const [query, setQuery] = useState({ rules: [] });
  const [savedQueries, setSavedQueries] = useState([]);

  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savedLoading, setSavedLoading] = useState(false);

  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState("");

  // ✅ Fields are now: static + your "virtual" filter fields
  const fields = [
    { name: "filename", label: "Filename", inputType: "text" },
    { name: "file_size", label: "File Size", inputType: "number" },
    { name: "file_type", label: "File Type", inputType: "text" },
    { name: "user_id", label: "User ID", inputType: "text" },
    { name: "project_id", label: "Project ID", inputType: "text" },
    { name: "created", label: "Created", inputType: "date" },
    { name: "path", label: "Path", inputType: "text" },
    { name: "description", label: "Description", inputType: "text" },

    // ✅ Virtual metadata filters (handled in backend parser)
    { name: "__has_column__", label: "Has column", inputType: "text" },
    { name: "__rows__", label: "Row count", inputType: "number" },
    { name: "__stat__", label: "Summary statistic", inputType: "text" }, // we treat value as object via custom value editor later (simple version below)
  ];

  // ✅ Operator config:
  // react-querybuilder expects "name", not "operator" strings sometimes depending on version.
  // Keeping it simple: you can still use default operators for normal fields,
  // and we inject custom operators for our virtual ones.
  const getOperators = (fieldName) => {
    if (fieldName === "__has_column__") {
      return [
        { name: "hasColumn", label: "has" },
        { name: "notHasColumn", label: "does not have" },
      ];
    }
    if (fieldName === "__rows__") {
      return [
        { name: ">", label: ">" },
        { name: ">=", label: ">=" },
        { name: "<", label: "<" },
        { name: "<=", label: "<=" },
        { name: "=", label: "=" },
        { name: "!=", label: "!=" },
      ];
    }
    if (fieldName === "__stat__") {
      return [
        { name: ">", label: ">" },
        { name: ">=", label: ">=" },
        { name: "<", label: "<" },
        { name: "<=", label: "<=" },
        { name: "=", label: "=" },
        { name: "!=", label: "!=" },
        { name: "contains", label: "contains" },
      ];
    }
    return undefined; // use default
  };

  const loadSavedQueries = useCallback(async () => {
    try {
      setSavedLoading(true);
      const res = await USER_API.fetchPreferredQueries({ limit: 50 });
      setSavedQueries(res.data || []);
    } catch (err) {
      console.error(err);
      showMessage(toastRef, "error", "Failed to load saved filters.");
    } finally {
      setSavedLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSavedQueries();
  }, [loadSavedQueries]);

  const openSaveDialog = () => {
    if (!query.rules?.length) {
      showMessage(toastRef, "warn", "No rules to save.");
      return;
    }
    setSaveName(`Filter ${new Date().toLocaleString()}`);
    setSaveDialogOpen(true);
  };

  const confirmSave = async () => {
    const name = (saveName || "").trim();
    if (!name) {
      showMessage(toastRef, "warn", "Please enter a name.");
      return;
    }

    try {
      setSavedLoading(true);
      const res = await USER_API.savePreferredQuery({ name, query });

      const saved = res?.query || res;
      if (saved) setSavedQueries((prev) => [saved, ...prev]);

      setSaveDialogOpen(false);
      showMessage(toastRef, "success", "Filter saved.");
    } catch (err) {
      console.error(err);
      showMessage(toastRef, "error", "Failed to save filter.");
    } finally {
      setSavedLoading(false);
    }
  };

  const handleDeleteQuery = async (id) => {
    try {
      setSavedLoading(true);
      await USER_API.deletePreferredQuery(id);
      setSavedQueries((prev) => prev.filter((q) => q.id !== id));
      showMessage(toastRef, "success", "Filter deleted.");
    } catch (err) {
      console.error(err);
      showMessage(toastRef, "error", "Failed to delete filter.");
    } finally {
      setSavedLoading(false);
    }
  };

  // ✅ IMPORTANT: run query using the query object you want (don’t rely on state)
  const runQuery = async (qObj) => {
    const jsonQuery = formatQuery(qObj, "json_without_ids");
    try {
      setLoading(true);
      const res = await CATALOG_API.advancedQuery(jsonQuery);
      setResults(res);
    } catch (err) {
      console.error(err);
      showMessage(toastRef, "error", "Query failed.");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Apply: setQuery AND run with that exact applied object
  const handleApplyQuery = async (row) => {
    const q = row?.query;
    if (!q) return;

    setQuery(q);
    showMessage(toastRef, "info", "Filter applied & running…");
    await runQuery(q);
  };

  const handleRunQuery = async () => {
    await runQuery(query);
  };

  const handleClear = () => {
    setQuery({ rules: [] });
    setResults([]);
    showMessage(toastRef, "info", "Filter and results cleared.");
  };

  const saveDialogFooter = (
    <div className="flex justify-content-end gap-2">
      <Button
        label="Cancel"
        icon="pi pi-times"
        className="p-button-text"
        onClick={() => setSaveDialogOpen(false)}
        disabled={savedLoading}
      />
      <Button label="Save" icon="pi pi-save" onClick={confirmSave} loading={savedLoading} />
    </div>
  );

  return (
    <FluentProvider theme={isDarkMode ? webDarkTheme : webLightTheme}>
      <div className={`file-query-builder ${isDarkMode ? "dark-theme" : ""}`} style={{ padding: "2rem" }}>
        <Toast ref={toastRef} position="bottom-right" />

        <h2>Build Filter for File Metadata</h2>

        <QueryBuilderDnD dnd={{ ...ReactDnD, ...ReactDndHtml5Backend }}>
          <QueryBuilderFluent>
            <QueryBuilder
              fields={fields}
              query={query}
              onQueryChange={setQuery}
              showCloneButtons
              showNotToggle
              showDragHandle
              resetOnOperatorChange
              controlClassnames={{ queryBuilder: "queryBuilder-branches justifiedLayout" }}
              getOperators={getOperators}
            />
          </QueryBuilderFluent>
        </QueryBuilderDnD>

        <div style={{ marginTop: "1rem", display: "flex", gap: "1rem" }}>
          <Button label="Run Query" icon="pi pi-play" className="p-button-primary" onClick={handleRunQuery} />
          <Button
            label="Save Filter"
            icon="pi pi-save"
            className="p-button-secondary"
            onClick={openSaveDialog}
            loading={savedLoading}
          />
          <Button label="Clear" icon="pi pi-times" className="p-button-danger" onClick={handleClear} />
        </div>

        <Dialog
          header="Save filter"
          visible={saveDialogOpen}
          onHide={() => setSaveDialogOpen(false)}
          style={{ width: "50vw", maxWidth: "780px" }}
          footer={saveDialogFooter}
          modal
        >
          <div className="flex flex-column gap-3">
            <div className="flex flex-column gap-2">
              <label className="text-sm font-semibold">Name</label>
              <InputText value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="e.g. My GPS filters" />
            </div>

            <div>
              <div className="text-sm font-semibold mb-2">Preview</div>
              <pre
                style={{
                  maxHeight: "320px",
                  overflow: "auto",
                  fontSize: "0.75rem",
                  padding: "0.75rem",
                  borderRadius: "8px",
                  background: isDarkMode ? "#1e1e1e" : "#f4f4f4",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {JSON.stringify(query, null, 2)}
              </pre>
            </div>
          </div>
        </Dialog>

        {results.length > 0 && (
          <div style={{ marginTop: "2rem" }}>
            <h3>Query Results</h3>
            <DataTable value={results} loading={loading} paginator rows={10} dataKey="id">
              <Column field="filename" header="Filename" />
              <Column field="file_type" header="Type" />
              <Column field="file_size" header="Size" />
              <Column field="user_id" header="User" />
              <Column field="created" header="Created" />
              <Column
                header="Metadata"
                body={(row) => (
                  <pre style={{ fontSize: "0.75rem", maxHeight: 200, overflow: "auto" }}>
                    {JSON.stringify(row.file_metadata, null, 2)}
                  </pre>
                )}
              />
            </DataTable>
          </div>
        )}

        <div style={{ marginTop: "2rem" }}>
          <h3>Saved Filters</h3>
          <DataTable value={savedQueries} dataKey="id" stripedRows showGridlines loading={savedLoading}>
            <Column field="id" header="ID" style={{ width: "120px" }} />
            <Column field="name" header="Name" style={{ width: "240px" }} />
            <Column
              header="Created"
              style={{ width: "220px" }}
              body={(rowData) => (rowData.created_at ? new Date(rowData.created_at).toLocaleString() : "")}
            />
            <Column
              header="Query"
              body={(rowData) => (
                <pre style={{ fontSize: "0.75rem", maxHeight: "200px", overflowY: "auto" }}>
                  {JSON.stringify(rowData.query, null, 2)}
                </pre>
              )}
            />
            <Column
              header="Actions"
              style={{ width: "160px" }}
              body={(rowData) => (
                <div className="flex gap-2">
                  <Button
                    icon="pi pi-check"
                    className="p-button-sm p-button-secondary"
                    tooltip="Apply & run"
                    tooltipOptions={{ position: "bottom" }}
                    onClick={() => handleApplyQuery(rowData)}
                  />
                  <Button
                    icon="pi pi-trash"
                    className="p-button-danger p-button-sm"
                    tooltip="Delete"
                    tooltipOptions={{ position: "bottom" }}
                    onClick={() => handleDeleteQuery(rowData.id)}
                  />
                </div>
              )}
            />
          </DataTable>
        </div>
      </div>
    </FluentProvider>
  );
};

export default FileQueryBuilder;
