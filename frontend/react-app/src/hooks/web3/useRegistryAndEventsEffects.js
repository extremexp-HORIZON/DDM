// src/hooks/web3/useRegistryAndEventsEffects.js
import { useCallback, useEffect } from "react";
import { CATALOG_API } from "../../api/catalog";
import { BLOCKCHAIN_API } from "../../api/blockchain";

export function useRegistryAndEventsEffects({
  network,
  toastRef,

  // current contract rows (state)
  categoryContract,
  fileFormatContract,
  validatorsContract,
  suiteContract,
  datasetContract,
  validationContract,

  // setters
  setCatalogOptions,

  setSuiteContract,
  setDatasetContract,
  setValidationContract,
  setCategoryContract,
  setFileFormatContract,
  setValidatorsContract,

  setCatEvents,
  setFmtEvents,
  setValRegEvents,
  setSuiteEvents,
  setDatasetEvents,
  setValidationEvents,

  setLoadingSuites,
  setLoadingDatasets,
}) {
  // ----------------------------
  // catalog
  // ----------------------------
  useEffect(() => {
    async function loadCatalog() {
      try {
        const params = { page: 1, perPage: 100, sort: "created,desc" };
        const res = await CATALOG_API.fetchMyCatalog(params);
        const rows = res.data || [];

        const opts = rows.map((file) => {
          const finalFilename =
            file.final_filename ||
            file.user_filename ||
            file.filename ||
            file.original_filename ||
            `${file.id}.csv`;

          const zenohPath = `projects/${file.project_id}/files/${file.id}/${finalFilename}`;

          const explicitFmt = file.file_format || file.file_type;
          const inferredFmt = finalFilename.includes(".")
            ? finalFilename.split(".").pop().toLowerCase()
            : "";
          const fileFormat = (explicitFmt || inferredFmt || "").toLowerCase();

          const useCases = Array.isArray(file.use_case)
            ? file.use_case
            : file.use_case
            ? [file.use_case]
            : [];

          return {
            label:
              file.user_filename ||
              file.filename ||
              file.original_filename ||
              file.id ||
              "dataset",
            value: file.id,
            path: zenohPath,
            fileFormat,
            description:
              file.description ||
              (Array.isArray(file.descriptions)
                ? file.descriptions.join(", ")
                : file.descriptions || ""),
            projectId: file.project_id,
            useCases,
            uploadedAt: file.created || file.uploaded_at,
          };
        });

        setCatalogOptions(opts);
      } catch (err) {
        const msg =
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          String(err);

        toastRef.current?.show({
          severity: "warn",
          summary: "Failed to load catalog",
          detail: msg,
        });
      }
    }

    loadCatalog();
  }, [network, toastRef, setCatalogOptions]);

  // ----------------------------
  // registry contracts
  // ----------------------------
  useEffect(() => {
    async function fetchRegistry() {
      try {
        const res = await BLOCKCHAIN_API.getRegistry();
        const rows = res.data?.data || [];
        const filtered = rows.filter((r) => r.network === network);

        const findByName = (name) =>
          filtered.find((r) => r.name === name) || null;

        setSuiteContract(findByName("DatasetRequestRegistry"));
        setDatasetContract(findByName("DatasetRegistry"));
        setValidationContract(findByName("ValidationRegistry"));
        setCategoryContract(findByName("CategoryRegistry"));
        setFileFormatContract(findByName("FileFormatRegistry"));
        setValidatorsContract(findByName("ValidatorsRegistry"));
      } catch (err) {
        const msg =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          String(err);

        toastRef.current?.show({
          severity: "error",
          summary: "Failed to load registry",
          detail: msg,
        });
      }
    }

    fetchRegistry();
  }, [
    network,
    toastRef,
    setSuiteContract,
    setDatasetContract,
    setValidationContract,
    setCategoryContract,
    setFileFormatContract,
    setValidatorsContract,
  ]);

  // ----------------------------
  // loaders
  // ----------------------------
  const loadRegistryEvents = useCallback(
    async (which) => {
      try {
        let contract;
        if (which === "category") contract = categoryContract;
        if (which === "fileFormat") contract = fileFormatContract;
        if (which === "validators") contract = validatorsContract;
        if (!contract?.address) return;

        const params = { network, perPage: 1000, sort: "block_number,asc" };
        const res = await BLOCKCHAIN_API.getContractEvents(contract.address, params);
        const events = res.data?.data || [];

        if (which === "category") setCatEvents(events);
        if (which === "fileFormat") setFmtEvents(events);
        if (which === "validators") setValRegEvents(events);
      } catch (err) {
        const msg =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          String(err);

        toastRef.current?.show({
          severity: "error",
          summary: "Failed to load registry events",
          detail: msg,
        });
      }
    },
    [
      network,
      toastRef,
      categoryContract,
      fileFormatContract,
      validatorsContract,
      setCatEvents,
      setFmtEvents,
      setValRegEvents,
    ]
  );

  // ✅ AUTO-LOAD registry events so “Registered …” shows without expanding
  useEffect(() => {
    if (categoryContract?.address) loadRegistryEvents("category");
  }, [categoryContract?.address, loadRegistryEvents]);

  useEffect(() => {
    if (fileFormatContract?.address) loadRegistryEvents("fileFormat");
  }, [fileFormatContract?.address, loadRegistryEvents]);

  useEffect(() => {
    if (validatorsContract?.address) loadRegistryEvents("validators");
  }, [validatorsContract?.address, loadRegistryEvents]);

  // ----------------------------
  // suites events
  // ----------------------------
  const reloadSuiteEvents = useCallback(async () => {
    if (!suiteContract?.address) return;

    setLoadingSuites(true);
    try {
      const params = { network, perPage: 1000, sort: "block_number,asc" };
      const res = await BLOCKCHAIN_API.getContractEvents(suiteContract.address, params);

      const all = res.data?.data || [];
      const filtered = all.filter((ev) =>
        ["DatasetRequestCreated", "DatasetRewardClaimed", "DatasetRequestClosed"].includes(ev.name)
      );
      setSuiteEvents(filtered);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        String(err);

      toastRef.current?.show({
        severity: "error",
        summary: "Failed to load suite events",
        detail: msg,
      });
    } finally {
      setLoadingSuites(false);
    }
  }, [suiteContract?.address, network, toastRef, setLoadingSuites, setSuiteEvents]);

  useEffect(() => {
    if (suiteContract?.address) reloadSuiteEvents();
  }, [suiteContract?.address, reloadSuiteEvents]);

  // ----------------------------
  // dataset + validation events
    // ----------------------------
    const reloadDatasetAndValidationEvents = useCallback(async () => {
        // ✅ allow partial loading
        if (!datasetContract?.address && !validationContract?.address) return;

        setLoadingDatasets(true);
        try {
            const params = { network, perPage: 1000, sort: "block_number,asc" };

            const [dsRes, vrRes] = await Promise.all([
            datasetContract?.address
                ? BLOCKCHAIN_API.getContractEvents(datasetContract.address, params)
                : Promise.resolve({ data: { data: [] } }),

            validationContract?.address
                ? BLOCKCHAIN_API.getContractEvents(validationContract.address, params)
                : Promise.resolve({ data: { data: [] } }),
            ]);

            if (datasetContract?.address) setDatasetEvents(dsRes.data?.data || []);
            if (validationContract?.address) setValidationEvents(vrRes.data?.data || []);
        } catch (err) {
            const msg =
            err?.response?.data?.message ||
            err?.response?.data?.error ||
            err?.message ||
            String(err);

            toastRef.current?.show({
            severity: "error",
            summary: "Failed to load dataset/validation events",
            detail: msg,
        });
        } finally {
            setLoadingDatasets(false);
        }
        }, [
            datasetContract?.address,
            validationContract?.address,
            network,
            toastRef,
            setLoadingDatasets,
            setDatasetEvents,
            setValidationEvents,
        ]);

    useEffect(() => {
        if (datasetContract?.address || validationContract?.address) {
            reloadDatasetAndValidationEvents();
        }
    }, [datasetContract?.address, validationContract?.address, reloadDatasetAndValidationEvents]);

    return {
        loadRegistryEvents,
        reloadSuiteEvents,
        reloadDatasetAndValidationEvents,
    };
}
