import React from "react";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import { InputTextarea } from "primereact/inputtextarea";
import { Checkbox } from "primereact/checkbox";
import { InputText } from "primereact/inputtext";
import { ProgressSpinner } from "primereact/progressspinner";
import { Tooltip } from "primereact/tooltip";
import { Chips } from "primereact/chips"

const StepDefineExpectations = ({
    expectations,
    tableExpectations,
    expectationRules,
    selectedExpectations,
    setSelectedExpectations,
    selectedTypeFilter,
    loadingDescriptions,
    updateExpectation,
    updateTableExpectation,
    setSelectedTypeFilter,
    handleArgChange,
    handleTableArgChange
}) => {
    const columnTypes = ["schema", "completeness", "uniqueness", "validity", "numeric"];

    const renderArgumentInput = (value, onChange, keyPath = []) => {
        const isList = Array.isArray(value);
        const isSimpleList = isList && value.every(v => typeof v !== "object");
    
        // Render Chips for known list fields
        const chipsFields = ["value_set", "column_list", "type_list"];
    
        const lastKey = keyPath[keyPath.length - 1];
        const shouldUseChips = chipsFields.includes(lastKey) || isSimpleList;
    
        if (shouldUseChips) {
            return (
                <Chips
                    value={value || []}
                    onChange={(e) => onChange(e.value, keyPath)}
                    separator=","
                    style={{ width: "100%", maxWidth: "300px" }}
                />
            );
        }
    
        // Render text for simple value
        if (typeof value !== "object" || value === null) {
            return (
                <InputText
                    value={typeof value === 'object' ? JSON.stringify(value) : value}
                    onChange={(e) => {
                        let parsed = e.target.value;
                        try { parsed = JSON.parse(parsed); } catch {}
                        onChange(parsed, keyPath);
                    }}
                    style={{ width: "100%", maxWidth: "300px", textAlign: "center" }}
                />
            );
        }
    
        // Render nested object
        return Object.entries(value).map(([key, val]) => (
            <div key={key} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "0.75rem", fontWeight: "bold" }}>{key}</label>
                {renderArgumentInput(val, onChange, [...keyPath, key])}
            </div>
        ));
    };
    

    const getExpectationOptions = (rowData) => {
        const column = rowData?.column;
        if (!column) return <span>No column data</span>;
    
        const rules = expectationRules[selectedTypeFilter] || [];
        const columnChecks = selectedExpectations[column] || {};
    
        if (!rules.length) return <span>No rules available</span>;
    
        return (
            <div>
                {rules.map(rule => {
                    const ruleArgs = columnChecks[rule.name] || {};
                    const isChecked = ruleArgs._enabled === true;
    
                    return (
                        <div key={rule.name} style={{ marginBottom: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <Checkbox
                                    checked={isChecked}
                                    onChange={(e) => {
                                        const checked = e.checked;
                                        if (checked) {
                                            const defaultArgs = (rule.arguments || []).reduce((acc, arg) => {
                                                acc[arg.name] = ruleArgs[arg.name] ?? arg.expected_value ?? "";
                                                return acc;
                                            }, {});
                                            updateExpectation(column, rule.name, true, defaultArgs);
                                        } else {
                                            updateExpectation(column, rule.name, false);
                                        }
                                    }}
                                />
                                <span style={{ flex: 1 }}>
                                    {rule.name}
                                    <i
                                        className="pi pi-info-circle expectation-tooltip"
                                        style={{ fontSize: "1rem", cursor: "pointer", marginLeft: "6px" }}
                                        data-pr-tooltip={rule.description}
                                    />
                                    <a
                                        href={`https://greatexpectations.io/expectations/${rule.name}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ marginLeft: "6px", color: "inherit" }}
                                        data-pr-tooltip={`View docs for ${rule.name}`}
                                        className="expectation-doc-link"
                                    >
                                        <i className="pi pi-external-link" />
                                    </a>
                                </span>
                            </div>
    
                            {isChecked && (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginLeft: "25px" }}>
                                    {[...(rule.arguments || []),
                                      // Add any extra keys that might've been passed manually or saved before
                                      ...Object.keys(ruleArgs)
                                          .filter(k => !["_enabled", "success"].includes(k))
                                          .filter(k => !(rule.arguments || []).some(arg => arg.name === k))
                                          .map(k => ({ name: k, expected_value: ruleArgs[k] }))
                                    ].map(arg => {
                                        const value = ruleArgs[arg.name] ?? arg.expected_value ?? "";
                                        return (
                                            <div key={arg.name} style={{ display: "flex", flexDirection: "column", minWidth: "150px" }}>
                                                <label style={{ fontWeight: 500 }}>{arg.name.replace(/_/g, " ")}</label>
                                                {renderArgumentInput(value, (newValue, keyPath) =>
                                                    handleArgChange(column, rule.name, newValue, [arg.name, ...keyPath])
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };
    

    return (
        <>
            <Tooltip target=".expectation-tooltip, .expectation-doc-link" />

            {loadingDescriptions && (
            <div style={{ width: "100%", display: "flex", justifyContent: "flex-end" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <ProgressSpinner style={{ width: "20px", height: "20px" }} strokeWidth="5" />
                <span>Generating column descriptions...</span>
                </div>
            </div>
            )}



            <h4>Table-Level Expectations</h4>
            <hr></hr>
            <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
                {Object.entries(expectationRules["table"] || {}).map(([category, rulesObj]) => (
                    <div key={category} style={{ flex: "1", minWidth: "300px" }}>
                        <h5 style={{ fontWeight: 480, marginBottom: "8px" }}>{category}</h5>

                        {Object.values(rulesObj).map(rule => {
                            const ruleArgs = tableExpectations?.[rule.name] || {};

                            const isChecked = ruleArgs._enabled === true;

                            return (
                                <div key={rule.name} style={{ marginBottom: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                        <Checkbox
                                            checked={isChecked}
                                            onChange={(e) => {
                                                const defaultArgs = (rule.arguments || []).reduce((acc, arg) => {
                                                    acc[arg.name] = ruleArgs[arg.name] ?? arg.expected_value ?? "";
                                                    return acc;
                                                }, {});
                                                updateTableExpectation(rule.name, e.checked, defaultArgs);

                                            }}
                                        />
                                        <span style={{ flex: 1 }}>
                                            {rule.name}
                                            <i
                                                className="pi pi-info-circle expectation-tooltip"
                                                style={{ fontSize: "1rem", cursor: "pointer", marginLeft: "6px" }}
                                                data-pr-tooltip={rule.description}
                                            />
                                            <a
                                                href={`https://greatexpectations.io/expectations/${rule.name}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{ marginLeft: "6px", color: "inherit" }}
                                                data-pr-tooltip={`View docs for ${rule.name}`}
                                                className="expectation-doc-link"
                                            >
                                                <i className="pi pi-external-link" />
                                            </a>
                                        </span>
                                    </div>

                                    {isChecked && (
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginLeft: "25px" }}>
                                            {(rule.arguments || []).map(arg => {
                                                const value = ruleArgs[arg.name] ?? arg.expected_value ?? "";
                                                return (
                                                    <div key={arg.name} style={{ display: "flex", flexDirection: "column", minWidth: "150px" }}>
                                                        <label style={{ fontWeight: 450 }}>{arg.name}</label>
                                                        {renderArgumentInput(value, (newValue, keyPath) =>
                                                            handleTableArgChange(rule.name, newValue, [arg.name, ...keyPath])
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>

            <hr></hr>

            <h4>Column-Level Expectations</h4>
            <hr></hr>

            <DataTable value={expectations} showGridlines stripedRows title="Column-Level Expectations">
                <Column field="column" header="Column Name" />

                <Column
                    header="Column Description"
                    body={(rowData) => (
                        <InputTextarea
                            autoResize
                            value={selectedExpectations?.[rowData.column]?.description || ""}
                            rows={2}
                            className="w-full"
                            onChange={(e) => {
                                const value = e.target.value;
                                setSelectedExpectations((prev) => ({
                                    ...prev,
                                    [rowData.column]: {
                                        ...prev[rowData.column],
                                        description: value,
                                    },
                                }));
                            }}
                        />
                    )}
                />

                <Column
                    header={
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <span>Validation Rules</span>
                            <Dropdown
                                value={selectedTypeFilter}
                                options={columnTypes.map(type => ({ label: type, value: type }))}
                                onChange={(e) => setSelectedTypeFilter(e.value)}
                                placeholder="Filter by Type"
                            />
                        </div>
                    }
                    body={getExpectationOptions}
                />
            </DataTable>
        </>
    );
};

export default StepDefineExpectations;
