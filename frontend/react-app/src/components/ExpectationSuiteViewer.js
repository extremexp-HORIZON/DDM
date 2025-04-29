import React, { useState } from "react";
import { Card } from "primereact/card";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import { Tooltip } from "primereact/tooltip";
import { formatDate } from "../utils/dateFormatter";
import { itemTemplate } from "../utils/categoryOptions";
import { fileTypeItemTemplate } from "../utils/icons";
import { ProgressSpinner } from "primereact/progressspinner"; 
import ExpectationRadarChart from './charts/ExpectationRadarChart'; 
import ExpectationStackedBarChart from './charts/ExpectationStackedBarChart';
import {
    tableCategoryOptions,
    columnCategoryOptions,
    categoryOptionTemplate,
    selectedCategoryTemplate,
    renderArguments,
    renderExpectationType
} from "../utils/expectationHelpers";


const ExpectationSuiteViewer = ({ suite, loading = false }) => {
    const [selectedColumn, setSelectedColumn] = useState(null);
    const [selectedColumnCategory, setSelectedColumnCategory] = useState(null);
    const [selectedTableCategory, setSelectedTableCategory] = useState(null);

    if (!suite || loading) {
        return (
            <div className="flex justify-center items-center min-h-[300px]">
                <ProgressSpinner style={{ width: '50px', height: '50px' }} strokeWidth="4" />
            </div>
        );
    }

    const expectations = suite.expectations || [];
    const meta = {
        column_descriptions: suite.column_descriptions || {},
        expectation_descriptions: suite.expectation_descriptions || {},
    };

    const columnDescriptions = meta?.column_descriptions || {};
    const expectationDescriptions = meta?.expectation_descriptions || {};

    const tableExpectations = expectations.filter((e) => !e.kwargs?.column);
    const columnExpectations = expectations.filter((e) => e.kwargs?.column);


    // Split options
    const columnOptions = Object.keys(columnDescriptions).map((col) => ({
        label: `${col} - ${columnDescriptions[col]}`,
        value: col,
    }));


    // Filtering
    const filteredTableExpectations = tableExpectations.filter((e) => {
        const category = expectationDescriptions[e.expectation_type]?.category;
        return (!selectedTableCategory || category === selectedTableCategory);
    });

    const filteredColumnExpectations = columnExpectations.filter((e) => {
        const category = expectationDescriptions[e.expectation_type]?.category;
        return (!selectedColumn || e.kwargs.column === selectedColumn) &&
            (!selectedColumnCategory || category === selectedColumnCategory);
    });

         
    return (
        <div className={`p-4`}>

            <Tooltip target=".expectation-tooltip" position="top" />
            <Tooltip target=".expectation-doc-link" position="top" />

            {/* Suite info */}
            <div style={{ margin: "2rem 0" }}>
                <Card>
                    <h3 style={{ marginBottom: "1.5rem" }}>{suite.suite_name}</h3>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "2rem" }}>
                        <div style={{ flex: 1, minWidth: "300px" }}>
                            <div><strong>Description</strong><div>{suite.description || "—"}</div></div>
                            <div><strong>Category</strong><div>{itemTemplate({ value: suite.category })}</div></div>
                            <div>
                                <strong>File Types</strong>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                                    {suite.file_types?.map((type, idx) => (
                                        <div key={idx}>
                                            {fileTypeItemTemplate({ value: type })}
                                        </div>
                                    )) || "—"}
                                </div>
                            </div>
                        </div>
                        <div style={{ flex: 1, minWidth: "200px" }}>
                            <div><strong>User</strong><div>{suite.user_id}</div></div>
                            <div><strong>Created</strong><div>{formatDate(suite.created)}</div></div>
                        </div>
   
                    </div>
                </Card>
            </div>


            {/* Table Expectations */}
            <div style={{ margin: "2rem 0" }}>
                <Card>
                    <h4>Table Expectations</h4>
                    <div style={{ marginBottom: "1rem", maxWidth: "300px" }}>
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
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
                        <div style={{ flex: 1}}>

                            <ExpectationRadarChart
                                expectations={filteredTableExpectations.map(e => ({
                                    category: expectationDescriptions[e.expectation_type]?.category || "Unknown"
                                }))}
                                type="table"
                                activeCategories={selectedTableCategory ? [selectedTableCategory] : []}
                                animate
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <ExpectationStackedBarChart
                                expectations={filteredTableExpectations.map(e => ({
                                    category: expectationDescriptions[e.expectation_type]?.category || "Unknown"
                                }))}
                                activeCategories={selectedTableCategory ? [selectedTableCategory] : []}
                                type="table"
                                animate
                            />
                        </div>
                    </div>

                    <DataTable value={filteredTableExpectations}>
                        <Column header="Expectation" body={(rowData) => renderExpectationType(rowData, expectationDescriptions)}  sortable/>
                        <Column
                            header="Category"
                            body={(rowData) => expectationDescriptions[rowData.expectation_type]?.category || "—"}
                            sortable
                        />
                        <Column header="Arguments" body={renderArguments} />
                    </DataTable>
                </Card>
            </div>


            {/* Column Expectations */}
            <div style={{ margin: "2rem 0" }}>
                <Card>
                    <h4>Column Expectations</h4>
                    <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
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
                            itemTemplate={categoryOptionTemplate}
                            valueTemplate={selectedCategoryTemplate}
                            showClear
                            className="w-full"
                        />
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>

                        <div style={{ flex: 1}}>
                            <ExpectationRadarChart
                                expectations={filteredColumnExpectations.map(e => ({
                                    category: expectationDescriptions[e.expectation_type]?.category || "Unknown"
                                }))}
                                type="column"
                                activeCategories={selectedColumnCategory ? [selectedColumnCategory] : []}
                                animate
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <ExpectationStackedBarChart
                                expectations={filteredColumnExpectations.map(e => ({
                                    category: expectationDescriptions[e.expectation_type]?.category || "Unknown"
                                }))}
                                activeCategories={selectedColumnCategory ? [selectedColumnCategory] : []}
                                type="column"
                                animate
                            />
                        </div>
                    </div>
                    
                    <DataTable value={filteredColumnExpectations}>
                        <Column 
                            header="Expectation" 
                            body={(rowData) => renderExpectationType(rowData, expectationDescriptions)}  
                            sortable
                        />
                        <Column
                            header="Category"
                            body={(rowData) => expectationDescriptions[rowData.expectation_type]?.category || "—"}
                            sortable
                        />
                        <Column
                            field="kwargs.column"
                            header="Column"
                            body={(rowData) => {
                                const columnName = rowData.kwargs?.column;
                                const tooltip = columnDescriptions[columnName];

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
                        <Column
                            header="Arguments"
                            body={renderArguments}
                        />
                        </DataTable>
                </Card>
            </div>
        </div>
    );
};

export default ExpectationSuiteViewer;
