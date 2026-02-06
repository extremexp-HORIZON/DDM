import React, { useState } from "react";
import { Card } from "primereact/card";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import { Tooltip } from "primereact/tooltip";
import { formatDate } from "../utils/dateFormatter";
import DoughnutStatsChart from './charts/DoughnutStatsChart';
import ColumnExpectationBarChart from './charts/ColumnExpectationBarChart';
import TableExpectationBarChart from './charts/TableExpectationBarChart'; 
import ExpectationRadarPassedTotalChart from './charts/ExpectationRadarPassedTotalChart'; 

import {
    tableCategoryOptions,
    columnCategoryOptions,
    categoryOptionTemplate,
    selectedCategoryTemplate,
    statusOptions,
    statusOptionTemplate,
    selectedStatusTemplate,
    renderExpectationType
} from "../utils/expectationHelpers";



const ValidationResultsViewer = ({ result, isDarkMode }) => {
    const [selectedColumn, setSelectedColumn] = useState(null);

    const [selectedColumnCategory, setSelectedColumnCategory] = useState(null);
    const [selectedTableCategory, setSelectedTableCategory] = useState(null);
    const [selectedTableStatus, setSelectedTableStatus] = useState(null);
    const [selectedColumnStatus, setSelectedColumnStatus] = useState(null);

    
    const meta = result.detailed_results?.meta || {};
    const descriptions = result.column_descriptions || {};
    const results = result.detailed_results?.results || [];
    const statistics = result.detailed_results?.statistics || {};

    const tableExpectations = results.filter((r) => !r.expectation_config.kwargs?.column);
    const columnExpectations = results.filter((r) => r.expectation_config.kwargs?.column);

    const filteredTableExpectations = tableExpectations.filter((r) => {
        const expectationType = r.expectation_config?.type;
        const category = result.expectation_descriptions?.[expectationType]?.category;
        const matchesCategory = !selectedTableCategory || category === selectedTableCategory;
        const matchesStatus = selectedTableStatus == null || r.success === selectedTableStatus;
        return matchesCategory && matchesStatus;
    });
    
    const filteredColumnExpectations = columnExpectations.filter((r) => {
        const expectationType = r.expectation_config?.type;
        const category = result.expectation_descriptions?.[expectationType]?.category;
        const matchesColumn = !selectedColumn || r.expectation_config?.kwargs?.column === selectedColumn;
        const matchesCategory = !selectedColumnCategory || category === selectedColumnCategory;
        const matchesStatus = selectedColumnStatus == null || r.success === selectedColumnStatus;
        return matchesColumn && matchesCategory && matchesStatus;
    });
    
     

    const columnOptions = Object.keys(descriptions).map((key) => ({
        label: `${key} - ${descriptions[key]}`,   // Column name + description
        value: key,
    }));
        


    const renderArguments = (rowData) => {
        const args = rowData.expectation_config?.kwargs || {};
        return (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                {Object.entries(args)
                    .filter(([k]) => k !== "batch_id")
                    .map(([k, v], idx) => (
                        <div key={idx}>
                            {k}: {String(v)}
                        </div>
                    ))
                }
            </div>
        );
    };
    
    
    const isPrimitive = (v) =>
        v == null || typeof v === "string" || typeof v === "number" || typeof v === "boolean";

    const safeStr = (v) => {
        if (v === undefined) return "";
        if (v === null) return "null";
        if (isPrimitive(v)) return String(v);
        try {
            return JSON.stringify(v);
        } catch {
            return String(v);
        }
    };

    const truncate = (s, n = 120) => (s.length > n ? s.slice(0, n) + "…" : s);

    const renderResult = (rowData) => {
        const r = rowData?.result || {};
        const type = rowData?.expectation_config?.type || "";

    // 1) Column-set / validity style expectations (usually the most useful for FAIL)
        if (r.unexpected_count !== undefined || r.unexpected_percent !== undefined) {
            const parts = [];

            if (r.missing_count !== undefined) parts.push(`missing: ${r.missing_count} (${(r.missing_percent ?? 0).toFixed?.(2) ?? r.missing_percent}%)`);
            if (r.unexpected_count !== undefined) parts.push(`unexpected: ${r.unexpected_count} (${(r.unexpected_percent ?? 0).toFixed?.(2) ?? r.unexpected_percent}%)`);

            // Show a small sample of unexpected values (nulls too)
            const sample = Array.isArray(r.partial_unexpected_list) ? r.partial_unexpected_list.slice(0, 8) : [];
            if (sample.length) parts.push(`sample: ${truncate(safeStr(sample), 80)}`);

            return parts.length ? parts.join(" • ") : "—";
        }

        // 2) Schema mismatch expectations
        if (r.details?.mismatched && Array.isArray(r.details.mismatched)) {
            const sample = r.details.mismatched.slice(0, 2).map((m) => `${m.Found}≠${m.Expected ?? "∅"} @${m["Expected Column Position"]}`);
            return `mismatched: ${sample.join(" • ")}${r.details.mismatched.length > 2 ? " • …" : ""}`;
        }

        // 3) Observed value (number/string/array/object)
        if (r.observed_value !== undefined) {
            // arrays (like observed columns list)
            if (Array.isArray(r.observed_value)) {
            return `Observed: ${truncate(r.observed_value.join(", "), 120)}`;
            }
            // objects
            if (typeof r.observed_value === "object" && r.observed_value !== null) {
            return `Observed: ${truncate(safeStr(r.observed_value), 140)}`;
            }
            // primitive
            return `Observed: ${safeStr(r.observed_value)}`;
        }

        // 4) If GE returned a generic "details" object, show a short preview
        if (r.details && typeof r.details === "object") {
            return truncate(`Details: ${safeStr(r.details)}`, 160);
        }

        // 5) Fallback: show something if result has keys
        const keys = Object.keys(r);
        if (keys.length) return truncate(safeStr(r), 160);

        return "—";
    };

        

    return (
        <div className="p-4">
            <Tooltip target=".expectation-tooltip" position="top" />
            <Tooltip target=".expectation-doc-link" position="top" />
        

        {/* Main Card with Pie in top-right */}
        <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "2rem" }}>
                <div style={{ flex: "1 1 400px" }}>
                    <h3>Validation Result: {result.dataset_name}</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "1rem" }}>
                        <div><strong>User:</strong> {result.user_id}</div>
                        <div><strong>Run Time:</strong> {formatDate(result.run_time)}</div>
                        <div><strong>Suite Name:</strong> {meta.expectation_suite_name}</div>
                        <div><strong>Version:</strong> {meta.great_expectations_version}</div>
                    </div>
                </div>
                
 
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <DoughnutStatsChart
                        passed={statistics.successful_expectations || 0}
                        failed={statistics.unsuccessful_expectations || 0}
                        animate
                    />
                </div>
            </div>

        </Card>


        <div style={{ margin: "2rem 0" }}>
            <Card>
                {/* Table Expectations */}
                <h4>Table Expectations</h4>
                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                    <div style={{ flex: "1 1 0" }}>
                        <Dropdown
                            value={selectedTableCategory}
                            options={tableCategoryOptions}
                            onChange={(e) => setSelectedTableCategory(e.value)}
                            placeholder="Filter by Table Category"
                            itemTemplate={categoryOptionTemplate}
                            valueTemplate={selectedCategoryTemplate}
                            showClear
                            className="w-full"
                        />
                    </div>
                    <div style={{ flex: "1 1 0" }}>
                        <Dropdown
                            value={selectedTableStatus}
                            options={statusOptions}
                            onChange={(e) => setSelectedTableStatus(e.value)}
                            placeholder="Filter by Status"
                            itemTemplate={statusOptionTemplate}
                            valueTemplate={selectedStatusTemplate}
                            showClear
                            className="w-full"
                        />
                    </div>
                </div>

                <div style={{ marginTop: "1rem", display: "flex", flexWrap: "wrap", gap: "1rem", justifyContent: "center" }}>
                    <div style={{ flex: "1 1 0"}}>
                        <TableExpectationBarChart 
                            expectations={filteredTableExpectations} 
                            expectationDescriptions={result.expectation_descriptions || {}} 
                            animate
                            isDarkMode={isDarkMode}
                        />
                    </div>
                    <div style={{ flex: "1 1 0" }}>
                        <ExpectationRadarPassedTotalChart
                           expectations={filteredTableExpectations.map(exp => ({
                                category: result.expectation_descriptions?.[exp.expectation_config?.type]?.category || "Unknown",
                                success: exp.success
                            }))}
                            activeCategories={selectedTableCategory ? [selectedTableCategory] : []}
                            type="table"
                            animate
                            isDarkMode={isDarkMode}
                        />
                    </div>
                </div>

                <div style={{ marginTop: "2rem" }}>

                    <DataTable value={filteredTableExpectations } >
                        <Column 
                            header="Expectation" 
                            body={(rowData) => renderExpectationType(
                                { expectation_type: rowData.expectation_config.type },  
                                result.expectation_descriptions || {}
                            )}
                            sortable
                        />
                        <Column 
                            header="Category"
                            body={(rowData) => {
                                const expectationType = rowData.expectation_config?.type;
                                return result.expectation_descriptions?.[expectationType]?.category || "—";
                            }}
                            sortable
                        />

                        <Column 
                            header="Arguments" 
                            body={renderArguments} 
                        />
                        <Column 
                            header="Result" 
                            body={renderResult} 
                            sortable
                        />
                        <Column 
                            header="Status" 
                            body={(rowData) => (rowData.success ? "✅ Pass" : "❌ Fail")} 
                            sortable
                        />
                    </DataTable>
                </div>
            </Card>
        </div>

        <div style={{ margin: "2rem 0" }}>
            <Card>
                <h4>Expectation Results per Column</h4>


                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                    <div style={{ flex: "1 1 0" }}>
                        <Dropdown
                        value={selectedColumn}
                        options={columnOptions}
                        onChange={(e) => setSelectedColumn(e.value)}
                        placeholder="Filter by Column"
                        showClear
                        className="w-full"
                        />
                    </div>
                    <div style={{ flex: "1 1 0" }}>
                        <Dropdown
                        value={selectedColumnCategory}
                        options={columnCategoryOptions}
                        onChange={(e) => setSelectedColumnCategory(e.value)}
                        placeholder="Filter by Column Category"
                        showClear
                        className="w-full"
                        />
                    </div>
                    <div style={{ flex: "1 1 0" }}>
                        <Dropdown
                            value={selectedColumnStatus}
                            options={statusOptions}
                            onChange={(e) => setSelectedColumnStatus(e.value)}
                            placeholder="Filter by Status"
                            itemTemplate={statusOptionTemplate}
                            valueTemplate={selectedStatusTemplate}
                            showClear
                            className="w-full"
                        />
                    </div>

                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", justifyContent: "center", marginTop: "1rem" }}>
                    <div style={{ flex: "1 1 0"}}>
                        <ColumnExpectationBarChart 
                            expectations={filteredColumnExpectations} 
                            animate 
                            isDarkMode={isDarkMode}
                        />
                    </div>
                    <div style={{ flex: "1 1 0" }}>
                        <ExpectationRadarPassedTotalChart
                            expectations={filteredColumnExpectations.map(exp => ({
                                category: result.expectation_descriptions?.[exp.expectation_config?.type]?.category || "Unknown",
                                success: exp.success
                            }))}
                            activeCategories={selectedColumnCategory ? [selectedColumnCategory] : []}
                            type="column"
                            animate
                            isDarkMode={isDarkMode}
                        />
                    </div>
                </div>

                <div style={{marginTop: "1rem" }}>

                    <DataTable value={filteredColumnExpectations} >
                        <Column 
                            header="Expectation" 
                            body={(rowData) => renderExpectationType(
                                { expectation_type: rowData.expectation_config.type },  // ✅ Correct
                                result.expectation_descriptions || {}
                            )}
                            sortable
                        />
                        <Column 
                            header="Category"
                            body={(rowData) => {
                                const expectationType = rowData.expectation_config?.type;
                                return result.expectation_descriptions?.[expectationType]?.category || "—";
                            }}
                            sortable
                        />
                        <Column
                            header="Column"
                            body={(rowData) => {
                                const columnName = rowData.expectation_config?.kwargs?.column;
                                const tooltip = descriptions[columnName];

                                return (
                                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                        <span>{columnName}</span>
                                        {tooltip && (
                                            <i
                                                className="pi pi-info-circle expectation-tooltip"
                                                data-pr-tooltip={tooltip}
                                                style={{ fontSize: "1rem", color: "#6b7280", cursor: "pointer" }}
                                            />
                                        )}
                                    </div>
                                );
                            }}
                            sortable
                        />
                        
                        <Column header="Arguments" body={renderArguments} />
                        <Column header="Result" body={renderResult} />
                        <Column header="Status" body={(rowData) => (rowData.success ? "✅ Pass" : "❌ Fail")} sortable/>
                    </DataTable>
                </div>
            </Card>
        </div>

    </div>
    );
};

export default ValidationResultsViewer;
