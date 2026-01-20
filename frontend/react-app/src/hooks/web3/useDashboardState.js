import { useState } from "react";

export function useDashboardState() {
  // loading
  const [loadingSuites, setLoadingSuites] = useState(false);
  const [loadingDatasets, setLoadingDatasets] = useState(false);

  // registry contracts
  const [suiteContract, setSuiteContract] = useState(null);
  const [datasetContract, setDatasetContract] = useState(null);
  const [validationContract, setValidationContract] = useState(null);
  const [categoryContract, setCategoryContract] = useState(null);
  const [fileFormatContract, setFileFormatContract] = useState(null);
  const [validatorsContract, setValidatorsContract] = useState(null);

  // events
  const [suiteEvents, setSuiteEvents] = useState([]);
  const [datasetEvents, setDatasetEvents] = useState([]);
  const [validationEvents, setValidationEvents] = useState([]);

  const [catEvents, setCatEvents] = useState([]);
  const [catExpanded, setCatExpanded] = useState(false);
  const [catLoading, setCatLoading] = useState(false);

  const [fmtEvents, setFmtEvents] = useState([]);
  const [fmtExpanded, setFmtExpanded] = useState(false);
  const [fmtLoading, setFmtLoading] = useState(false);

  const [valRegEvents, setValRegEvents] = useState([]);
  const [valRegExpanded, setValRegExpanded] = useState(false);
  const [valRegLoading, setValRegLoading] = useState(false);
  // dataset registry events UI
  const [datasetExpanded, setDatasetExpanded] = useState(false);
  const [datasetLoading, setDatasetLoading] = useState(false);
  const [datasetEventFilter, setDatasetEventFilter] = useState(null);
  // validation registry events UI
  const [validationExpanded, setValidationExpanded] = useState(false);
  const [validationLoading, setValidationLoading] = useState(false);
  const [validationEventFilter, setValidationEventFilter] = useState(null);

    // dataset request registry events UI (DatasetRequestRegistry)
  const [datasetRequestsExpanded, setDatasetRequestsExpanded] = useState(false);
  const [datasetRequestsLoading, setDatasetRequestsLoading] = useState(false);
  const [datasetRequestEventFilter, setDatasetRequestEventFilter] = useState(null);


  // filters
  const [globalFilter, setGlobalFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState(null);
  const [catEventFilter, setCatEventFilter] = useState(null);
  const [fmtEventFilter, setFmtEventFilter] = useState(null);
  const [valRegEventFilter, setValRegEventFilter] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState(null);
  const [fileFormatFilter, setFileFormatFilter] = useState(null);

  // dialogs
  const [categoryDialogVisible, setCategoryDialogVisible] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState("");
  const [categorySubmitting, setCategorySubmitting] = useState(false);


  const [formatDialogVisible, setFormatDialogVisible] = useState(false);
  const [formatToEdit, setFormatToEdit] = useState("");
  const [formatSubmitting, setFormatSubmitting] = useState(false);


  const [validatorDialogVisible, setValidatorDialogVisible] = useState(false);
  const [validatorAddress, setValidatorAddress] = useState("");
  const [validatorDescription, setValidatorDescription] = useState("");
  const [validatorCodeURI, setValidatorCodeURI] = useState("");
  const [validatorCodeHash, setValidatorCodeHash] = useState("");
  const [validatorActive, setValidatorActive] = useState(true);
  const [validatorMode, setValidatorMode] = useState("add");
  const [validatorSubmitting, setValidatorSubmitting] = useState(false);

  const [datasetDialogVisible, setDatasetDialogVisible] = useState(false);
  const [datasetUri, setDatasetUri] = useState("");
  const [datasetSuiteHash, setDatasetSuiteHash] = useState("");
  const [datasetFileFormat, setDatasetFileFormat] = useState("");
  const [datasetReportUri, setDatasetReportUri] = useState("");
  const [datasetIncludeReport, setDatasetIncludeReport] = useState(false);
  const [datasetLockSuiteFields, setDatasetLockSuiteFields] = useState(false);
  const [registeringDataset, setRegisteringDataset] = useState(false);

  const [catalogOptions, setCatalogOptions] = useState([]);
  const [selectedCatalogId, setSelectedCatalogId] = useState(null);

  // validation dialog
  const [validationDialogVisible, setValidationDialogVisible] = useState(false);
  const [validationDatasetFp, setValidationDatasetFp] = useState("");
  const [validationResultURI, setValidationResultURI] = useState("");
  const [validationHash, setValidationHash] = useState("");
  const [validationSuccessful, setValidationSuccessful] = useState(true);
  const [validationReportURI, setValidationReportURI] = useState("");
  const [validationPreparing, setValidationPreparing] = useState(false);
  const [validationSubmitting, setValidationSubmitting] = useState(false);


  // claim dialog
  const [claimDialogVisible, setClaimDialogVisible] = useState(false);
  const [claimSuiteId, setClaimSuiteId] = useState(null);
  const [claimDatasetFp, setClaimDatasetFp] = useState("");
  const [claimSubmitting, setClaimSubmitting] = useState(false);
  const [claimPrepared, setClaimPrepared] = useState(null);
  const [claimPreparing, setClaimPreparing] = useState(false);
  const [claimCtx, setClaimCtx] = useState(null);

  // confirm dialog
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmLoading, setConfirmLoading] = useState(false);

  

  return {
    // loading
    loadingSuites, setLoadingSuites,
    loadingDatasets, setLoadingDatasets,

    // contracts
    suiteContract, setSuiteContract,
    datasetContract, setDatasetContract,
    validationContract, setValidationContract,
    categoryContract, setCategoryContract,
    fileFormatContract, setFileFormatContract,
    validatorsContract, setValidatorsContract,

    // events
    suiteEvents, setSuiteEvents,
    datasetEvents, setDatasetEvents,
    validationEvents, setValidationEvents,
    catEvents, setCatEvents,
    fmtEvents, setFmtEvents,
    valRegEvents, setValRegEvents,
    datasetExpanded, setDatasetExpanded,
    datasetLoading, setDatasetLoading,
    datasetEventFilter, setDatasetEventFilter,
    validationExpanded, setValidationExpanded,
    validationLoading, setValidationLoading,
    validationEventFilter, setValidationEventFilter,
    
    // dataset request registry UI
    datasetRequestsExpanded, setDatasetRequestsExpanded,
    datasetRequestsLoading, setDatasetRequestsLoading,
    datasetRequestEventFilter, setDatasetRequestEventFilter,

    // expanded/loading
    catExpanded, setCatExpanded,
    fmtExpanded, setFmtExpanded,
    valRegExpanded, setValRegExpanded,
    catLoading, setCatLoading,
    fmtLoading, setFmtLoading,
    valRegLoading, setValRegLoading,

    // filters
    globalFilter, setGlobalFilter,
    statusFilter, setStatusFilter,
    catEventFilter, setCatEventFilter,
    fmtEventFilter, setFmtEventFilter,
    valRegEventFilter, setValRegEventFilter,
    categoryFilter, setCategoryFilter,
    fileFormatFilter, setFileFormatFilter,

    // dialogs
    categoryDialogVisible, setCategoryDialogVisible,
    categoryToEdit, setCategoryToEdit,
    categorySubmitting, setCategorySubmitting,

    formatDialogVisible, setFormatDialogVisible,
    formatToEdit, setFormatToEdit,
    formatSubmitting, setFormatSubmitting,

    validatorSubmitting, setValidatorSubmitting,    
    validatorDialogVisible, setValidatorDialogVisible,
    validatorAddress, setValidatorAddress,
    validatorDescription, setValidatorDescription,
    validatorCodeURI, setValidatorCodeURI,
    validatorCodeHash, setValidatorCodeHash,
    validatorActive, setValidatorActive,
    validatorMode, setValidatorMode,

    datasetDialogVisible, setDatasetDialogVisible,
    datasetUri, setDatasetUri,
    datasetSuiteHash, setDatasetSuiteHash,
    datasetFileFormat, setDatasetFileFormat,
    datasetReportUri, setDatasetReportUri,
    datasetIncludeReport, setDatasetIncludeReport,
    datasetLockSuiteFields, setDatasetLockSuiteFields,
    registeringDataset, setRegisteringDataset,

    // catalog
    catalogOptions, setCatalogOptions,
    selectedCatalogId, setSelectedCatalogId,
  

    // validation
    validationDialogVisible, setValidationDialogVisible,
    validationDatasetFp, setValidationDatasetFp,
    validationResultURI, setValidationResultURI,
    validationHash, setValidationHash,
    validationSuccessful, setValidationSuccessful,
    validationReportURI, setValidationReportURI,
    validationPreparing, setValidationPreparing,
    validationSubmitting, setValidationSubmitting,

    // claim
    claimDialogVisible, setClaimDialogVisible,
    claimSuiteId, setClaimSuiteId,
    claimDatasetFp, setClaimDatasetFp,
    claimSubmitting, setClaimSubmitting,
    claimPrepared, setClaimPrepared,
    claimPreparing, setClaimPreparing,
    claimCtx, setClaimCtx,

    // confirm
    confirmVisible, setConfirmVisible,
    confirmMessage, setConfirmMessage,
    confirmLoading, setConfirmLoading
  };
}
