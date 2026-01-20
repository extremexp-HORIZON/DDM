
import { useTheme } from "../context/ThemeContext";
import { Button } from "primereact/button";
import "../styles/components/web3Dashboard.css";
import { itemTemplate as categoryItemTemplate } from "../utils/categoryOptions";
import { getFileIconFromExt } from "../utils/icons";
import CategoryDialog from "../components/web3/CategoryDialog";
import FormatDialog from "../components/web3/FormatDialog";
import ValidatorDialog from "../components/web3/ValidatorDialog";
import ConfirmDialog from "../components/web3/ConfirmDialog";
import Web3FiltersBar from "../components/web3/Web3FiltersBar";
import RegistriesPanel from "../components/web3/RegistriesPanel";
import DatasetsSection from "../components/web3/DatasetsSection";
import DatasetRequestSection from "../components/web3/DatasetRequestSection";
import { useSuiteRequestsDashboardData } from "../hooks/web3/useSuiteRequestsDashboardData";
import DatasetRegisterDialog from "../components/web3/DatasetRegisterDialog";
import ValidationDialog from "../components/web3/ValidationDialog";
import ClaimRewardDialog from "../components/web3/ClaimRewardDialog";


import {
  shortAddr,
  getExplorerAddressUrl,
  openInExplorer,
} from "../utils/web3DashboardUtils";


// Render category with its icon (reuses shared itemTemplate)
const renderCategoryChip = (value) => {
  if (!value) return null;
  return categoryItemTemplate({ value });
};

// Render file format with its icon
const renderFileFormatChip = (value) => {
  if (!value) return null;
  return (
    <span className="fileformat-chip flex items-center gap-1">
      {getFileIconFromExt(value)}
      <span>{value}</span>
    </span>
  );
};

export default function SuiteRequestsDashboard() {
  const { isDarkMode } = useTheme();
  const data = useSuiteRequestsDashboardData();
    
  const {
    network,
    setNetwork,
    // contracts
    suiteContract,
    datasetContract,
    validationContract,
    categoryContract,
    fileFormatContract,
    validatorsContract,
    // loading
    loadingSuites,
    loadingDatasets,
    // filters
    globalFilter,
    setGlobalFilter,
    statusFilter,
    setStatusFilter,
    categoryFilter,
    setCategoryFilter,
    fileFormatFilter,
    setFileFormatFilter,
    categoryOptions,
    fileFormatOptions,
    datasetIncludeReport,
    setDatasetIncludeReport,
    datasetReportUri,
    setDatasetReportUri,
    // registries
    allowedCategories,
    allowedFormats,
    activeValidators,
    catEvents,
    fmtEvents,
    valRegEvents,
    catLoading,
    fmtLoading,
    valRegLoading,
    catEventCounts,
    fmtEventCounts,
    valRegEventCounts,
    catEventFilter,
    setCatEventFilter,
    fmtEventFilter,
    setFmtEventFilter,
    valRegEventFilter,
    setValRegEventFilter,
    catExpanded,
    fmtExpanded,
    valRegExpanded,
    toggleCategory,
    toggleFileFormat,
    toggleValidators,
    // ✅ dataset registry events UI
    datasetExpanded,
    datasetLoading,
    datasetEvents,
    datasetEventFilter,
    setDatasetEventFilter,
    validationPreparing,
    handlePrepareValidationResult,

    // ✅ validation registry events UI
    validationExpanded,
    validationLoading,
    validationEvents,
    validationEventFilter,
    setValidationEventFilter,

    toggleDatasetRegistry,
    toggleValidationRegistry,
    // dataset requests registry UI
    datasetRequestsExpanded,
    datasetRequestsLoading,
    suiteEvents,
    datasetRequestEventFilter,
    setDatasetRequestEventFilter,
    toggleDatasetRequestRegistry,

    // suites & datasets
    suitesToRender,
    filteredDatasets,
    datasets,
    formatRegisteredAt,
    notImplemented,
    // dialogs + confirm
    categoryDialogVisible,
    setCategoryDialogVisible,
    categoryToEdit,
    setCategoryToEdit,
    categorySubmitting,
    

    formatDialogVisible,
    setFormatDialogVisible,
    formatToEdit,
    setFormatToEdit,
    formatSubmitting,
    
    validatorDialogVisible,
    setValidatorDialogVisible,
    validatorAddress,
    setValidatorAddress,
    validatorDescription,
    setValidatorDescription,
    validatorCodeURI,
    setValidatorCodeURI,
    validatorCodeHash,
    setValidatorCodeHash,
    validatorActive,
    setValidatorActive,
    validatorMode,
    setValidatorMode,
    validatorSubmitting,
    confirmVisible,
    confirmMessage,
    confirmLoading,
    askConfirm,
    handleConfirm,
    handleCancelConfirm,
    datasetDialogVisible,
    setDatasetDialogVisible,
    datasetUri,
    setDatasetUri,
    datasetSuiteHash,
    setDatasetSuiteHash,
    datasetFileFormat,
    setDatasetFileFormat,
    datasetLockSuiteFields,
    setDatasetLockSuiteFields,
    registeringDataset,
    validationDialogVisible,
    setValidationDialogVisible,
    validationDatasetFp,
    setValidationDatasetFp,
    validationResultURI,
    setValidationResultURI,
    validationReportURI,
    setValidationReportURI,
    claimPrepared,
    setClaimPrepared,
    claimPreparing,
    setClaimPreparing,
    // validation dialog state
    
    validationHash,
    setValidationHash,
    validationSuccessful,
    setValidationSuccessful,
    validationSubmitting,
    // claim dialog state
    claimDialogVisible,
    setClaimDialogVisible,
    claimSuiteId,
    claimDatasetFp,
    setClaimDatasetFp,
    claimSubmitting,
    // catalog + zenoh
    catalogOptions,
    selectedCatalogId,
    setSelectedCatalogId,


    // handlers
    handleSaveCategory,
    handleRemoveCategory,
    handleSaveFormat,
    handleRemoveFormat,
    handleSaveValidator,
    handleRemoveValidator,
    handleRegisterDataset,
    handleSubmitValidation, 
    handlePrepareReport,   
    handleClaimRewardForDataset, 
    handleCancelAndRefund, 
    openValidatorEdit,
    openValidationDialog,
    openClaimDialog,
    handleClaimReward,
    
  } = data;
  

  const containerClass = `dataset-container ${
    isDarkMode ? "dark-mode" : "light-mode"
  }`;

  const cardClass = (extra = "") =>
    `suite-card ${isDarkMode ? "suite-card-dark" : "suite-card-light"} ${extra}`;

  const registryCardHeader = (label, contract) => {
    const addr = contract?.address;
    const net = contract?.network || network;
    const explorerUrl = getExplorerAddressUrl(net, addr);

    return (
      <div className="flex justify-between items-center mb-1">
        {/* Left side: label + name + network */}
        <div>
          <div className="text-xs text-muted">{label}</div>
          <div className="font-semibold text-sm">{contract?.name || "-"}</div>
          <div className="text-xs text-muted mt-1">{net}</div>
        </div>

        {/* Right side: address + buttons on the SAME line */}
        <div className="text-right">
          <div className="flex items-center justify-end gap-1">
            <span className="text-xs" title={addr || ""}>
              {addr ? shortAddr(addr) : "-"}
            </span>

            {addr && (
              <>
                <Button
                  className="p-button-text p-button-sm tag-icon-btn tag-icon-copy"
                  icon="pi pi-copy"
                  onClick={() => navigator.clipboard.writeText(addr)}
                  tooltip="Copy address"
                  tooltipOptions={{ position: "top" }}
                />
                {explorerUrl && (
                  <Button
                    className="p-button-text p-button-sm tag-icon-btn tag-icon-navigate"
                    icon="pi pi-external-link"
                    onClick={() => openInExplorer(addr, net)}
                    tooltip="Open in explorer"
                    tooltipOptions={{ position: "top" }}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const openDatasetDialogForSuite = (suite) => {
    setDatasetUri("");
    setDatasetSuiteHash(suite.suiteHash || "");
    setDatasetFileFormat(suite.fileFormat || "");
    setDatasetLockSuiteFields(true);          // 🔒 lock hash + format
    setDatasetDialogVisible(true);
  };



  // ------------------------------------------------------------------
  // RENDER
  // ------------------------------------------------------------------
  return (
    <div className={containerClass}>
      {/* Top: title & filters */}
     <Web3FiltersBar
        network={network}
        onChangeNetwork={setNetwork}
        statusFilter={statusFilter}
        onChangeStatusFilter={setStatusFilter}
        categoryFilter={categoryFilter}
        onChangeCategoryFilter={setCategoryFilter}
        categoryOptions={categoryOptions}
        fileFormatFilter={fileFormatFilter}
        onChangeFileFormatFilter={setFileFormatFilter}
        fileFormatOptions={fileFormatOptions}
        globalFilter={globalFilter}
        onChangeGlobalFilter={setGlobalFilter}
        renderCategoryChip={renderCategoryChip}
        renderFileFormatChip={renderFileFormatChip}
      />
      <h3>Category, FileFormat, Validators Registries</h3>

      <RegistriesPanel
        cardClass={cardClass}
        // categories
        categoryContract={categoryContract}
        allowedCategories={allowedCategories}
        catExpanded={catExpanded}
        onToggleCategory={toggleCategory}
        catEvents={catEvents}
        catLoading={catLoading}
        catEventCounts={catEventCounts}
        catEventFilter={catEventFilter}
        setCatEventFilter={setCatEventFilter}
        onRegisterCategory={() => {
          setCategoryToEdit("");
          setCategoryDialogVisible(true);
        }}
        onRemoveCategory={(c) =>
          askConfirm(`Remove category "${c}" from registry?`, () =>
            handleRemoveCategory(c)
          )
        }
        // formats
        fileFormatContract={fileFormatContract}
        allowedFormats={allowedFormats}
        fmtExpanded={fmtExpanded}
        onToggleFileFormat={toggleFileFormat}
        fmtEvents={fmtEvents}
        fmtLoading={fmtLoading}
        fmtEventCounts={fmtEventCounts}
        fmtEventFilter={fmtEventFilter}
        setFmtEventFilter={setFmtEventFilter}
        onRegisterFormat={() => {
          setFormatToEdit("");
          setFormatDialogVisible(true);
        }}
        onRemoveFormat={(f) =>
          askConfirm(`Remove format "${f}" from registry?`, () =>
            handleRemoveFormat(f)
          )
        }
        renderCategoryChip={renderCategoryChip}
        renderFileFormatChip={renderFileFormatChip}
        // validators
        validatorsContract={validatorsContract}
        valRegExpanded={valRegExpanded}
        onToggleValidators={toggleValidators}
        activeValidators={activeValidators}
        valRegEvents={valRegEvents}
        valRegLoading={valRegLoading}
        valRegEventCounts={valRegEventCounts}
        valRegEventFilter={valRegEventFilter}
        setValRegEventFilter={setValRegEventFilter}
        onRegisterValidator={() => {
          setValidatorMode("add");
          setValidatorAddress("");
          setValidatorDescription("");
          setValidatorCodeURI("");
          setValidatorCodeHash("");
          setValidatorActive(true);
          setValidatorDialogVisible(true);
        }}
        openValidatorEdit={openValidatorEdit}
        onRemoveValidator={(addr) =>
          askConfirm(
            `Remove validator ${shortAddr(addr)} from registry?`,
            () => handleRemoveValidator(addr)
          )
        }

      />        

      <DatasetRequestSection
        cardClass={cardClass}
        suiteContract={suiteContract}
        suitesToRender={suitesToRender}
        loadingSuites={loadingSuites}
        notImplemented={notImplemented}
        requestsExpanded={datasetRequestsExpanded}
        requestsLoading={datasetRequestsLoading}
        requestEventFilter={datasetRequestEventFilter}
        setRequestEventFilter={setDatasetRequestEventFilter}
        onToggleRequestsRegistry={toggleDatasetRequestRegistry}
        requestEvents={suiteEvents} 
        // 🔹 Cancel with confirmation
        onCancelRequest={(id) =>
          askConfirm(
            `Cancel request #${id} and refund remaining bounty to requester?`,
            () => handleCancelAndRefund(id)
          )
        }
        // 🔹 Claim reward – for now we ask the user for dataset fp via prompt
        onClaimSuite={(suiteId) => openClaimDialog(suiteId)}
        onRegisterDatasetForSuite={(suite) => {
          // prefill dialog with this suite's hash & format
          setDatasetSuiteHash(suite.suiteHash || "");
          setDatasetFileFormat(suite.fileFormat || "");
          setDatasetLockSuiteFields(true); 
          setDatasetDialogVisible(true);
        }}
      />
      
      <DatasetsSection
        cardClass={cardClass}
        datasetContract={datasetContract}
        validationContract={validationContract}
        loadingDatasets={loadingDatasets}
        filteredDatasets={filteredDatasets}
        datasets={datasets}
        registryCardHeader={registryCardHeader}
        formatRegisteredAt={formatRegisteredAt}
        onRegisterDataset={() => {
          setDatasetUri("");
          setDatasetSuiteHash("");
          setDatasetFileFormat("");
          setDatasetReportUri("");
          setDatasetLockSuiteFields(false);
          setDatasetDialogVisible(true);
        }}
        onSubmitValidationForDataset={(fp) => openValidationDialog(fp)}
        onOpenValidationDialog={(fp) => openValidationDialog(fp)}
        onOpenClaimDialog={(requestId, fp) => openClaimDialog(requestId, fp)}

        // DatasetRegistry events panel
        datasetExpanded={datasetExpanded}
        datasetLoading={datasetLoading}
        datasetEvents={datasetEvents}
        datasetEventFilter={datasetEventFilter}
        setDatasetEventFilter={setDatasetEventFilter}
        onToggleDatasetRegistry={toggleDatasetRegistry}

        // ValidationRegistry events panel
        validationExpanded={validationExpanded}
        validationLoading={validationLoading}
        validationEvents={validationEvents}
        validationEventFilter={validationEventFilter}
        setValidationEventFilter={setValidationEventFilter}
        onToggleValidationRegistry={toggleValidationRegistry}
      />

      <CategoryDialog
        visible={categoryDialogVisible}
        value={categoryToEdit}
        onChange={setCategoryToEdit}
        onHide={() => setCategoryDialogVisible(false)}
        onSave={handleSaveCategory}
        submitting={categorySubmitting}
      />

      <FormatDialog
        visible={formatDialogVisible}
        value={formatToEdit}
        onChange={setFormatToEdit}
        onHide={() => setFormatDialogVisible(false)}
        onSave={handleSaveFormat}
        submitting={formatSubmitting}
      />

      <ValidatorDialog
        visible={validatorDialogVisible}
        mode={validatorMode}
        address={validatorAddress}
        description={validatorDescription}
        codeURI={validatorCodeURI}
        codeHash={validatorCodeHash}
        active={validatorActive}
        onChangeAddress={setValidatorAddress}
        onChangeDescription={setValidatorDescription}
        onChangeCodeURI={setValidatorCodeURI}
        onChangeCodeHash={setValidatorCodeHash}
        onChangeActive={setValidatorActive}
        onHide={() => setValidatorDialogVisible(false)}
        onSave={handleSaveValidator}
        submitting={validatorSubmitting}
      />

      <DatasetRegisterDialog
        visible={datasetDialogVisible}
        uri={datasetUri}
        onChangeUri={setDatasetUri}
        suiteHash={datasetSuiteHash}
        onChangeSuiteHash={setDatasetSuiteHash}
        fileFormat={datasetFileFormat}
        onChangeFileFormat={setDatasetFileFormat}
        fileFormatOptions={fileFormatOptions}
        lockSuiteFields={datasetLockSuiteFields}
        catalogOptions={catalogOptions}
        selectedCatalogId={selectedCatalogId}
        onChangeSelectedCatalogId={setSelectedCatalogId}
        includeReport={datasetIncludeReport}
        onChangeIncludeReport={setDatasetIncludeReport}
        reportUri={datasetReportUri}
        onChangeReportUri={setDatasetReportUri}
        onPrepareReport={handlePrepareReport}
        saving={registeringDataset}
        onHide={() => setDatasetDialogVisible(false)}
        onSave={handleRegisterDataset}
      />
      
      <ValidationDialog
        visible={validationDialogVisible}
        datasetFingerprint={validationDatasetFp}
        onChangeDatasetFingerprint={setValidationDatasetFp}
        resultURI={validationResultURI}
        onChangeResultURI={setValidationResultURI}
        reportURI={validationReportURI}
        onChangeReportURI={setValidationReportURI}
        validationHash={validationHash}
        onChangeValidationHash={setValidationHash}
        successful={validationSuccessful}
        onChangeSuccessful={setValidationSuccessful}
        preparing={validationPreparing}
        submitting={validationSubmitting}
        onPrepareResultFromJson={handlePrepareValidationResult}
        onHide={() => setValidationDialogVisible(false)}
        onSave={handleSubmitValidation}
      />

      
      <ClaimRewardDialog
        visible={claimDialogVisible}
        suiteId={claimSuiteId}
        datasetFingerprint={claimDatasetFp}
        onChangeDatasetFingerprint={setClaimDatasetFp}
        onHide={() => {
          if (!claimSubmitting && !claimPreparing) {
            setClaimDialogVisible(false);
            setClaimDatasetFp("");
            setClaimPrepared(null);    
            setClaimPreparing(false);
          }
        }}
        onSubmit={handleClaimReward}
        submitting={claimSubmitting}
        prepared={claimPrepared}
        preparing={claimPreparing}
      />

      <ConfirmDialog
        visible={confirmVisible}
        message={confirmMessage}
        onCancel={handleCancelConfirm}
        onConfirm={handleConfirm}
        confirmLoading={confirmLoading}
      />

    </div>
  );
}
