import React from 'react';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dropdown } from 'primereact/dropdown';
import { MultiSelect } from 'primereact/multiselect';
import {fileTypeItemTemplate}  from '../../utils/icons'

const StepExpectationDetails = ({ 
    useCase, 
    setUseCase, 
    selectedCategory, 
    setSelectedCategory, 
    selectedFileTypes,
    setSelectedFileTypes,
    customCategory, 
    setCustomCategory, 
    categoryOptions, 
    itemTemplate,
    fileTypes,
    fileTypesLoading,
    fileTypesError,
    isDarkMode 
}) =>  (
        <div className={isDarkMode ? 'dark-mode' : ''} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <h3>Expectation Suite Details</h3>
            <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
                <Dropdown
                    value={selectedCategory}
                    options={categoryOptions}
                    onChange={(e) => setSelectedCategory(e.value)}
                    placeholder="Select Category"
                    itemTemplate={itemTemplate}
                    valueTemplate={itemTemplate}
                    style={{ width: "250px" }}
                />
                {selectedCategory === "other" && (
                    <InputText
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        placeholder="Custom category"
                        style={{ width: "250px" }}
                    />
                )}
                <MultiSelect
                    value={selectedFileTypes}
                    options={fileTypes}
                    onChange={(e) => setSelectedFileTypes(e.value)}
                    placeholder="Select File Types"
                    display="chip"
                    filter 
                    itemTemplate={fileTypeItemTemplate}
                    disabled={fileTypesLoading || !!fileTypesError}
                    className={`w-full ${isDarkMode ? 'dark-mode' : ''}`} 
                />

            </div>
            <InputText value={useCase.name} onChange={(e) => setUseCase({ ...useCase, name: e.target.value })} placeholder="Enter Title" />
            <InputTextarea value={useCase.description} onChange={(e) => setUseCase({ ...useCase, description: e.target.value })} placeholder="Enter Description" rows={4} />
        </div>
    )

export default StepExpectationDetails;
