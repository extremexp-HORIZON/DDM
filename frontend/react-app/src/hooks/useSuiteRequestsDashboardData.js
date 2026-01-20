// src/hooks/useSuiteRequestsDashboardData.js
import { useEffect, useMemo, useRef, useState } from "react";
import { useMetamaskContext } from "../context/MetamaskContext";
import { CATALOG_API } from "../api/catalog"; 
import { BLOCKCHAIN_API } from "../api/blockchain";

import { pollTaskResult } from "../api/tasks";
import { useToast } from "../context/ToastContext";
import {
  weiToEth,
  countEventsByName,
} from "../utils/web3DashboardUtils";


export function useSuiteRequestsDashboardData() {
  const toastRef = useToast();
  const { wallet, ensureSepolia, connect, web3  } = useMetamaskContext();

  const [network, setNetwork] = useState("sepolia");

  const [loadingSuites, setLoadingSuites] = useState(false);
  const [loadingDatasets, setLoadingDatasets] = useState(false);

  const [suiteContract, setSuiteContract] = useState(null);
  const [datasetContract, setDatasetContract] = useState(null);
  const [validationContract, setValidationContract] = useState(null);
  const [categoryContract, setCategoryContract] = useState(null);
  const [fileFormatContract, setFileFormatContract] = useState(null);
  const [validatorsContract, setValidatorsContract] = useState(null);

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

  const [formatDialogVisible, setFormatDialogVisible] = useState(false);
  const [formatToEdit, setFormatToEdit] = useState("");

  const [validatorDialogVisible, setValidatorDialogVisible] = useState(false);
  const [validatorAddress, setValidatorAddress] = useState("");
  const [validatorDescription, setValidatorDescription] = useState("");
  const [validatorCodeURI, setValidatorCodeURI] = useState("");
  const [validatorCodeHash, setValidatorCodeHash] = useState("");
  const [validatorActive, setValidatorActive] = useState(true);
  const [validatorMode, setValidatorMode] = useState("add"); // "add" | "update"
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

    // validation submit dialog
  const [validationDialogVisible, setValidationDialogVisible] = useState(false);
  const [validationDatasetFp, setValidationDatasetFp] = useState("");
  const [validationResultURI, setValidationResultURI] = useState("");
  const [validationHash, setValidationHash] = useState("");
  const [validationSuccessful, setValidationSuccessful] = useState(true);
  const [validationReportURI, setValidationReportURI] = useState("");
  const [claimDialogVisible, setClaimDialogVisible] = useState(false);
  const [claimSuiteId, setClaimSuiteId] = useState(null);
  const [claimDatasetFp, setClaimDatasetFp] = useState("");
  const [claimSubmitting, setClaimSubmitting] = useState(false);
  const [claimPrepared, setClaimPrepared] = useState(null);
  const [claimPreparing, setClaimPreparing] = useState(false);


  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");

  const confirmActionRef = useRef(null);

  const ensureWallet = async () => {
    if (wallet) return wallet;        
    const addr = await connect();     
    return addr;
  };

  // Use MetaMask's web3 for write calls
  const mkWriteContract = (row) => {
    if (!web3 || !row?.abi || !row?.address) return null;
    return new web3.eth.Contract(row.abi, row.address);
  };

  // Try to extract a useful revert message from MetaMask / node error shapes
  const extractRevertReason = (err) => {
    const raw =
      err?.data?.message ||
      err?.data?.originalError?.message ||
      err?.error?.message ||
      err?.message ||
      "";

    if (!raw) return "Smart contract call reverted";

    // Strip common prefixes like "execution reverted: " etc.
    return raw
      .replace("Internal JSON-RPC error.", "")
      .replace("execution reverted:", "")
      .replace("execution reverted", "")
      .trim() || "Smart contract call reverted";
  };


  const askConfirm = (message, action) => {
    setConfirmMessage(message);
    confirmActionRef.current = action;
    setConfirmVisible(true);
  };

  const handleConfirm = async () => {
    const fn = confirmActionRef.current;
    setConfirmVisible(false);
    confirmActionRef.current = null;
    if (fn) {
      await fn();
    }
  };

  const handleCancelConfirm = () => {
    setConfirmVisible(false);
    confirmActionRef.current = null;
  };

  const showError = (summary, err) => {
    const msg =
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      err?.message ||
      String(err);
    toastRef.current?.show({
      severity: "error",
      summary,
      detail: msg,
    });
  };

  const showSuccess = (summary, detail) => {
    toastRef.current?.show({
      severity: "success",
      summary,
      detail,
    });
  };
  
  const ingestTxSafe = async (contract, txHash, actionLabel, onIndexed) => {
    if (!contract?.address || !txHash) return;

    try {
        const { data } = await BLOCKCHAIN_API.ingestTx({
        network,
        address: contract.address,
        tx_hash: txHash,
        });

        if (data?.task_id) {
        // wait for backend indexing to finish
        try {
            await pollTaskResult(data.task_id, 2000, 120000); // 2s, 2min
        } catch (pollErr) {
            const msg =
            pollErr?.response?.data?.error ||
            pollErr?.response?.data?.message ||
            pollErr?.message ||
            String(pollErr);

            toastRef.current?.show({
            severity: "warn",
            summary: `${actionLabel} – ingest polling warning`,
            detail: msg,
            });
        }
        }

        // ✅ backend has ingested (or at least we tried to wait) – now refresh UI
        if (typeof onIndexed === "function") {
        await onIndexed();
        }
    } catch (e) {
        const msg =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        e?.message ||
        String(e);

        // non-fatal: we warn but don't break the main flow
        toastRef.current?.show({
            severity: "warn",
            summary: `${actionLabel} – ingest warning`,
            detail: msg,
        });

        // still let caller refresh if they want
        if (typeof onIndexed === "function") {
            await onIndexed();
        }
    }
    };

  // -------------------------------------------------------------
  // blockchain writes
  // -------------------------------------------------------------
    const handleSaveCategory = async () => {

        const category = (categoryToEdit || "").trim();
        if (!category) return;

        try {
            if (!wallet) {
            await connect();
            }
            await ensureSepolia?.();

            const c = mkWriteContract(categoryContract);
            if (!c) throw new Error("CategoryRegistry ABI/address not loaded");

            // preflight
            try {
                await c.methods.addCategory(category).call({ from: wallet });
            } catch (callErr) {
                const reason = extractRevertReason(callErr);
                throw new Error(`Smart contract rejected addCategory: ${reason}`);
            }

            const tx = await c.methods.addCategory(category).send({ from: wallet });

            showSuccess("Category added", `Tx: ${tx.transactionHash}`);
            setCategoryDialogVisible(false);
            setCategoryToEdit("");

            await ingestTxSafe(
                categoryContract,
                tx.transactionHash,
                "Category added",
                () => loadRegistryEvents("category")          // 👈 refresh *after* ingest
            );
        } catch (err) {
            console.error("handleSaveCategory error", err);
            showError("Failed to add category", err);
        }
    };

    const handleRemoveCategory = async (category) => {
        const cat = (category || "").trim();
        if (!cat) return;

        try {
            if (!wallet) {
                await connect();
            }
            await ensureSepolia?.();

            const c = mkWriteContract(categoryContract);
            if (!c) throw new Error("CategoryRegistry ABI/address not loaded");

            // preflight
            try {
                await c.methods.removeCategory(cat).call({ from: wallet });
            } catch (callErr) {
                const reason = extractRevertReason(callErr);
                throw new Error(`Smart contract rejected removeCategory: ${reason}`);
            }

            const tx = await c.methods.removeCategory(cat).send({ from: wallet });

            showSuccess("Category removed", `Tx: ${tx.transactionHash}`);

            await ingestTxSafe(
                categoryContract,
                tx.transactionHash,
                "Category removed",
                () => loadRegistryEvents("category")         
            );
        } catch (err) {
            console.error("handleRemoveCategory error", err);
            showError("Failed to remove category", err);
        }
    };

    const handleSaveFormat = async () => {
        const fmt = (formatToEdit || "").trim();
        if (!fmt) return;

        try {
            if (!wallet) {
                await connect();
            }
            await ensureSepolia?.();

            const c = mkWriteContract(fileFormatContract);
            if (!c) throw new Error("FileFormatRegistry ABI/address not loaded");

            // preflight
            try {
                await c.methods.addFormat(fmt).call({ from: wallet });
            } catch (callErr) {
                const reason = extractRevertReason(callErr);
                throw new Error(`Smart contract rejected addFormat: ${reason}`);
            }

            const tx = await c.methods.addFormat(fmt).send({ from: wallet });

            showSuccess("Format added", `Tx: ${tx.transactionHash}`);
            setFormatDialogVisible(false);
            setFormatToEdit("");

            await ingestTxSafe(
                fileFormatContract,
                tx.transactionHash,
                "Format added",
                () => loadRegistryEvents("fileFormat")        // 👈 after ingest
            );
        } catch (err) {
            console.error("handleSaveFormat error", err);
            showError("Failed to add format", err);
        }
    };

    const handleRemoveFormat = async (fmt) => {
        const format = (fmt || "").trim();
        if (!format) return;

        try {
            if (!wallet) {
                await connect();
            }
            await ensureSepolia?.();

            const c = mkWriteContract(fileFormatContract);
            if (!c) throw new Error("FileFormatRegistry ABI/address not loaded");

            // preflight
            try {
                await c.methods.removeFormat(format).call({ from: wallet });
            } catch (callErr) {
                const reason = extractRevertReason(callErr);
                throw new Error(`Smart contract rejected removeFormat: ${reason}`);
            }

            const tx = await c.methods.removeFormat(format).send({ from: wallet });

            showSuccess("Format removed", `Tx: ${tx.transactionHash}`);

            await ingestTxSafe(
                fileFormatContract,
                tx.transactionHash,
                "Format removed",
                () => loadRegistryEvents("fileFormat")        // 👈 after ingest
            );
        } catch (err) {
            console.error("handleRemoveFormat error", err);
            showError("Failed to remove format", err);
        }
    };

   const handleSaveValidator = async () => {
        if (!validatorAddress) return;

        try {
            if (!wallet) {
            await connect();
            }
            await ensureSepolia?.();

            const c = mkWriteContract(validatorsContract);
            if (!c) throw new Error("ValidatorsRegistry ABI/address not loaded");

            let tx;
            if (validatorMode === "add") {
            // preflight add
            try {
                await c.methods
                .addValidator(
                    validatorAddress,
                    validatorDescription,
                    validatorCodeURI,
                    validatorCodeHash
                )
                .call({ from: wallet });
            } catch (callErr) {
                const reason = extractRevertReason(callErr);
                throw new Error(`Smart contract rejected addValidator: ${reason}`);
            }

            tx = await c.methods
                .addValidator(
                validatorAddress,
                validatorDescription,
                validatorCodeURI,
                validatorCodeHash
                )
                .send({ from: wallet });

            showSuccess("Validator added", `Tx: ${tx.transactionHash}`);
            } else {
            // preflight update
            try {
                await c.methods
                .updateValidator(
                    validatorAddress,
                    validatorDescription,
                    validatorCodeURI,
                    validatorCodeHash,
                    validatorActive
                )
                .call({ from: wallet });
            } catch (callErr) {
                const reason = extractRevertReason(callErr);
                throw new Error(`Smart contract rejected updateValidator: ${reason}`);
            }

            tx = await c.methods
                .updateValidator(
                validatorAddress,
                validatorDescription,
                validatorCodeURI,
                validatorCodeHash,
                validatorActive
                )
                .send({ from: wallet });

            showSuccess("Validator updated", `Tx: ${tx.transactionHash}`);
            }

            // close + reset dialog
            setValidatorDialogVisible(false);
            setValidatorAddress("");
            setValidatorDescription("");
            setValidatorCodeURI("");
            setValidatorCodeHash("");
            setValidatorActive(true);
            setValidatorMode("add");

            await ingestTxSafe(
                validatorsContract,
                tx.transactionHash,
                validatorMode === "add" ? "Validator added" : "Validator updated",
                () => loadRegistryEvents("validators")        // 👈 after ingest
            );
        } catch (err) {
            console.error("handleSaveValidator error", err);
            showError("Failed to save validator", err);
        }
    };

    const handleRemoveValidator = async (address) => {
      const addr = (address || "").trim();
      if (!addr) return;

      try {
          if (!wallet) {
              await connect();
          }
          await ensureSepolia?.();

          const c = mkWriteContract(validatorsContract);
          if (!c) throw new Error("ValidatorsRegistry ABI/address not loaded");

          // preflight
          try {
            await c.methods.removeValidator(addr).call({ from: wallet });
          } catch (callErr) {
              const reason = extractRevertReason(callErr);
              throw new Error(`Smart contract rejected removeValidator: ${reason}`);
          }

          const tx = await c.methods.removeValidator(addr).send({ from: wallet });

          showSuccess("Validator removed", `Tx: ${tx.transactionHash}`);

          await ingestTxSafe(
              validatorsContract,
              tx.transactionHash,
              "Validator removed",
              () => loadRegistryEvents("validators")
          );
      } catch (err) {
          console.error("handleRemoveValidator error", err);
          showError("Failed to remove validator", err);
      }
    };

    const handleRegisterDataset = async () => {
      const uri = (datasetUri || "").trim();
      const suiteHashInput = (datasetSuiteHash || "").trim();
      const fileFormat = (datasetFileFormat || "").trim();
      const reportUri = datasetIncludeReport ? (datasetReportUri || "") : "";

      if (!uri || !suiteHashInput) {
        showError("Missing fields", new Error("URI and suiteHash are required"));
        return;
      }

      const suiteHash = suiteHashInput;

      try {
        setRegisteringDataset(true);

        // ✅ always use the address returned here (handles connect if needed)
        const from = await ensureWallet();
        await ensureSepolia?.();

        if (!window.ethereum) {
          throw new Error("MetaMask not available in this browser");
        }

        const c = mkWriteContract(datasetContract);
        if (!c) throw new Error("DatasetRegistry ABI/address not loaded");

        // Nonce for replay-protection
        const nonce = await c.methods.nonces(from).call();

        // Build the same payload as your backend expects
        const encoded = web3.eth.abi.encodeParameters(
          ["string", "string", "bytes32", "string", "string", "address", "uint256"],
          ["Register dataset:", uri, suiteHash, fileFormat, reportUri, from, nonce]
        );
        const messageHash = web3.utils.keccak256(encoded);

        // 🔐 1st MetaMask popup: sign message
        const signature = await window.ethereum.request({
          method: "personal_sign",
          params: [messageHash, from],
        });

        // (Optional) preflight – **does NOT create a tx on-chain**, just a local call
        // If you think this causes a “second transaction”, it does not; it just
        // helps surface revert reasons earlier. You can delete this block if you want.
        try {
          await c.methods
            .registerDataset(uri, suiteHash, fileFormat, reportUri, nonce, signature)
            .call({ from });
        } catch (callErr) {
          const reason = extractRevertReason(callErr);
          throw new Error(`Smart contract rejected registerDataset: ${reason}`);
        }

        // 💸 2nd MetaMask popup: actual transaction
        const tx = await c.methods
          .registerDataset(uri, suiteHash, fileFormat, reportUri, nonce, signature)
          .send({ from });

        showSuccess("Dataset registered", `Tx: ${tx.transactionHash}`);

        // reset + close dialog only after success
        setDatasetDialogVisible(false);
        setDatasetUri("");
        setDatasetSuiteHash("");
        setDatasetFileFormat("");
        setDatasetReportUri("");
        setDatasetIncludeReport(false);
        setDatasetLockSuiteFields(false);

        // tell backend + refresh UI
        await ingestTxSafe(
          datasetContract,
          tx.transactionHash,
          "Dataset registered"
        );
        await reloadDatasetAndValidationEvents();
      } catch (err) {
        console.error("handleRegisterDataset error", err);
        showError("Failed to register dataset", err);
      } finally {
        setRegisteringDataset(false);
      }
    };




    const handleStoreZenohMapping = async ({ zenohUri, datasetUri, suiteHash }) => {
      try {
        await BLOCKCHAIN_API.saveZenohMapping({
          network,
          zenoh_uri: zenohUri,
          dataset_uri: datasetUri,
          suite_hash: suiteHash,
        });
        showSuccess("Zenoh mapping stored", "Zenoh URI linked to dataset in backend.");
      } catch (err) {
        console.error("handleStoreZenohMapping error", err);
        showError("Failed to store Zenoh mapping", err);
        throw err;
      }
    };

    // useSuiteRequestsDashboardData.js
    const handlePrepareReport = async (id, opts = {}) => {
      if (!id) return null;

      const { includeReport = true } = opts;

      try {
        console.log("[prepare] calling prepareReportIPFSURI");
        const taskEnvelope = await BLOCKCHAIN_API.prepareReportIPFSURI({
          network,
          catalog_id: id,
          include_report: includeReport,
        });
        console.log("[prepare] taskEnvelope =", taskEnvelope);

        const taskId = taskEnvelope?.task_id || taskEnvelope?.taskId;
        if (!taskId) {
          throw new Error("No task_id returned from prepareReportIPFSURI");
        }

        console.log("[prepare] calling pollTaskResult for taskId", taskId);
        const taskRes = await pollTaskResult(taskId, 2000, 600000);
        console.log("[prepare] raw taskRes =", taskRes);

        // ✅ pollTaskResult already returns { result, state }
        // so unwrap `result` first; if it's missing, fallback to root
        const payload = taskRes?.result || taskRes || {};
        console.log("handlePrepareReport payload (unwrapped) =", payload);

        const reportUri =
          payload.report_uri ||
          payload.reportUri ||
          null;

        const fileFormat =
          payload.file_format ||
          payload.fileFormat ||
          "html";

        const prepared = { reportUri, fileFormat };
        console.log("handlePrepareReport prepared =", prepared);

        if (reportUri) {
          // 🔹 update global state used by DatasetRegisterDialog
          setDatasetReportUri(reportUri);
          setDatasetIncludeReport(true);

          showSuccess(
            "Report prepared",
            "Data-quality report uploaded to IPFS."
          );
        } else {
          throw new Error("Task finished but no report_uri found in payload");
        }

        return prepared;
      } catch (err) {
        console.error("handlePrepareReport error", err);
        showError("Failed to prepare dataset/report from catalog", err);
        throw err;
      }
    };


    const handlePrepareZenohFromCatalog = async (id) => {
      if (!id) return null;
      try {
        const data = await BLOCKCHAIN_API.prepareDatasetFromCatalog({
          network,
          catalog_id: id,
          transport: "zenoh", // hint to backend
        });

        const taskId = data?.task_id || data?.taskId;
        if (!taskId) {
          throw new Error("No task_id returned from prepare-from-catalog (zenoh)");
        }

        const taskRes = await pollTaskResult(taskId, 2000, 600000);
        const payload =
          taskRes?.data?.result || taskRes?.data?.data || taskRes?.data || {};

        const prepared = {
          uri: payload?.uri || "",
          suiteHash: payload?.suite_hash || payload?.suiteHash || "",
          fileFormat: payload?.file_format || payload?.fileFormat || "",
          zenohUri: payload?.zenoh_uri || payload?.zenohUri || "",
        };

        if (prepared.uri) setDatasetUri(prepared.uri);
        if (prepared.suiteHash) setDatasetSuiteHash(prepared.suiteHash);
        if (prepared.fileFormat) setDatasetFileFormat(prepared.fileFormat);

        // If backend returns a zenoh URI, store mapping
        if (prepared.zenohUri) {
          await handleStoreZenohMapping({
            zenohUri: prepared.zenohUri,
            datasetUri: prepared.uri,
            suiteHash: prepared.suiteHash,
          });
        }

        showSuccess(
          "Zenoh dataset prepared",
          "Dataset URI & suite hash loaded (Zenoh mapping handled in backend)."
        );

        return prepared;
      } catch (err) {
        console.error("handlePrepareZenohFromCatalog error", err);
        showError("Failed to prepare Zenoh dataset from catalog", err);
        throw err;
      }
    };



  // Create a dataset request on DatasetRequestRegistry (permissionless path)
  const handleCreateDatasetRequest = async ({
    suiteHash,
    suiteURI,
    docsURI,
    certificateURI,
    category,
    fileFormat,
    deadline,
    totalExpected,
    bountyWei,            // value to send in wei
  }) => {
    try {
      if (!suiteHash || !suiteURI || !category || !fileFormat) {
        throw new Error("suiteHash, suiteURI, category and fileFormat are required");
      }
      if (!deadline || !totalExpected) {
        throw new Error("Deadline and totalExpected are required");
      }
      if (!bountyWei) {
        throw new Error("Bounty (in wei) is required");
      }

      if (!wallet) {
        await connect();
      }
      await ensureSepolia?.();

      const c = mkWriteContract(suiteContract);
      if (!c) throw new Error("DatasetRequestRegistry ABI/address not loaded");

      const value = bountyWei.toString();

      // 🔍 preflight call – gives nice revert messages
      try {
        await c.methods
          .createDatasetRequest(
            suiteHash,
            suiteURI,
            docsURI || "",
            certificateURI || "",
            category,
            fileFormat,
            deadline,
            totalExpected
          )
          .call({ from: wallet, value });
      } catch (callErr) {
        const reason = extractRevertReason(callErr);
        throw new Error(
          `Smart contract rejected createDatasetRequest: ${reason}`
        );
      }

      // 🧾 send TX
      const tx = await c.methods
        .createDatasetRequest(
          suiteHash,
          suiteURI,
          docsURI || "",
          certificateURI || "",
          category,
          fileFormat,
          deadline,
          totalExpected
        )
        .send({ from: wallet, value });

      showSuccess("Dataset request created", `Tx: ${tx.transactionHash}`);

      // index + refresh suite cards
      await ingestTxSafe(
        suiteContract,
        tx.transactionHash,
        "Dataset request created",
        () => reloadSuiteEvents()
      );
    } catch (err) {
      console.error("handleCreateDatasetRequest error", err);
      showError("Failed to create dataset request", err);
    }
  };
  

  const handleSubmitValidation = async () => {
    const fp = (validationDatasetFp || "").trim();
    const uri = (validationResultURI || "").trim();
    const reportURI = (validationReportURI || "").trim(); // <-- add this state
    let hash = (validationHash || "").trim();
    const successful = !!validationSuccessful;

    if (!fp || !uri) {
      showError("Missing fields", new Error("Dataset fingerprint and result URI are required"));
      return;
    }

    try {
      if (!wallet) await connect();
      await ensureSepolia?.();

      const c = mkWriteContract(validationContract);
      if (!c) throw new Error("ValidationRegistry ABI/address not loaded");

      if (!hash) {
        hash = web3.utils.keccak256(uri);
      }

      // Optional: enforce bytes32 formatting early (avoids confusing reverts)
      if (!web3.utils.isHexStrict(fp) || fp.length !== 66) {
        throw new Error("Dataset fingerprint must be a bytes32 hex string (0x + 64 hex chars)");
      }
      if (!web3.utils.isHexStrict(hash) || hash.length !== 66) {
        throw new Error("Validation hash must be a bytes32 hex string (0x + 64 hex chars)");
      }

      // ✅ preflight
      try {
        await c.methods
          .submitValidation(fp, hash, uri, reportURI, successful)
          .call({ from: wallet });
      } catch (callErr) {
        const reason = extractRevertReason(callErr);
        throw new Error(`Smart contract rejected submitValidation: ${reason}`);
      }

      // ✅ send tx
      const tx = await c.methods
        .submitValidation(fp, hash, uri, reportURI, successful)
        .send({ from: wallet });

      showSuccess("Validation submitted", `Tx: ${tx.transactionHash}`);

      setValidationDialogVisible(false);
      setValidationDatasetFp("");
      setValidationResultURI("");
      setValidationReportURI(""); // <-- reset new field
      setValidationHash("");
      setValidationSuccessful(true);

      await ingestTxSafe(validationContract, tx.transactionHash, "Validation submitted");
      await reloadDatasetAndValidationEvents();
    } catch (err) {
      console.error("handleSubmitValidation error", err);
      showError("Failed to submit validation", err);
    }
  };


  
  const handleClaimReward = async (opts = {}) => {
    const { mintNft = true } = opts;

    const id = claimSuiteId;
    const fpInput = (claimDatasetFp || "").trim();

    const t0 = performance.now();
    const mark = (step, extra = {}) => {
      const ms = Math.round(performance.now() - t0);
      console.log(`[CLAIM ${ms}ms] ${step}`, {
        mintNft,
        id,
        fp: fpInput ? `${fpInput.slice(0, 10)}…${fpInput.slice(-6)}` : "",
        claimPrepared: !!claimPrepared,
        claimPreparing,
        claimSubmitting,
        wallet,
        network,
        ...extra,
      });
    };

    mark("CLICK");

    if (!id) {
      mark("ABORT no suite id");
      return showError("Missing suite id", new Error("No dataset request selected"));
    }
    if (!fpInput) {
      mark("ABORT no fingerprint");
      return showError("Missing dataset fingerprint", new Error("Fingerprint is required"));
    }

    if (!web3.utils.isHexStrict(fpInput) || fpInput.length !== 66) {
      mark("ABORT invalid fingerprint");
      return showError("Invalid fingerprint", new Error("Fingerprint must be bytes32: 0x + 64 hex chars"));
    }

    try {
      setClaimSubmitting(true);
      mark("setClaimSubmitting(true) called");

      // ---------------------------------------
      // OPTION 1: ETH-only claim (MetaMask)
      // ---------------------------------------
      if (!mintNft) {
        mark("PATH mintNft=false (ETH-only)");

        mark("before ensureSepolia");
        await ensureSepolia?.();
        mark("after ensureSepolia");

        mark("before ensureWallet");
        const from = await ensureWallet();
        mark("after ensureWallet", { from });

        mark("before mkWriteContract(suiteContract)");
        const c = mkWriteContract(suiteContract);
        mark("after mkWriteContract", { hasContract: !!c, addr: suiteContract?.address });
        if (!c) throw new Error("DatasetRequestRegistry ABI/address not loaded");

        mark("before preflight call claimRewardForDataset.call");
        try {
          await c.methods.claimRewardForDataset(id, fpInput).call({ from });
          mark("after preflight call OK");
        } catch (callErr) {
          mark("preflight call REVERT", { callErr });
          const reason = extractRevertReason(callErr);
          throw new Error(`Smart contract rejected claimRewardForDataset: ${reason}`);
        }

        mark(">>> BEFORE SEND claimRewardForDataset.send (THIS SHOULD TRIGGER TX POPUP)");
        const tx = await c.methods.claimRewardForDataset(id, fpInput).send({ from });
        mark("<<< AFTER SEND claimRewardForDataset.send", { txHash: tx?.transactionHash });

        showSuccess("Reward claimed", `Tx: ${tx.transactionHash}`);

        mark("reset dialog state");
        setClaimDialogVisible(false);
        setClaimSuiteId(null);
        setClaimDatasetFp("");
        setClaimPrepared(null);

        mark("before ingestTxSafe");
        await ingestTxSafe(suiteContract, tx.transactionHash, "Reward claimed", async () => {
          mark("ingestTxSafe onIndexed start");
          await reloadSuiteEvents();
          await reloadDatasetAndValidationEvents();
          mark("ingestTxSafe onIndexed done");
        });
        mark("done ETH-only");
        return;
      }

      // ---------------------------------------
      // OPTION 2: Claim + mint (PREPARE first, TX second)
      // ---------------------------------------
      mark("PATH mintNft=true");

      // STEP A: not prepared -> call backend and STOP (NO MetaMask / NO ensureSepolia)
      if (!claimPrepared) {
        mark("STEP A PREPARE (no claimPrepared yet)");

        setClaimPreparing(true);
        mark("setClaimPreparing(true) called");

        setClaimPrepared(null);
        mark("setClaimPrepared(null) called");

        mark("before ensureWallet for uploader");
        const uploader = wallet || (await ensureWallet());
        mark("after ensureWallet for uploader", { uploader });

        mark("before BLOCKCHAIN_API.prepareRewardClaim");
        const res = await BLOCKCHAIN_API.prepareRewardClaim({
          network,
          suite_id: id,
          dataset_fingerprint: fpInput,
          uploader,
          category: "dataset",
          level_text: "DATASET_VALIDATED",
        });
        mark("after BLOCKCHAIN_API.prepareRewardClaim", { res });

        const envelope = res?.data || {};
        const taskId = envelope.task_id || envelope.taskId;
        mark("taskId extracted", { taskId });

        if (!taskId) throw new Error("No task_id returned from prepareRewardClaim");

        mark("before pollTaskResult");
        const taskRes = await pollTaskResult(taskId, 2000, 180000);
        mark("after pollTaskResult", { taskRes });

        const prepared = taskRes?.result || taskRes || {};
        const nftCategory = prepared.category;
        const level = prepared.level;
        const metadataURI = prepared.metadataURI;
        const deadline = prepared.deadline;
        const signature = prepared.signature;

        mark("prepared fields", {
          nftCategory,
          level,
          metadataURI,
          deadline,
          sigLen: signature?.length,
        });

        if (!nftCategory || !level || !metadataURI || !deadline || !signature) {
          throw new Error("Prepare task succeeded but missing fields (category/level/metadataURI/deadline/signature)");
        }

        setClaimPrepared({
          category: nftCategory,
          level,
          metadataURI,
          deadline: String(deadline),
          signature,
        });
        mark("setClaimPrepared(payload) called");

        showSuccess("Prepared NFT", "Metadata/signature ready. Click again to Claim + Mint.");
        mark("RETURN after prepare (should NOT open TX popup)");
        return;
      }

      // STEP B: prepared -> NOW do chain switch + MetaMask tx
      mark("STEP B TX (claimPrepared already exists)");

      mark("before ensureSepolia");
      await ensureSepolia?.();
      mark("after ensureSepolia");

      mark("before ensureWallet");
      const from = await ensureWallet();
      mark("after ensureWallet", { from });

      mark("before mkWriteContract(suiteContract)");
      const c = mkWriteContract(suiteContract);
      mark("after mkWriteContract", { hasContract: !!c, addr: suiteContract?.address });
      if (!c) throw new Error("DatasetRequestRegistry ABI/address not loaded");

      const { category, level, metadataURI, deadline, signature } = claimPrepared;
      mark("using claimPrepared", { category, level, metadataURI, deadline, sigLen: signature?.length });

      mark("before preflight call claimRewardForDatasetAndMint.call");
      try {
        await c.methods
          .claimRewardForDatasetAndMint(id, fpInput, category, level, metadataURI, deadline, signature)
          .call({ from });
        mark("after preflight call OK");
      } catch (callErr) {
        mark("preflight call REVERT", { callErr });
        const reason = extractRevertReason(callErr);
        throw new Error(`Smart contract rejected claimRewardForDatasetAndMint: ${reason}`);
      }

      mark(">>> BEFORE SEND claimRewardForDatasetAndMint.send (THIS SHOULD TRIGGER TX POPUP)");
      const tx = await c.methods
        .claimRewardForDatasetAndMint(id, fpInput, category, level, metadataURI, deadline, signature)
        .send({ from });
      mark("<<< AFTER SEND claimRewardForDatasetAndMint.send", { txHash: tx?.transactionHash });

      showSuccess("Reward claimed + NFT minted", `Tx: ${tx.transactionHash}`);

      mark("reset dialog state");
      setClaimDialogVisible(false);
      setClaimSuiteId(null);
      setClaimDatasetFp("");
      setClaimPrepared(null);

      mark("before ingestTxSafe");
      await ingestTxSafe(suiteContract, tx.transactionHash, "Reward claimed + NFT minted", async () => {
        mark("ingestTxSafe onIndexed start");
        await reloadSuiteEvents();
        await reloadDatasetAndValidationEvents();
        mark("ingestTxSafe onIndexed done");
      });

      mark("done TX mint");
    } catch (err) {
      mark("CATCH error", { err });
      console.error("handleClaimReward error", err);
      showError("Failed to claim reward", err);
    } finally {
      mark("FINALLY begin");
      setClaimPreparing(false);
      setClaimSubmitting(false);
      mark("FINALLY end (state resets scheduled)");
    }
  };


  // Claim bounty for a specific dataset on a specific request
  const handleClaimRewardForDataset = async (requestId, datasetFingerprint) => {
    if (!requestId || !datasetFingerprint) return;

    try {
      if (!wallet) {
        await connect();
      }
      await ensureSepolia?.();

      const c = mkWriteContract(suiteContract);
      if (!c) throw new Error("DatasetRequestRegistry ABI/address not loaded");

      // preflight
      try {
        await c.methods
          .claimRewardForDataset(requestId, datasetFingerprint)
          .call({ from: wallet });
      } catch (callErr) {
        const reason = extractRevertReason(callErr);
        throw new Error(
          `Smart contract rejected claimRewardForDataset: ${reason}`
        );
      }

      const tx = await c.methods
        .claimRewardForDataset(requestId, datasetFingerprint)
        .send({ from: wallet });

      showSuccess("Reward claimed", `Tx: ${tx.transactionHash}`);

      await ingestTxSafe(
        suiteContract,
        tx.transactionHash,
        "Reward claimed",
        () => reloadSuiteEvents()
      );
    } catch (err) {
      console.error("handleClaimRewardForDataset error", err);
      showError("Failed to claim reward", err);
    }
  };


    // Cancel a dataset request and refund remaining bounty to requester
  const handleCancelAndRefund = async (requestId) => {
    if (!requestId) return;

    try {
      if (!wallet) {
        await connect();
      }
      await ensureSepolia?.();

      const c = mkWriteContract(suiteContract);
      if (!c) throw new Error("DatasetRequestRegistry ABI/address not loaded");

      // preflight
      try {
        await c.methods.cancelAndRefund(requestId).call({ from: wallet });
      } catch (callErr) {
        const reason = extractRevertReason(callErr);
        throw new Error(
          `Smart contract rejected cancelAndRefund: ${reason}`
        );
      }

      const tx = await c.methods
        .cancelAndRefund(requestId)
        .send({ from: wallet });

      showSuccess("Request cancelled / refunded", `Tx: ${tx.transactionHash}`);

      await ingestTxSafe(
        suiteContract,
        tx.transactionHash,
        "Request cancelled",
        () => reloadSuiteEvents()
      );
    } catch (err) {
      console.error("handleCancelAndRefund error", err);
      showError("Failed to cancel / refund request", err);
    }
  };




    // -------------------------------------------------------------
    // effects: registry contracts and events
    // -------------------------------------------------------------
  useEffect(() => {
    async function loadCatalog() {
      try {
        const params = {
          page: 1,
          perPage: 100,
          sort: "created,desc",
        };

        const res = await CATALOG_API.fetchMyCatalog(params);
        const rows = res.data || [];

        const opts = rows.map((file) => {
          const useCases = Array.isArray(file.use_case)
            ? file.use_case
            : file.use_case
            ? [file.use_case]
            : [];

          // 🔹 Decide "final filename" (what you actually stored in Zenoh)
          const finalFilename =
            file.final_filename ||
            file.user_filename ||
            file.filename ||
            file.original_filename ||
            `${file.id}.csv`;

          // 🔹 Build Zenoh path like you specified
          const zenohPath = `projects/${file.project_id}/files/${file.id}/${finalFilename}`;

          // 🔹 Decide file format
          const explicitFmt = file.file_format || file.file_type;
          const inferredFmt =
            finalFilename.includes(".")
              ? finalFilename.split(".").pop().toLowerCase()
              : "";
          const fileFormat = (explicitFmt || inferredFmt || "").toLowerCase();

          return {
            label:
              file.user_filename ||
              file.filename ||
              file.original_filename ||
              file.id ||
              "dataset",

            value: file.id,

            // 👇 used for autofill in dialog
            path: zenohPath,
            fileFormat,

            // extras used only for display
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
        console.error("loadCatalog error", err);
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
  }, [network, toastRef]);



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

        if (!findByName("DatasetRequestRegistry")) {
          toastRef.current?.show({
            severity: "warn",
            summary: "DatasetRequestRegistry not found",
            detail: `No DatasetRequestRegistry for network '${network}'`,
          });
        }
      } catch (err) {
        console.error(err);
        const msg =
          err.response?.data?.message ||
          err.response?.data?.error ||
          err.message ||
          String(err);
        toastRef.current?.show({
          severity: "error",
          summary: "Failed to load registry",
          detail: msg,
        });
      }
    }

    fetchRegistry();

    // reset when network changes
    setCatExpanded(false);
    setFmtExpanded(false);
    setValRegExpanded(false);
    setCatEvents([]);
    setFmtEvents([]);
    setValRegEvents([]);
    setSuiteEvents([]);
    setDatasetEvents([]);
    setValidationEvents([]);
    setCatEventFilter(null);
    setFmtEventFilter(null);
    setValRegEventFilter(null);
  }, [network, toastRef]);


 // reload DatasetRequestRegistry events (suite requests)
  const reloadSuiteEvents = async () => {
    if (!suiteContract?.address) return;

    setLoadingSuites(true);
    try {
      const params = {
        network,
        perPage: 1000,
        sort: "block_number,asc",
      };

      const res = await BLOCKCHAIN_API.getContractEvents(
        suiteContract.address,
        params
      );

      const all = res.data?.data || [];
      const filtered = all.filter((ev) =>
        [
          "DatasetRequestCreated",
          "DatasetRewardClaimed",
          "DatasetRequestClosed",
        ].includes(ev.name)
      );
      setSuiteEvents(filtered);
    } catch (err) {
      console.error(err);
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        String(err);
      toastRef.current?.show({
        severity: "error",
        summary: "Failed to load suite events",
        detail: msg,
      });
    } finally {
      setLoadingSuites(false);
    }
  };




  // suite events
  useEffect(() => {
    if (!suiteContract?.address) return;
    reloadSuiteEvents();
  }, [suiteContract, network, toastRef]);

const reloadDatasetAndValidationEvents = async () => {
    if (!datasetContract?.address || !validationContract?.address) return;

    setLoadingDatasets(true);
    try {
        const params = {
        network,
        perPage: 1000,
        sort: "block_number,asc",
        };

        const [dsRes, vrRes] = await Promise.all([
            BLOCKCHAIN_API.getContractEvents(datasetContract.address, params),
            BLOCKCHAIN_API.getContractEvents(validationContract.address, params),
        ]);

        setDatasetEvents(dsRes.data?.data || []);
        setValidationEvents(vrRes.data?.data || []);
    } catch (err) {
        console.error(err);
        const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        String(err);
        toastRef.current?.show({
        severity: "error",
        summary: "Failed to load dataset/validation events",
        detail: msg,
        });
    } finally {
        setLoadingDatasets(false);
    }
    };



  // -------------------------------------------------------------
  // aggregation
  // -------------------------------------------------------------
  const suites = useMemo(() => {
    const byId = new Map();

    for (const ev of suiteEvents) {
      const name = ev.name;
      const args = ev.args || {};
      const id = Number(args.id);
      if (!id || Number.isNaN(id)) continue;

      if (!byId.has(id)) {
        byId.set(id, {
          id,
          requester: args.requester || "",
          suiteHash: args.suiteHash || "",
          category: args.category || "",
          fileFormat: args.fileFormat || "",
          bountyWei: "0",
          bountyEth: 0,
          totalExpected: 0,
          totalClaims: 0,
          claimedEth: 0,
          remainingEth: 0,
          deadline: 0,
          isClosed: false,
          closedBy: null,
          refundWei: null,
          refundEth: null,
          suiteURI: "",
          docsURI: "",
          certificateURI: "",
        });
      }

      const row = byId.get(id);

      if (name === "DatasetRequestCreated") {
        const bountyWei = args.bounty?.toString() || "0";
        const bountyEth = weiToEth(bountyWei);

        row.requester = args.requester || row.requester;
        row.suiteHash = args.suiteHash || row.suiteHash;
        row.category = args.category || row.category;
        row.fileFormat = args.fileFormat || row.fileFormat;
        row.bountyWei = bountyWei;
        row.bountyEth = bountyEth;
        row.totalExpected = Number(args.expected || 0);
        row.deadline = Number(args.deadline || 0);
        row.suiteURI = args.suiteURI || row.suiteURI;
        row.docsURI = args.docsURI || row.docsURI;
        row.certificateURI = args.certificateURI || row.certificateURI;

        const claimedEth = row.claimedEth || 0;
        row.remainingEth = Math.max(bountyEth - claimedEth, 0);
      }

      if (name === "DatasetRewardClaimed") {
        const amountWei = args.amount?.toString() || "0";
        const amountEth = weiToEth(amountWei);
        row.totalClaims += 1;
        row.claimedEth = (row.claimedEth || 0) + amountEth;
        const bountyEth = row.bountyEth || 0;
        row.remainingEth = Math.max(bountyEth - row.claimedEth, 0);
      }

      if (name === "DatasetRequestClosed") {
        row.isClosed = true;
        row.closedBy = args.by || null;
        const refundWei = args.refund?.toString() || "0";
        row.refundWei = refundWei;
        row.refundEth = weiToEth(refundWei);
      }
    }

    return Array.from(byId.values()).sort((a, b) => a.id - b.id);
  }, [suiteEvents]);

  const datasets = useMemo(() => {
    const map = new Map();

    for (const ev of datasetEvents) {
      if (ev.name !== "DatasetRegistered") continue;
      const args = ev.args || {};
      const fp = args.fingerprint || args.datasetFingerprint;
      if (!fp) continue;

      const key = String(fp);
      if (!map.has(key)) {
        map.set(key, {
          fingerprint: key,
          uploader: args.uploader || "",
          uri: args.uri || "",
          suiteHash: args.suiteHash || "",
          fileFormat: args.fileFormat || "",
          registeredAt: Number(args.registeredAt || 0),
          validations: 0,
          lastStatus: null,
          validators: new Set(),
        });
      } else {
        const row = map.get(key);
        row.uploader = args.uploader || row.uploader;
        row.uri = args.uri || row.uri;
        row.suiteHash = args.suiteHash || row.suiteHash;
        row.fileFormat = args.fileFormat || row.fileFormat;
        row.registeredAt = Number(args.registeredAt || row.registeredAt || 0);
      }
    }

    for (const ev of validationEvents) {
      if (ev.name !== "ValidationSubmitted") continue;
      const args = ev.args || {};
      const fp =
        args.datasetFingerprint || args.fingerprint || args.dataset || null;
      if (!fp) continue;

      const key = String(fp);
      if (!map.has(key)) {
        map.set(key, {
          fingerprint: key,
          uploader: "",
          uri: "",
          suiteHash: "",
          fileFormat: "",
          registeredAt: 0,
          validations: 0,
          lastStatus: null,
          validators: new Set(),
        });
      }

      const row = map.get(key);
      row.validations += 1;
      row.validators.add(args.validator || "");
      if (args.successful === true || args.successful === "true") {
        row.lastStatus = "valid";
      } else if (row.lastStatus !== "valid") {
        row.lastStatus = "invalid";
      }
    }

    const arr = Array.from(map.values()).map((row) => ({
      ...row,
      validatorsCount: row.validators.size,
    }));

    arr.sort((a, b) => (b.registeredAt || 0) - (a.registeredAt || 0));
    return arr;
  }, [datasetEvents, validationEvents]);

  // registry mini-dash derivations
  const allowedCategories = useMemo(() => {
    const set = new Set();
    const ordered = [...catEvents].sort(
      (a, b) => a.block_number - b.block_number || a.log_index - b.log_index
    );
    for (const ev of ordered) {
      const args = ev.args || {};
      if (ev.name === "CategoryAdded" && args.category) {
        set.add(args.category);
      }
      if (ev.name === "CategoryRemoved" && args.category) {
        set.delete(args.category);
      }
    }
    return Array.from(set.values());
  }, [catEvents]);

  const allowedFormats = useMemo(() => {
    const set = new Set();
    const ordered = [...fmtEvents].sort(
      (a, b) => a.block_number - b.block_number || a.log_index - b.log_index
    );
    for (const ev of ordered) {
      const args = ev.args || {};
      if (ev.name === "FormatAdded" && args.format_) {
        set.add(args.format_);
      }
      if (ev.name === "FormatRemoved" && args.format_) {
        set.delete(args.format_);
      }
    }
    return Array.from(set.values());
  }, [fmtEvents]);

  const suiteHashToCategory = useMemo(() => {
    const m = new Map();
    suites.forEach((s) => {
      if (s.suiteHash) {
        m.set(s.suiteHash.toLowerCase(), s.category);
      }
    });
    return m;
  }, [suites]);

  const categoryOptions = useMemo(() => {
    const set = new Set();

    (allowedCategories || []).forEach((c) => c && set.add(c));
    (suites || []).forEach((s) => s.category && set.add(s.category));

    return [
      { label: "All categories", value: null },
      ...Array.from(set)
        .sort()
        .map((c) => ({ label: c, value: c })),
    ];
  }, [allowedCategories, suites]);

  const fileFormatOptions = useMemo(() => {
    const set = new Set();

    (allowedFormats || []).forEach((f) => f && set.add(f));
    (suites || []).forEach((s) => s.fileFormat && set.add(s.fileFormat));
    (datasets || []).forEach((d) => d.fileFormat && set.add(d.fileFormat));

    return [
      { label: "All formats", value: null },
      ...Array.from(set)
        .sort()
        .map((f) => ({ label: f, value: f })),
    ];
  }, [allowedFormats, suites, datasets]);

    // Normalize filters: accept either primitive value or full option object
  const categoryFilterValue =
    categoryFilter && typeof categoryFilter === "object"
      ? categoryFilter.value
      : categoryFilter;

  const fileFormatFilterValue =
    fileFormatFilter && typeof fileFormatFilter === "object"
      ? fileFormatFilter.value
      : fileFormatFilter;


  const activeValidators = useMemo(() => {
    const map = new Map();
    const ordered = [...valRegEvents].sort(
        (a, b) => a.block_number - b.block_number || a.log_index - b.log_index
    );

    for (const ev of ordered) {
        const args = ev.args || {};
        const addr = args.validator;
        if (!addr) continue;

        if (ev.name === "ValidatorAdded") {
        map.set(addr, {
            validator: addr,
            description: args.description || "",
            codeURI: args.codeURI || "",
            codeHash: args.codeHash || "",
            active: true,
        });
        }

        if (ev.name === "ValidatorUpdated") {
        const prev = map.get(addr) || {
            validator: addr,
            description: "",
            codeURI: "",
            codeHash: "",
            active: false,
        };
        map.set(addr, {
            validator: addr,
            description: args.description || prev.description,
            codeURI: args.codeURI || prev.codeURI,
            codeHash: args.codeHash || prev.codeHash,
            active:
            typeof args.active === "boolean" ? args.active : prev.active,
        });
        }

        if (ev.name === "ValidatorRemoved") {
        map.delete(addr);
        }
    }

    // 🔁 return ALL validators (active + inactive)
    return Array.from(map.values());
    }, [valRegEvents]);

  const catEventCounts = useMemo(
    () => countEventsByName(catEvents),
    [catEvents]
  );
  const fmtEventCounts = useMemo(
    () => countEventsByName(fmtEvents),
    [fmtEvents]
  );
  const valRegEventCounts = useMemo(
    () => countEventsByName(valRegEvents),
    [valRegEvents]
  );
  
  const filteredSuites = useMemo(() => {
    const nowMs = Date.now();

    return suites.filter((s) => {
      // status filter
      if (statusFilter === "open") {
        if (s.isClosed || (s.deadline && s.deadline * 1000 < nowMs)) {
          return false;
        }
      }
      if (statusFilter === "closed" && !s.isClosed) return false;
      if (
        statusFilter === "expired" &&
        !(s.deadline && s.deadline * 1000 < nowMs && !s.isClosed)
      ) {
        return false;
      }

      // category / format filters (use normalized values)
      if (categoryFilterValue && s.category !== categoryFilterValue) return false;
      if (
        fileFormatFilterValue &&
        s.fileFormat !== fileFormatFilterValue
      )
        return false;

      // global text search
      if (!globalFilter) return true;
      const g = globalFilter.toLowerCase();

      return (
        String(s.id).includes(g) ||
        (s.requester && s.requester.toLowerCase().includes(g)) ||
        (s.category && s.category.toLowerCase().includes(g)) ||
        (s.fileFormat && s.fileFormat.toLowerCase().includes(g)) ||
        (s.suiteURI && s.suiteURI.toLowerCase().includes(g))
      );
    });
  }, [
    suites,
    globalFilter,
    statusFilter,
    categoryFilterValue,
    fileFormatFilterValue,
  ]);



   const filteredDatasets = useMemo(() => {
    return datasets.filter((d) => {
      // format filter
      if (fileFormatFilterValue && d.fileFormat !== fileFormatFilterValue) {
        return false;
      }

      // category via suiteHash → category mapping
      if (categoryFilterValue) {
        const cat =
          d.suiteHash &&
          suiteHashToCategory.get(d.suiteHash.toLowerCase());
        if (cat !== categoryFilterValue) {
          return false;
        }
      }

      if (!globalFilter) return true;
      const g = globalFilter.toLowerCase();

      return (
        (d.fingerprint && d.fingerprint.toLowerCase().includes(g)) ||
        (d.uploader && d.uploader.toLowerCase().includes(g)) ||
        (d.fileFormat && d.fileFormat.toLowerCase().includes(g)) ||
        (d.uri && d.uri.toLowerCase().includes(g)) ||
        (d.suiteHash && d.suiteHash.toLowerCase().includes(g))
      );
    });
  }, [
    datasets,
    fileFormatFilterValue,
    categoryFilterValue,
    globalFilter,
    suiteHashToCategory,
  ]);
  
  const suitesToRender = useMemo(
    () => filteredSuites,
    [filteredSuites]
);

  const formatRegisteredAt = (ts) =>
    ts ? new Date(ts * 1000).toLocaleString() : "-";

  const notImplemented = (label) => {
    toastRef.current?.show({
      severity: "info",
      summary: "Not wired yet",
      detail: `Hook frontend → backend for "${label}" here.`,
    });
  };

  const loadRegistryEvents = async (which) => {
    try {
      let contract;
      if (which === "category") contract = categoryContract;
      if (which === "fileFormat") contract = fileFormatContract;
      if (which === "validators") contract = validatorsContract;
      if (!contract?.address) return;

      const params = { network, perPage: 1000, sort: "block_number,asc" };
      const res = await BLOCKCHAIN_API.getContractEvents(
        contract.address,
        params
      );
      const events = res.data?.data || [];

      if (which === "category") setCatEvents(events);
      if (which === "fileFormat") setFmtEvents(events);
      if (which === "validators") setValRegEvents(events);
    } catch (err) {
      console.error(err);
      const msg =
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        String(err);
      toastRef.current?.show({
        severity: "error",
        summary: "Failed to load registry events",
        detail: msg,
      });
    }
  };
  // auto-load category registry events when contract is ready
  useEffect(() => {
    if (categoryContract?.address) {
        loadRegistryEvents("category");
    }
    }, [categoryContract?.address, network]);
  useEffect(() => {
        if (fileFormatContract?.address) {
            loadRegistryEvents("fileFormat");
        }
    }, [fileFormatContract?.address, network]);
  useEffect(() => {
        if (validatorsContract?.address) {
            loadRegistryEvents("validators");
        }
    }, [validatorsContract?.address, network]);
  useEffect(() => {
        reloadDatasetAndValidationEvents();
    }, [datasetContract, validationContract, network, toastRef]);


  const toggleCategory = async () => {
    const next = !catExpanded;
    setCatExpanded(next);
    if (next && catEvents.length === 0 && categoryContract) {
      setCatLoading(true);
      await loadRegistryEvents("category");
      setCatLoading(false);
    }
  };
  const toggleFileFormat = async () => {
    const next = !fmtExpanded;
    setFmtExpanded(next);
    if (next && fmtEvents.length === 0 && fileFormatContract) {
      setFmtLoading(true);
      await loadRegistryEvents("fileFormat");
      setFmtLoading(false);
    }
  };
  const toggleValidators = async () => {
    const next = !valRegExpanded;
    setValRegExpanded(next);
    if (next && valRegEvents.length === 0 && validatorsContract) {
      setValRegLoading(true);
      await loadRegistryEvents("validators");
      setValRegLoading(false);
    }
  };
  const openValidatorEdit = (v) => {
    setValidatorMode("update");
    setValidatorAddress(v.validator);
    setValidatorDescription(v.description || "");
    setValidatorCodeURI(v.codeURI || "");
    setValidatorCodeHash(v.codeHash || "");
    setValidatorActive(typeof v.active === "boolean" ? v.active : true);
    setValidatorDialogVisible(true);
    };

  const openValidationDialog = (fingerprint) => {
    setValidationDatasetFp(fingerprint || "");
    setValidationResultURI("");
    setValidationReportURI("");
    setValidationHash("");
    setValidationSuccessful(true);
    setValidationDialogVisible(true);
  };

  const openClaimDialog = (suiteId, presetFp) => {
    setClaimPrepared(null);
    setClaimSuiteId(suiteId || null);
    setClaimDatasetFp(presetFp || "");
    setClaimDialogVisible(true);
  };




  return {
    // theme-external stuff
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

    // events & derived
    suites,
    datasets,
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

    // filters
    globalFilter,
    setGlobalFilter,
    statusFilter,
    setStatusFilter,
    catEventFilter,
    setCatEventFilter,
    fmtEventFilter,
    setFmtEventFilter,
    valRegEventFilter,
    setValRegEventFilter,
    categoryFilter,
    setCategoryFilter,
    fileFormatFilter,
    setFileFormatFilter,
    categoryOptions,
    fileFormatOptions,
    filteredSuites,
    filteredDatasets,
    suitesToRender,
    formatRegisteredAt,

    // toggles
    catExpanded,
    fmtExpanded,
    valRegExpanded,
    toggleCategory,
    toggleFileFormat,
    toggleValidators,




    // dialogs + confirm
    categoryDialogVisible,
    setCategoryDialogVisible,
    categoryToEdit,
    setCategoryToEdit,
    formatDialogVisible,
    setFormatDialogVisible,
    formatToEdit,
    setFormatToEdit,
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
    confirmVisible,
    confirmMessage,
    askConfirm,
    handleConfirm,
    handleCancelConfirm,




      // ✅ dataset dialog
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
    datasetReportUri,
    setDatasetReportUri,
    datasetIncludeReport,
    setDatasetIncludeReport,
    registeringDataset,
    catalogOptions,
    selectedCatalogId,
    setSelectedCatalogId,
    handlePrepareReport,
    handleStoreZenohMapping,
    handlePrepareZenohFromCatalog,   
     // ✅ validation dialog
    validationDialogVisible,
    setValidationDialogVisible,
    validationDatasetFp,
    setValidationDatasetFp,
    validationResultURI,
    setValidationResultURI,
    validationHash,
    setValidationHash,
    validationSuccessful,
    setValidationSuccessful,
    validationReportURI,
    setValidationReportURI,

    
    // claim dialog
    claimDialogVisible,
    setClaimDialogVisible,
    claimSuiteId,
    setClaimSuiteId,
    claimDatasetFp,
    setClaimDatasetFp,
    claimSubmitting,
    claimPreparing,
    setClaimPreparing, 
    claimPrepared,
    setClaimPrepared,

    openClaimDialog,
    handleClaimReward,


    // handlers
    handleSaveCategory,
    handleRemoveCategory,
    handleSaveFormat,
    handleRemoveFormat,
    handleSaveValidator,
    handleRemoveValidator,
    handleRegisterDataset,
    handleSubmitValidation,
    handleCreateDatasetRequest,    
    handleClaimRewardForDataset,   
    handlePrepareZenohFromCatalog,
    handleCancelAndRefund, 
    notImplemented,
    openValidatorEdit,
    openValidationDialog, 
  };
}
