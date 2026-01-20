import { useRef, useState } from "react";
import { useMetamaskContext } from "../../context/MetamaskContext";
import { useToast } from "../../context/ToastContext";

import { useDashboardState } from "./useDashboardState";
import { useRegistryAndEventsEffects } from "./useRegistryAndEventsEffects";
import { useDashboardDerived } from "./useDashboardDerived";
import { useDashboardActions } from "./useDashboardActions";

export function useSuiteRequestsDashboardData() {
  const toastRef = useToast();
  const { wallet, ensureSepolia, connect, web3 } = useMetamaskContext();
  const [network, setNetwork] = useState("sepolia");
  const confirmActionRef = useRef(null);

  const state = useDashboardState();

  const effects = useRegistryAndEventsEffects({
    network,
    toastRef,

    // contracts (from state)
    categoryContract: state.categoryContract,
    fileFormatContract: state.fileFormatContract,
    validatorsContract: state.validatorsContract,

    // setters/state that effects needs
    setCatalogOptions: state.setCatalogOptions,

    setSuiteContract: state.setSuiteContract,
    setDatasetContract: state.setDatasetContract,
    setValidationContract: state.setValidationContract,
    setCategoryContract: state.setCategoryContract,
    setFileFormatContract: state.setFileFormatContract,
    setValidatorsContract: state.setValidatorsContract,

    setCatExpanded: state.setCatExpanded,
    setFmtExpanded: state.setFmtExpanded,
    setValRegExpanded: state.setValRegExpanded,
    setDsExpanded: state.setDatasetExpanded,
    setCatEvents: state.setCatEvents,
    setFmtEvents: state.setFmtEvents,
    setValRegEvents: state.setValRegEvents,
    setSuiteEvents: state.setSuiteEvents,
    setDatasetEvents: state.setDatasetEvents,
    setValidationEvents: state.setValidationEvents,
    setCatEventFilter: state.setCatEventFilter,
    setFmtEventFilter: state.setFmtEventFilter,
    setValRegEventFilter: state.setValRegEventFilter,
    setDatasetRequestsExpanded: state.setDatasetRequestsExpanded,


    suiteContract: state.suiteContract,
    datasetContract: state.datasetContract,
    validationContract: state.validationContract,

    setLoadingSuites: state.setLoadingSuites,
    setLoadingDatasets: state.setLoadingDatasets,
  });

  const derived = useDashboardDerived({
    ...state,
    suiteEvents: state.suiteEvents,
    datasetEvents: state.datasetEvents,
    validationEvents: state.validationEvents,
    catEvents: state.catEvents,
    fmtEvents: state.fmtEvents,
    valRegEvents: state.valRegEvents,
  });

  const actions = useDashboardActions({
    network,
    wallet,
    ensureSepolia,
    connect,
    web3,
    toastRef,
    confirmActionRef,
    ...state,
    ...effects,
    ...derived,
  });

  // ✅ use state + effects.loadRegistryEvents
  const toggleCategory = async () => {
    const next = !state.catExpanded;
    state.setCatExpanded(next);
    if (next && (state.catEvents?.length || 0) === 0) {
      state.setCatLoading(true);
      await effects.loadRegistryEvents("category");
      state.setCatLoading(false);
    }
  };

  const toggleFileFormat = async () => {
    const next = !state.fmtExpanded;
    state.setFmtExpanded(next);
    if (next && (state.fmtEvents?.length || 0) === 0) {
      state.setFmtLoading(true);
      await effects.loadRegistryEvents("fileFormat");
      state.setFmtLoading(false);
    }
  };

  const toggleValidators = async () => {
    const next = !state.valRegExpanded;
    state.setValRegExpanded(next);
    if (next && (state.valRegEvents?.length || 0) === 0) {
      state.setValRegLoading(true);
      await effects.loadRegistryEvents("validators");
      state.setValRegLoading(false);
    }
  };

    // dataset registry events toggle
    const toggleDatasetRegistry = async () => {
        const next = !state.datasetExpanded;
        state.setDatasetExpanded(next);
        if (!next) return;

        if ((state.datasetEvents?.length || 0) === 0) {
            state.setDatasetLoading(true);
            try {
            await effects.reloadDatasetAndValidationEvents?.();
            } finally {
            state.setDatasetLoading(false);
            }
        }
    };

    // validation registry events toggle
    const toggleValidationRegistry = async () => {
        const next = !state.validationExpanded;
        state.setValidationExpanded(next);
        if (!next) return;

        if ((state.validationEvents?.length || 0) === 0) {
            state.setValidationLoading(true);
            try {
            await effects.reloadDatasetAndValidationEvents?.();
            } finally {
            state.setValidationLoading(false);
            }
        }
    };

    const toggleDatasetRequestRegistry = async () => {
        const next = !state.datasetRequestsExpanded;
        state.setDatasetRequestsExpanded(next);
        if (!next) return;
        if ((state.suiteEvents?.length || 0) === 0) {
            state.setLoadingSuites(true);
            try {
            await effects.reloadSuiteEvents?.();
            } finally {
            state.setLoadingSuites(false);
            }
        }
    }


  return {
    network,
    setNetwork,
    ...state,
    ...effects,
    ...derived,
    ...actions,
    toggleCategory,
    toggleFileFormat,
    toggleValidators,
    toggleDatasetRegistry,
    toggleValidationRegistry,
    toggleDatasetRequestRegistry,
    confirmActionRef,
  };
}
