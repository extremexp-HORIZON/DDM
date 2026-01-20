
import { ingestTxSafe } from "../../utils/ingestTxSafe";
import { ensureWallet, mkWriteContract } from "../../utils/web3Helpers";
import { BLOCKCHAIN_API } from "../../api/blockchain";  
import { pollTaskResult } from "../../api/tasks";
import { showError, showSuccess} from "../../utils/toastHelpers";

export function useDashboardActions({
    // infra
    network,
    wallet,
    connect,
    ensureSepolia,
    web3,
    toastRef,
    confirmActionRef,
    setConfirmVisible,
    setConfirmMessage,


    // contracts
    suiteContract,
    datasetContract,
    validationContract,
    categoryContract,
    fileFormatContract,
    validatorsContract,

    // state + setters
    categoryToEdit,
    setCategoryDialogVisible,
    setCategoryToEdit,
    categorySubmitting,
    setCategorySubmitting,



    formatToEdit,
    setFormatDialogVisible,
    setFormatToEdit,
    formatSubmitting,
    setFormatSubmitting,


    setValidatorDialogVisible,
    validatorAddress,
    validatorDescription,
    setValidatorAddress,
    setValidatorDescription,
    validatorCodeURI,
    setValidatorCodeURI,

    validatorCodeHash,
    setValidatorCodeHash,

    validatorActive,
    validatorMode,
    setValidatorMode,

    setValidatorActive,
    validatorSubmitting,
    setValidatorSubmitting,



    setDatasetDialogVisible,
    datasetUri,
    setDatasetUri,
    datasetSuiteHash,
    setDatasetSuiteHash,
    datasetFileFormat,
    setDatasetFileFormat,
    datasetReportUri,
    setDatasetReportUri,
    datasetIncludeReport,
    setDatasetIncludeReport,

    setDatasetLockSuiteFields,

    setRegisteringDataset,

    setValidationDialogVisible,
    validationDatasetFp,
    setValidationDatasetFp,
    validationResultURI,
    setValidationResultURI,
    validationReportURI,
    setValidationReportURI,
    validationHash,
    setValidationHash,
    validationSuccessful,
    setValidationSuccessful,
    validationPreparing,
    setValidationPreparing,
    setValidationSubmitting,

    setClaimDialogVisible,
    claimSuiteId,
    setClaimSuiteId,
    claimDatasetFp,
    setClaimDatasetFp,
    setClaimSubmitting,
    claimPrepared,
    setClaimPrepared,
    setClaimPreparing,
    claimCtx,
    setClaimCtx,
    // loaders from effects
    reloadSuiteEvents,
    reloadDatasetAndValidationEvents,

    // registry reload
    loadRegistryEvents,
    setConfirmLoading,
    confirmLoading,
}) {
    // --------------------------------------------------
    // confirm dialog
    
    // --------------------------------------------------
    const askConfirm = (message, action) => {
        confirmActionRef.current = action;
        setConfirmVisible(true);
        setConfirmMessage(message);
    };

    const handleConfirm = async () => {
        const fn = confirmActionRef.current;
        confirmActionRef.current = null;

        setConfirmLoading(true);
        try {
            if (fn) await fn();
            setConfirmVisible(false);
        } finally {
            setConfirmLoading(false);
        }
    };

    const handleCancelConfirm = () => {
        if (confirmLoading) return; // block while running
        confirmActionRef.current = null;
        setConfirmVisible(false);
    };

  
    const extractRevertReason = (err) => {
        // web3 ResponseError / MetaMask variants
        const msg =
            err?.data?.message ||
            err?.data?.data?.message ||
            err?.error?.data?.message ||
            err?.error?.message ||
            err?.cause?.message ||
            err?.message ||
            "";

        // prefer the actual revert string if present
        const m =
            msg.match(/execution reverted(?::\s*(.*))?/i) ||
            msg.match(/revert(?:ed)?(?::\s*(.*))?/i);

        if (m) {
            const reason = (m[1] || "execution reverted").trim();
            return reason ? `execution reverted: ${reason}` : "execution reverted";
        }

        return msg || "Transaction failed";
        };


    const w = (row) => mkWriteContract(web3, row);
    
    const openRegisterDatasetDialog = async (suiteHash, fileFormat = "") => {
        try {
            // only connect if needed
            await ensureWallet(wallet, connect);
            await ensureSepolia?.();

            setDatasetSuiteHash(suiteHash || "");
            if (fileFormat) setDatasetFileFormat(fileFormat);

            setDatasetLockSuiteFields(true);
            setDatasetDialogVisible(true);
        } catch (err) {
            showError(toastRef, "Wallet not connected", err);
        }
        };

    // --------------------------------------------------
    // category registry
    // --------------------------------------------------
    const handleSaveCategory = async () => {
        const category = (categoryToEdit || "").trim();
        if (!category) return;

        try {
            setCategorySubmitting(true);
            const from = await ensureWallet(wallet, connect);
            await ensureSepolia?.();

            const c = mkWriteContract(web3, categoryContract);
            if (!c) throw new Error("CategoryRegistry ABI/address not loaded");

            await c.methods.addCategory(category).call({ from });
            const tx = await c.methods.addCategory(category).send({ from });

            showSuccess(toastRef, "Category added", `Tx: ${tx.transactionHash}`);
            setCategoryDialogVisible(false);
            setCategoryToEdit("");

            await ingestTxSafe({
                network,
                toastRef,
                contract: categoryContract,
                txHash: tx.transactionHash,
                actionLabel: "Category added",
                onIndexed: () => loadRegistryEvents("category"),
            });
        } catch (err) {
            showError(toastRef, "Failed to add category", err);
        } finally {
            setCategorySubmitting(false);
        }
    };

    const handleRemoveCategory = async (category) => {
        const cat = (category || "").trim();
        if (!cat) return;

        try {
            const from = await ensureWallet(wallet, connect);
            await ensureSepolia?.();

            const c = mkWriteContract(web3, categoryContract);
            if (!c) throw new Error("CategoryRegistry ABI/address not loaded");

            await c.methods.removeCategory(cat).call({ from });
            const tx = await c.methods.removeCategory(cat).send({ from });

            showSuccess(toastRef, "Category removed", `Tx: ${tx.transactionHash}`);

            await ingestTxSafe({
                network,
                toastRef,
                contract: categoryContract,
                txHash: tx.transactionHash,
                actionLabel: "Category removed",
                onIndexed: () => loadRegistryEvents("category"),
            });
        } catch (err) {
            showError(toastRef, "Failed to remove category", err);
        }
    };

    // --------------------------------------------------
    // file format registry
    // --------------------------------------------------
    const handleSaveFormat = async () => {
        const fmt = (formatToEdit || "").trim();
        if (!fmt) return;

        try {
            setFormatSubmitting(true);
            const from = await ensureWallet(wallet, connect);
            await ensureSepolia?.();

            const c = mkWriteContract(web3, fileFormatContract);
            if (!c) throw new Error("FileFormatRegistry ABI/address not loaded");

            await c.methods.addFormat(fmt).call({ from });
            const tx = await c.methods.addFormat(fmt).send({ from });

            showSuccess(toastRef, "Format added", `Tx: ${tx.transactionHash}`);
            setFormatDialogVisible(false);
            setFormatToEdit("");

            await ingestTxSafe({
                network,
                toastRef,
                contract: fileFormatContract,
                txHash: tx.transactionHash,
                actionLabel: "Format added",
                onIndexed: () => loadRegistryEvents("fileFormat"),
            });
        } catch (err) {
            showError(toastRef, "Failed to add format", err);
        } finally {
            setFormatSubmitting(false);
        }
    };

    const handleRemoveFormat = async (fmt) => {
        const format = (fmt || "").trim();
        if (!format) return;

        try {
            const from = await ensureWallet(wallet, connect);
            await ensureSepolia?.();

            const c = mkWriteContract(web3, fileFormatContract);
            if (!c) throw new Error("FileFormatRegistry ABI/address not loaded");

            await c.methods.removeFormat(format).call({ from });
            const tx = await c.methods.removeFormat(format).send({ from });

            showSuccess(toastRef, "Format removed", `Tx: ${tx.transactionHash}`);

            await ingestTxSafe({
                network,
                toastRef,
                contract: fileFormatContract,
                txHash: tx.transactionHash,
                actionLabel: "Format removed",
                onIndexed: () => loadRegistryEvents("fileFormat"),
            });
        } catch (err) {
            showError(toastRef, "Failed to remove format", err);
        }
    };

    const handleSaveValidator = async () => {
        const addr = (validatorAddress || "").trim();
        if (!addr) return;

        try {
            setValidatorSubmitting(true);

            const from = await ensureWallet(wallet, connect);
            await ensureSepolia?.();

            const c = mkWriteContract(web3, validatorsContract);
            if (!c) throw new Error("ValidatorsRegistry ABI/address not loaded");

            let tx;

            if (validatorMode === "add") {
            await c.methods
                .addValidator(addr, validatorDescription, validatorCodeURI, validatorCodeHash)
                .call({ from });

            tx = await c.methods
                .addValidator(addr, validatorDescription, validatorCodeURI, validatorCodeHash)
                .send({ from });

            showSuccess(toastRef, "Validator added", `Tx: ${tx.transactionHash}`);
            } else {
            await c.methods
                .updateValidator(
                addr,
                validatorDescription,
                validatorCodeURI,
                validatorCodeHash,
                validatorActive
                )
                .call({ from });

            tx = await c.methods
                .updateValidator(
                addr,
                validatorDescription,
                validatorCodeURI,
                validatorCodeHash,
                validatorActive
                )
                .send({ from });

            showSuccess(toastRef, "Validator updated", `Tx: ${tx.transactionHash}`);
            }

            // close + reset dialog
            setValidatorDialogVisible(false);
            setValidatorAddress("");
            setValidatorDescription("");
            setValidatorCodeURI("");
            setValidatorCodeHash("");
            setValidatorActive(true);
            setValidatorMode("add");

            await ingestTxSafe({
            network,
            toastRef,
            contract: validatorsContract,
            txHash: tx.transactionHash,
            actionLabel: validatorMode === "add" ? "Validator added" : "Validator updated",
            onIndexed: () => loadRegistryEvents("validators"),
            });
        } catch (err) {
            console.error("handleSaveValidator error", err);
            showError(toastRef, "Failed to save validator", err);
        } finally {
            setValidatorSubmitting(false);
        }
        };

    const handleRemoveValidator = async (address) => {
        const addr = (address || "").trim();
        if (!addr) return;

        try {
            const from = await ensureWallet(wallet, connect);
            await ensureSepolia?.();

            const c = mkWriteContract(web3, validatorsContract);
            if (!c) throw new Error("ValidatorsRegistry ABI/address not loaded");

            await c.methods.removeValidator(addr).call({ from });
            const tx = await c.methods.removeValidator(addr).send({ from });

            showSuccess(toastRef, "Validator removed", `Tx: ${tx.transactionHash}`);

            await ingestTxSafe({
            network,
            toastRef,
            contract: validatorsContract,
            txHash: tx.transactionHash,
            actionLabel: "Validator removed",
            onIndexed: () => loadRegistryEvents("validators"),
            });
        } catch (err) {
            console.error("handleRemoveValidator error", err);
            showError(toastRef, "Failed to remove validator", err);
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

            showSuccess(toastRef, "Zenoh mapping stored", "Zenoh URI linked in backend.");
        } catch (err) {
            console.error("handleStoreZenohMapping error", err);
            showError(toastRef, "Failed to store Zenoh mapping", err);
            throw err;
        }
        };

    

    const handlePrepareReport = async (id, opts = {}) => {
        if (!id) return null;
        const { includeReport = true } = opts;

        try {
            console.log("[prepare] calling prepareReportIPFSURI");

            const res = await BLOCKCHAIN_API.prepareReportIPFSURI({
            network,
            catalog_id: id,
            include_report: includeReport,
            });

            console.log("[prepare] prepareReportIPFSURI res =", res);

            // ✅ unwrap axios -> payload
            const env = res?.data?.data ?? res?.data ?? res ?? {};
            const taskId = env?.task_id ?? env?.taskId;

            if (!taskId) {
                console.error("[prepare] no task_id, envelope =", env);
                throw new Error("No task_id returned from prepareReportIPFSURI");
            }

            console.log("[prepare] calling pollTaskResult for taskId", taskId);
            const taskRes = await pollTaskResult(taskId, 2000, 600000);
            console.log("[prepare] raw taskRes =", taskRes);

            // ✅ unwrap poll result (supports both shapes)
            const payload =
            taskRes?.result ??
            taskRes?.data?.result ??
            taskRes?.data?.data ??
            taskRes?.data ??
            taskRes ??
            {};

            console.log("[prepare] payload =", payload);

            const reportUri = payload.report_uri ?? payload.reportUri ?? null;
            const fileFormat = payload.file_format ?? payload.fileFormat ?? "html";

            const prepared = { reportUri, fileFormat };
            console.log("[prepare] prepared =", prepared);

            if (!reportUri) {
                throw new Error("Task finished but no report_uri found in payload");
            }

            // ✅ populate dialog state
            setDatasetReportUri(reportUri);
            setDatasetIncludeReport(true);

            showSuccess(toastRef, "Report prepared", "Data-quality report uploaded to IPFS.");
            return prepared;
        } catch (err) {
            console.error("handlePrepareReport error", err);
            showError(toastRef, "Failed to prepare dataset/report from catalog", err);
            throw err;
        }
    };

    const handlePrepareZenohFromCatalog = async (id) => {
        if (!id) return null;

        try {
            const res = await BLOCKCHAIN_API.prepareDatasetFromCatalog({
            network,
            catalog_id: id,
            transport: "zenoh",
            });

            console.log("[zenoh] prepareDatasetFromCatalog res =", res);

            // ✅ unwrap axios -> payload
            const env = res?.data?.data ?? res?.data ?? res ?? {};
            const taskId = env?.task_id ?? env?.taskId;

            if (!taskId) {
                console.error("[zenoh] no task_id, envelope =", env);
                throw new Error("No task_id returned from prepare-from-catalog (zenoh)");
            }

            const taskRes = await pollTaskResult(taskId, 2000, 600000);

            const payload =
            taskRes?.result ??
            taskRes?.data?.result ??
            taskRes?.data?.data ??
            taskRes?.data ??
            taskRes ??
            {};

            const prepared = {
            uri: payload?.uri || "",
            suiteHash: payload?.suite_hash || payload?.suiteHash || "",
            fileFormat: payload?.file_format || payload?.fileFormat || "",
            zenohUri: payload?.zenoh_uri || payload?.zenohUri || "",
            };

            if (prepared.uri) setDatasetUri(prepared.uri);
            if (prepared.suiteHash) setDatasetSuiteHash(prepared.suiteHash);
            if (prepared.fileFormat) setDatasetFileFormat(prepared.fileFormat);

            if (prepared.zenohUri) {
            await handleStoreZenohMapping({
                zenohUri: prepared.zenohUri,
                datasetUri: prepared.uri,
                suiteHash: prepared.suiteHash,
            });
            }

            showSuccess(
                toastRef,
                "Zenoh dataset prepared",
                "Dataset URI & suite hash loaded (Zenoh mapping handled in backend)."
            );

            return prepared;
        } catch (err) {
            console.error("handlePrepareZenohFromCatalog error", err);
            showError(toastRef, "Failed to prepare Zenoh dataset from catalog", err);
            throw err;
        }
    };


    const handlePrepareValidationResult = async (jsonText) => {
        const txt = (jsonText || "").trim();
        const fp = (validationDatasetFp || "").trim();
        if (!fp) throw new Error("dataset_fingerprint is required before preparing");
        if (!txt) return null;

        try {
            setValidationPreparing(true);

            // parse if valid JSON; otherwise send raw string
            let validation_json = txt;
            try { validation_json = JSON.parse(txt); } catch {}

            const res = await BLOCKCHAIN_API.prepareValidationResult({
                network,
                dataset_fingerprint: fp,
                uploader: wallet,              // optional but useful
                include_report: true,          // or drive from UI checkbox
                validation_json,               // dict OR string
            });

            const env = res?.data?.data ?? res?.data ?? res ?? {};
            const taskId = env?.task_id ?? env?.taskId;
            if (!taskId) throw new Error("No task_id returned from prepareValidation");

            const taskRes = await pollTaskResult(taskId, 2000, 600000);
            const payload =
                taskRes?.result ??
                taskRes?.data?.result ??
                taskRes?.data?.data ??
                taskRes?.data ??
                taskRes ??
            {};

            if (payload?.status === "error") {
                throw new Error(payload?.message || "Prepare validation failed");
            }

            const prepared = {
                resultUri: payload.result_uri ?? payload.resultUri ?? "",
                reportUri: payload.report_uri ?? payload.reportUri ?? "",
                validationHash: payload.validation_hash ?? payload.validationHash ?? "",
            };

            if (!prepared.resultUri) throw new Error("Task finished but no result_uri found");

            // auto-fill fields
            setValidationResultURI?.(prepared.resultUri);
            if (prepared.reportUri) setValidationReportURI?.(prepared.reportUri);
            if (prepared.validationHash) setValidationHash?.(prepared.validationHash);

            showSuccess(toastRef, "Prepared validation result", "Uploaded to IPFS.");
            return prepared;
        } catch (err) {
            console.error("handlePrepareValidationResult error", err);
            showError(toastRef, "Failed to prepare validation result", err);
            throw err;
        } finally {
            setValidationPreparing(false);
        }
    };


    const handleRegisterDataset = async () => {
      const uri = (datasetUri || "").trim();
      const suiteHashInput = (datasetSuiteHash || "").trim();
      const fileFormat = (datasetFileFormat || "").trim();
      const reportUri = datasetIncludeReport ? (datasetReportUri || "") : "";

      if (!uri || !suiteHashInput) {
        showError(toastRef, "Missing fields", new Error("URI and suiteHash are required"));
        return;
      }

      const suiteHash = suiteHashInput;

      try {
        setRegisteringDataset(true);

        // ✅ always use the address returned here (handles connect if needed)
        const from = await ensureWallet(wallet, connect);
        await ensureSepolia?.();

        if (!window.ethereum) {
          throw new Error("MetaMask not available in this browser");
        }

        const c = mkWriteContract(web3,datasetContract);
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
        // Preflight: simulate the call first
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

        showSuccess(toastRef,"Dataset registered", `Tx: ${tx.transactionHash}`);

        // reset + close dialog only after success
        setDatasetDialogVisible(false);
        setDatasetUri("");
        setDatasetSuiteHash("");
        setDatasetFileFormat("");
        setDatasetReportUri("");
        setDatasetIncludeReport(false);
        setDatasetLockSuiteFields(false);

        // tell backend + refresh UI
        await ingestTxSafe({
            network,
            toastRef,
            contract: datasetContract,
            txHash: tx.transactionHash,
            actionLabel: "Dataset registered",
            onIndexed: () => reloadDatasetAndValidationEvents(),
        });

        await reloadDatasetAndValidationEvents();
      } catch (err) {
        console.error("handleRegisterDataset error", err);
        showError(toastRef,"Failed to register dataset", err);
      } finally {
        setRegisteringDataset(false);
      }
    };

    const handleCancelAndRefund = async (requestId) => {
        if (!requestId) return;

        try {
        if (!wallet) {
            await connect();
        }
        await ensureSepolia?.();

        const c = mkWriteContract(web3,suiteContract);
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

        showSuccess(toastRef,"Request cancelled / refunded", `Tx: ${tx.transactionHash}`);

        await ingestTxSafe(
            suiteContract,
            tx.transactionHash,
            "Request cancelled",
            () => reloadSuiteEvents()
        );
        } catch (err) {
        console.error("handleCancelAndRefund error", err);
        showError(toastRef,"Failed to cancel / refund request", err);
        }
    };


    const handleSubmitValidation = async () => {
        const fp = (validationDatasetFp || "").trim();
        const uri = (validationResultURI || "").trim();
        const reportURI = (validationReportURI || "").trim();
        let hash = (validationHash || "").trim();
        const successful = !!validationSuccessful;

        if (!fp || !uri) {
            showError(toastRef, "Missing fields", new Error("Dataset fingerprint and result URI are required"));
            return;
        }

        try {
            setValidationSubmitting(true);
            const from = await ensureWallet(wallet, connect);
            await ensureSepolia?.();

            const c = w(validationContract);
            if (!c) throw new Error("ValidationRegistry ABI/address not loaded");

            if (!hash) hash = web3.utils.keccak256(uri);

            // bytes32 checks
            if (!web3.utils.isHexStrict(fp) || fp.length !== 66) {
            throw new Error("Dataset fingerprint must be a bytes32 hex string (0x + 64 hex chars)");
            }
            if (!web3.utils.isHexStrict(hash) || hash.length !== 66) {
            throw new Error("Validation hash must be a bytes32 hex string (0x + 64 hex chars)");
            }

            // preflight
            await c.methods
            .submitValidation(fp, hash, uri, reportURI, successful)
            .call({ from });

            const tx = await c.methods
            .submitValidation(fp, hash, uri, reportURI, successful)
            .send({ from });

            showSuccess(toastRef, "Validation submitted", `Tx: ${tx.transactionHash}`);

            setValidationDialogVisible(false);
            setValidationDatasetFp("");
            setValidationResultURI("");
            setValidationReportURI("");
            setValidationHash("");
            setValidationSuccessful(true);

            await ingestTxSafe({
                network,
                toastRef,
                contract: validationContract,
                txHash: tx.transactionHash,
                actionLabel: "Validation submitted",
                onIndexed: () => reloadDatasetAndValidationEvents(),
            });
        } catch (err) {
            console.error("handleSubmitValidation error", err);
            showError(toastRef, "Failed to submit validation", err);
        } finally {
            setValidationSubmitting(false);
        }
    };


    const handleClaimReward = async (opts = {}) => {
        const { mintNft = true } = opts; 

        const id = claimSuiteId;
        const fpInput = (claimDatasetFp || "").trim();

        if (!id) {
            showError(toastRef, "Missing suite id", new Error("No dataset request selected"));
            return;
        }
        if (!fpInput) {
            showError(toastRef, "Missing dataset fingerprint", new Error("Fingerprint is required"));
            return;
        }
        if (!web3?.utils?.isHexStrict(fpInput) || fpInput.length !== 66) {
            showError(
            toastRef,
            "Invalid fingerprint",
            new Error("Fingerprint must be bytes32: 0x + 64 hex chars")
            );
            return;
        }

        try {
            setClaimSubmitting(true);

            // ----------------------------------------------------------
            // ✅ PATH 1: ETH-only claim (no backend prepare)
            // ----------------------------------------------------------
            if (!mintNft) {
            const from = await ensureWallet(wallet, connect);
            await ensureSepolia?.();

            const c = w(suiteContract);
            if (!c) throw new Error("DatasetRequestRegistry ABI/address not loaded");

            await c.methods.claimRewardForDataset(id, fpInput).call({ from });
            const tx = await c.methods.claimRewardForDataset(id, fpInput).send({ from });

            showSuccess(toastRef, "Reward claimed", `Tx: ${tx.transactionHash}`);

            setClaimDialogVisible(false);
            setClaimSuiteId(null);
            setClaimDatasetFp("");
            setClaimPrepared?.(null);

            await ingestTxSafe({
                network,
                toastRef,
                contract: suiteContract,
                txHash: tx.transactionHash,
                actionLabel: "Reward claimed",
                onIndexed: async () => {
                await reloadSuiteEvents();
                await reloadDatasetAndValidationEvents();
                },
            });

            return;
            }

            // ----------------------------------------------------------
            // ✅ PATH 2: Claim + Mint (PREPARE first, TX second)
            // ----------------------------------------------------------

            // Phase A: not prepared => call backend prepare, store, RETURN
            if (!claimPrepared) {
            setClaimPreparing?.(true);
            setClaimPrepared?.(null);

            const uploader = wallet || (await ensureWallet(wallet, connect));

            const res = await BLOCKCHAIN_API.prepareRewardClaim({
                network,

                // required by Celery task prepare_dataset_reward_claim_task
                dataset_fingerprint: fpInput,
                category: "dataset",
                uploader,

                // ✅ optional extras you said you already have
                dataset_uri: claimCtx?.dataset_uri || undefined,
                suite_hash: claimCtx?.suite_hash || undefined,
                report_uri: claimCtx?.report_uri || undefined,

                // optional
                expires_in_sec: 900,
            });




            // unwrap axios envelope
            const env = res?.data?.data ?? res?.data ?? res ?? {};
            const taskId = env?.task_id ?? env?.taskId;
            if (!taskId) throw new Error("No task_id returned from prepareRewardClaim");

            // 2) poll task
            const taskRes = await pollTaskResult(taskId, 2000, 180000);

            // unwrap poll result (support multiple shapes)
            const payload =
                taskRes?.result ??
                taskRes?.data?.result ??
                taskRes?.data?.data ??
                taskRes?.data ??
                taskRes ??
                {};

            const prepared = {
                category: payload.category,
                level: payload.level,
                metadataURI: payload.metadataURI || payload.metadata_uri,
                deadline: String(payload.deadline),
                signature: payload.signature,
            };

            const missing =
                !prepared.category ||
                !prepared.level ||
                !prepared.metadataURI ||
                !prepared.deadline ||
                !prepared.signature;

            if (missing) {
                throw new Error(
                "Prepare task succeeded but missing fields (category/level/metadataURI/deadline/signature)"
                );
            }

            // 3) store prepared payload and STOP
            setClaimPrepared?.(prepared);
            showSuccess(toastRef, "Prepared NFT", "Ready. Click again to Claim + Mint.");
            return;
            }
            

            // Phase B: prepared => send TX
            const from = await ensureWallet(wallet, connect);
            await ensureSepolia?.();

            const c = w(suiteContract);
            
            if (!c) throw new Error("DatasetRequestRegistry ABI/address not loaded");

            const { category, level, metadataURI, deadline, signature } = claimPrepared;

            // preflight
            await c.methods
            .claimRewardForDatasetAndMint(id, fpInput, category, level, metadataURI, deadline, signature)
            .call({ from });

            // send
            const tx = await c.methods
            .claimRewardForDatasetAndMint(id, fpInput, category, level, metadataURI, deadline, signature)
            .send({ from });

            showSuccess(toastRef, "Reward claimed + NFT minted", `Tx: ${tx.transactionHash}`);

            // reset dialog state
            setClaimDialogVisible(false);
            setClaimSuiteId(null);
            setClaimDatasetFp("");
            setClaimPrepared?.(null);

            await ingestTxSafe({
                network,
                toastRef,
                contract: suiteContract,
                txHash: tx.transactionHash,
                actionLabel: "Reward claimed + NFT minted",
                onIndexed: async () => {
                    await reloadSuiteEvents();
                    await reloadDatasetAndValidationEvents();
                },
            });
        } catch (err) {
            console.error("handleClaimReward error", err);
            const reason = extractRevertReason(err);
            showError(toastRef, "Failed to claim reward", new Error(reason));
        } finally {
            setClaimPreparing?.(false);
            setClaimSubmitting(false);
        }
    };



    // Claim bounty for a specific dataset on a specific request
    const handleClaimRewardForDataset = async (requestId, datasetFingerprint) => {
        const id = requestId;
        const fp = (datasetFingerprint || "").trim();
        if (!id || !fp) return;

        try {
            const from = await ensureWallet(wallet, connect);
            await ensureSepolia?.();

            const c = w(suiteContract);
            if (!c) throw new Error("DatasetRequestRegistry ABI/address not loaded");

            await c.methods.claimRewardForDataset(id, fp).call({ from });
            const tx = await c.methods.claimRewardForDataset(id, fp).send({ from });

            showSuccess(toastRef, "Reward claimed", `Tx: ${tx.transactionHash}`);

            await ingestTxSafe({
                network,
                toastRef,
                contract: suiteContract,
                txHash: tx.transactionHash,
                actionLabel: "Reward claimed",
                onIndexed: () => reloadSuiteEvents(),
            });
        } catch (err) {
            console.error("handleClaimRewardForDataset error", err);
            const reason = extractRevertReason(err);
            showError(toastRef, "Failed to claim reward", new Error(reason));
        }

            };


    // --------------------------------------------------
    // dialogs helpers
    // --------------------------------------------------
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

    // ✅ accepts either (suiteId, presetFp) OR ({ suiteId, fingerprint, dataset })
    const openClaimDialog = (suiteIdOrObj, presetFp) => {
        let suiteId = null;
        let fp = "";
        let dataset = null;

        if (typeof suiteIdOrObj === "object" && suiteIdOrObj) {
            suiteId = suiteIdOrObj.suiteId ?? suiteIdOrObj.requestId ?? null;
            fp = suiteIdOrObj.fingerprint ?? suiteIdOrObj.fp ?? "";
            dataset = suiteIdOrObj.dataset ?? null;
        } else {
            suiteId = suiteIdOrObj ?? null;
            fp = presetFp ?? "";
        }

        setClaimPrepared(null);
        setClaimPreparing(false);

        setClaimSuiteId(suiteId);
        setClaimDatasetFp(fp);           // ✅ keeps fingerprint visible in dialog
        setClaimDialogVisible(true);

        // ✅ extra context for backend prepare (optional)
        setClaimCtx(
            dataset
            ? {
                uploader: dataset.uploader || "",
                dataset_uri: dataset.uri || "",
                suite_hash: dataset.suiteHash || "",
                report_uri: dataset.reportURI || "",
                file_format: dataset.fileFormat || "",
                }
            : null
        );
    };


    // --------------------------------------------------
    // expose
    // --------------------------------------------------
    return {
        askConfirm,
        handleConfirm,
        handleCancelConfirm,
        handleCancelAndRefund,
        handleSaveCategory,
        handleRemoveCategory,
        handleSaveFormat,
        handleRemoveFormat,
        handleRemoveValidator,
        handleSaveValidator,

        openValidatorEdit,
        openValidationDialog,
        openClaimDialog,
        handlePrepareReport,
        handlePrepareZenohFromCatalog,
        handlePrepareValidationResult,
        handleStoreZenohMapping,
        handleRegisterDataset,
        handleSubmitValidation,
        handleClaimReward,
        handleClaimRewardForDataset,
        openRegisterDatasetDialog

    };
}
