// hooks/useSuiteRequestTx.js
import { isUnsafeBig, ensure0x, toBytes32, stableStringify, } from "../utils/big";
import { prettyProviderError } from "../utils/evmError";

/**
 * Pure tx helper:
 * - No UI side-effects (no toasts)
 * - Returns { warnings: string[], txHash?, receipt? }
 * - Throws errors with { code?, detail? } for blocking problems
 */
export function useSuiteRequestTx({ web3, srr, explorerTxUrl }) {
  const serializeErr = (err) => {
    try { return JSON.parse(JSON.stringify(err, Object.getOwnPropertyNames(err))); }
    catch { return { message: err?.message, code: err?.code, data: err?.data }; }
  };

  /**
   * @param {Object} opts
   * @param {'warn'|'block'} [opts.probeMode='warn'] - if 'block', stop before send() on preflight failures
   * @returns {Promise<{warnings: string[], txHash?: string, receipt?: any}>}
   */
  const create = async ({
    sourceMode,
    prepared,
    suitePayload,
    suiteURI, docsURI, metadataURI,
    categoryKey, fileFormatKey,
    deadline,
    totalExpected,
    bountyEth,
    wallet, ensureSepolia, connect,
    onCreated, onHide,
    probeMode = "warn",
  }) => {
    const warnings = [];

    // guards
    if (!srr?.address || !srr?.abi || !web3) {
      const err = new Error("Missing registry or Web3");
      err.code = "E_NO_REGISTRY_OR_WEB3";
      throw err;
    }

    // ensure wallet
    let account = wallet;
    if (!account) {
      try { await ensureSepolia?.(); } catch {}
      await connect?.();
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      account = accounts?.[0];
    }
    if (!account) {
      const err = new Error("No wallet connected.");
      err.code = "E_NO_WALLET";
      throw err;
    }

    const chainIdHex = await window.ethereum.request({ method: "eth_chainId" }).catch(() => null);
    const deadlineTs = Math.floor(new Date(deadline).getTime() / 1000);
    const valueWei = web3.utils.toWei(String(bountyEth || 0), "ether");
    const contract = new web3.eth.Contract(srr.abi, srr.address);

    const localHash = web3.utils.keccak256(stableStringify(suitePayload));
    const rawSuiteHash = ensure0x(prepared?.suiteHash || localHash);
    const suiteHashBytes32 = toBytes32(rawSuiteHash);

    if (!bountyEth || Number(bountyEth) <= 0) {
      const err = new Error("Bounty must be greater than 0.");
      err.code = "E_ZERO_BOUNTY";
      throw err;
    }

    // signature usability
    let sigIsUsable = false;
    if (sourceMode === "backend" && prepared) {
      const sigRequester = prepared?.typedData?.message?.requester;
      const sigChainId   = prepared?.typedData?.domain?.chainId;
      const sigContract  = prepared?.typedData?.domain?.verifyingContract;

      const bigsUnsafe =
        isUnsafeBig(prepared?.nonce) ||
        isUnsafeBig(prepared?.typedData?.message?.nonce) ||
        isUnsafeBig(prepared?.expiresAt) ||
        isUnsafeBig(prepared?.typedData?.message?.expiresAt) ||
        isUnsafeBig(prepared?.deadline) ||
        isUnsafeBig(prepared?.typedData?.message?.deadline) ||
        isUnsafeBig(prepared?.totalExpected) ||
        isUnsafeBig(prepared?.typedData?.message?.totalExpected);

      if (sigRequester && sigRequester.toLowerCase() !== account.toLowerCase()) {
        const err = new Error(`Wrong wallet. Switch to ${sigRequester}`);
        err.code = "E_WRONG_WALLET";
        throw err;
      }
      if (sigChainId && chainIdHex) {
        const hexFromSig = "0x" + Number(sigChainId).toString(16);
        if (hexFromSig.toLowerCase() !== chainIdHex.toLowerCase()) {
          const err = new Error("Wrong network. Switch to the network used during prepare.");
          err.code = "E_WRONG_NETWORK";
          throw err;
        }
      }
      sigIsUsable =
        !!sigRequester &&
        sigRequester !== "0x0000000000000000000000000000000000000000" &&
        sigRequester.toLowerCase() === account.toLowerCase() &&
        !bigsUnsafe;

      if (sigContract && sigContract.toLowerCase() !== srr.address.toLowerCase()) {
        console.warn("[suite] verifyingContract differs from current registry", { sigContract, current: srr.address });
      }
    }

    // choose method
    let method = null;
    let args = null;

    if (sourceMode === "backend" && prepared && prepared?.signature && sigIsUsable) {
      const sig = ensure0x(prepared.signature);
      const signedCategory      = prepared.category      ?? categoryKey;
      const signedFileFormat    = prepared.fileFormat    ?? fileFormatKey;
      const signedDeadline      = String(prepared.deadline ?? prepared?.typedData?.message?.deadline ?? deadlineTs);
      const signedTotalExpected = String(prepared.totalExpected ?? prepared?.typedData?.message?.totalExpected ?? Number(totalExpected || 0));
      const signedNonce         = String(prepared.nonce ?? prepared?.typedData?.message?.nonce);
      const signedExpiresAt     = String(prepared.expiresAt ?? prepared?.typedData?.message?.expiresAt);

      method = "createDatasetRequestWithSig";
      args = [
        suiteHashBytes32,
        prepared.suiteURI || "",
        prepared.docsURI || "",
        prepared.certificateURI || "",
        signedCategory || "mobility",
        signedFileFormat || "csv",
        String(signedDeadline),
        String(signedTotalExpected),
        signedNonce,
        signedExpiresAt,
        sig,
      ];
    } else if (sourceMode === "backend" && prepared) {
      method = "createDatasetRequest";
      args = [
        suiteHashBytes32,
        prepared.suiteURI || "",
        prepared.docsURI || "",
        prepared.certificateURI || "",
        categoryKey || "mobility",
        fileFormatKey || "csv",
        String(deadlineTs),
        String(Number(totalExpected || 0)),
      ];
    } else {
      if (!suiteURI || !metadataURI) {
        const err = new Error("Provide suiteURI and metadataURI");
        err.code = "E_MISSING_URIS";
        throw err;
      }
      method = "createDatasetRequest";
      args = [
        suiteHashBytes32,
        suiteURI,
        (docsURI || ""),
        metadataURI,
        categoryKey || "mobility",
        fileFormatKey || "csv",
        String(deadlineTs),
        String(Number(totalExpected || 0)),
      ];
    }

    if (!method) {
      const err = new Error("Could not choose transaction method");
      err.code = "E_NO_METHOD";
      throw err;
    }

    // ---- preflight probes ----
    // 1) estimateGas with identical params; keep the number for send()
    let gasEstimate;
    try {
      gasEstimate = await contract.methods[method](...args).estimateGas({
        from: account,
        value: valueWei,
      });
    } catch (eg) {
      const detail = prettyProviderError(eg, web3);
      const msg = detail?.reason || detail?.message || "estimateGas failed";
      if (probeMode === "block") {
        const err = new Error(msg);
        err.code = "E_PROBE_ESTIMATE";
        err.detail = detail;
        throw err;
      } else {
        warnings.push(`Tx may revert: ${msg}`);
      }
    }

    // 2) optional dry-run
    try {
      await contract.methods[method](...args).call({ from: account, value: valueWei });
    } catch (eg2) {
      const detail = prettyProviderError(eg2, web3);
      const msg = detail?.reason || detail?.message || "eth_call indicates revert";
      if (probeMode === "block") {
        const err = new Error(msg);
        err.code = "E_PROBE_CALL";
        err.detail = detail;
        throw err;
      } else {
        warnings.push(`Tx likely to revert: ${msg}`);
      }
    }

    // 3) compute safe gas limit from estimate + latest block gas limit
    const sendOverrides = { from: account, value: valueWei };
    if (typeof gasEstimate === "number" && isFinite(gasEstimate) && gasEstimate > 0) {
      try {
        const latestBlock = await web3.eth.getBlock("latest");
        const blockGasLimit = Number(latestBlock?.gasLimit || 0);
        const buffered = Math.ceil(gasEstimate * 1.20);   // +20% buffer
        const cap = Math.floor(blockGasLimit * 0.95);     // keep under block limit
        const gas = Math.min(buffered, cap > 0 ? cap : buffered);
        if (gas > 0) sendOverrides.gas = gas;
      } catch {
        // if we fail to fetch block, just omit gas and let wallet decide
      }
    }

    // ---- send ----
    const promi = contract.methods[method](...args).send(sendOverrides);

    let mmPromptTimer = setTimeout(() => {
      console.warn("[suite] MetaMask prompt has not appeared yet; popup blocked or awaiting user?");
    }, 8000);

    const safe = (x) => JSON.parse(JSON.stringify(x, (_, v) => (typeof v === "bigint" ? v.toString() : v)));
    // confirmation target uses BigInt; if your env doesn't support it, change to a number.
    const TARGET_CONF = 1n;

    const onConfirmation = (ev) => {
      const { confirmations } = ev || {};
      if (confirmations >= TARGET_CONF) {
        try { promi.off("confirmation", onConfirmation); } catch {}
      }
    };

    let txHashCaptured = null;
    let receiptCaptured = null;

    promi
      .on("sending",      (p) => console.log("[suite] sending…", safe(p)))
      .on("sent",         (p) => console.log("[suite] sent to node…", safe(p)))
      .on("transactionHash", (hash) => {
        txHashCaptured = hash;
        clearTimeout(mmPromptTimer);
      })
      .on("receipt", (rcpt) => {
        receiptCaptured = rcpt;
        try { promi.off("confirmation", onConfirmation); } catch {}
        onCreated?.(rcpt);
        onHide?.();
      })
      .on("confirmation", onConfirmation)
      .on("error", (err) => {
        clearTimeout(mmPromptTimer);
        try { promi.off("confirmation", onConfirmation); } catch {}
      });

    try {
      await promi;
      return { warnings, txHash: txHashCaptured, receipt: receiptCaptured, explorerTxUrl };
    } catch (e) {
      const detail = prettyProviderError(e, web3);
      const human =
        detail?.reason ||
        (typeof detail?.message === "string" && detail.message.replace("Internal JSON-RPC error.", "").trim()) ||
        "User denied or RPC error";

      const err = new Error(human);
      err.code = "E_SEND";
      err.detail = detail;
      throw err;
    }
  };

  return { create };
}
