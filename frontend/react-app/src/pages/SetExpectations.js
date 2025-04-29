import React, { useState, useEffect, useRef } from 'react';
import { Steps } from 'primereact/steps';
import { Button } from 'primereact/button';
import { useTheme } from "../context/ThemeContext";
import { Tooltip } from 'primereact/tooltip'; 
import { pollTaskResult } from '../api/tasks';
import { showMessage } from "../utils/messages"; 
import { useToast } from "../context/ToastContext"; 
import StepUseCaseDetails from '../components/expectations/StepUseCaseDetails';
import StepUploadSampleFile from '../components/expectations/StepUploadSampleFile';
import StepDefineExpectations from '../components/expectations/StepDefineExpectations';
import { useSampleUploader } from "../hooks/useSampleUploader";
import { ExpectationSaver } from "../hooks/useExpectationSaver";
import { useSupportedFileTypes } from '../hooks/useSupportedFileTypes';
import { useExpectationsManager } from "../hooks/useExpectationsManager";
import { useArgHandlers } from '../hooks/useArgHandlers';
import { useSupportedFileTypesDialog } from "../hooks/useSupportedFileTypesDialog";
import { categoryOptions, itemTemplate } from '../utils/categoryOptions';
import StepFinalize from '../components/expectations/StepFinalize';



const SetExpectations = () => {
  const tooltipRef = useRef(null);
  const toast = useToast();
  const { isDarkMode } = useTheme();
  const [activeIndex, setActiveIndex] = useState(0);
  const [useCase, setUseCase] = useState({ name: '', description: '' });
  const [selectedFileTypes, setSelectedFileTypes] = useState([]);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState("schema"); 
  const [loadingExpectations, setLoadingExpectations] = useState(false);
  const [loadingDescriptions, setLoadingDescriptions] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [customCategory, setCustomCategory] = useState("");
  const [datasetId, setDatasetId] = useState(null);
  const steps = [
    { label: "Create Expectation Suite " },
    { label: "Upload Sample File" },
    { label: "Define Expectations" },
    { label: "Finalize" }
  ];

  const {
    setSuiteName,
    expectations,
    expectationRules,
    selectedExpectations,
    tableExpectations,
    setSelectedExpectations,
    setTableExpectations,
    handleExpectations,
    updateExpectation,
    updateTableExpectation
  } = useExpectationsManager({ toast, showMessage });

  const {
    showFileExtensions,
    setShowFileExtensions
  } = useSupportedFileTypesDialog();

  const { 
    handleArgChange, 
    handleTableArgChange 
  } = useArgHandlers(updateExpectation, setTableExpectations);

  const handleDescriptions = async (descriptionTaskId) => {
    const result = await pollTaskResult(descriptionTaskId, 2000, 180000);
    return result;
  };

  const { 
    fileTypes, 
    loading: fileTypesLoading, 
    error: fileTypesError 
  } = useSupportedFileTypes();


  const saveExpectations = ExpectationSaver({
    toast,
    showMessage,
    useCase,
    selectedExpectations,
    tableExpectations,
    selectedCategory,
    customCategory,
    selectedFileTypes,
    datasetId
  });
  
  
  useEffect(() => {
    tooltipRef.current?.updateTargetEvents?.();
  }, [selectedExpectations]);




  const uploadSampleFile = useSampleUploader({
    toast,
    showMessage,
    handleExpectations,
    handleDescriptions,
    setSelectedExpectations,
    setTableExpectations,
    setSuiteName,
    setLoadingExpectations,
    setLoadingDescriptions,
    setActiveIndex,
    setDatasetId,
    suiteName: useCase.name
  });

  const stepComponents = [
    <StepUseCaseDetails
      useCase={useCase}
      setUseCase={setUseCase}
      selectedCategory={selectedCategory}
      setSelectedCategory={setSelectedCategory}
      customCategory={customCategory}
      setCustomCategory={setCustomCategory}
      categoryOptions={categoryOptions}
      selectedFileTypes={selectedFileTypes}
      setSelectedFileTypes={setSelectedFileTypes}
      itemTemplate={itemTemplate}
      fileTypes={fileTypes}
      fileTypesLoading={fileTypesLoading}
      fileTypesError={fileTypesError}
      isDarkMode={isDarkMode}
    />,
    <StepUploadSampleFile
      loadingExpectations={loadingExpectations}
      uploadSampleFile={uploadSampleFile}
      showFileExtensions={showFileExtensions}
      setShowFileExtensions={setShowFileExtensions}
      fileFormats=".csv,.json,.xlsx"
      isDarkMode={isDarkMode}
    />,
      <StepDefineExpectations
        expectations={expectations}
        tableExpectations={tableExpectations}
        expectationRules={expectationRules}
        selectedExpectations={selectedExpectations}
        selectedTypeFilter={selectedTypeFilter}
        loadingDescriptions={loadingDescriptions}
        updateExpectation={updateExpectation}
        updateTableExpectation={updateTableExpectation}
        setSelectedExpectations={setSelectedExpectations}
        setSelectedTypeFilter={setSelectedTypeFilter}
        setTableExpectations={setTableExpectations}
        handleArgChange={handleArgChange}
        handleTableArgChange={handleTableArgChange}
      />,
      // ✅ fallback when expectations is empty
    <StepFinalize saveExpectations={saveExpectations} /> // ✅ this now gets evaluated properly
  ];
  
  
  return (
    <div className={`dataset-container ${isDarkMode ? "dark-mode" : "light-mode"}`}>
        <Steps model={steps} activeIndex={activeIndex} readOnly={false} className="custom-steps" />
        <Tooltip ref={tooltipRef} target=".expectation-tooltip, .expectation-doc-link" />

        <div className="form-container">
            {stepComponents[activeIndex]}

            <div className="button-group">
                {activeIndex > 0 && <Button label="Back" onClick={() => setActiveIndex(prev => prev - 1)} />}
                {activeIndex < steps.length - 1 && <Button label="Next" onClick={() => setActiveIndex(prev => prev + 1)} />}
            </div>
        </div>

    </div>
  );
};

export default SetExpectations;