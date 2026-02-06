// components/SuiteRegisterDialog.jsx
import { useRef, useState } from "react";
import { Dialog } from "primereact/dialog";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { InputNumber } from "primereact/inputnumber";
import { Calendar } from "primereact/calendar";
import { RadioButton } from "primereact/radiobutton";
import { useToast } from "../context/ToastContext";
import { useContractsRegistry } from "../hooks/useContractsRegistry";
import { useMetamaskContext } from "../context/MetamaskContext";
import { BLOCKCHAIN_API } from "../api/blockchain";
import { pollTaskResult } from "../api/tasks";

import SuiteRequestPreparePanel from "./SuiteRequestPreparePanel";
import { useSuiteRequestTx } from "../hooks/useSuiteRequestTx";
import { normalizePrepared } from "../utils/normalizePrepared";
import "../styles/components/datatable.css";


const SuiteRegisterDialog = ({
  visible,
  onHide,
  network = "sepolia",
  suitePayload,

  initialCategoryKey = "mobility",
  initialFileFormatKey = "csv",
  initialBountyEth = 0.005,
  initialDeadline = new Date(Date.now() + 7 * 24 * 3600 * 1000),
  initialTotalExpected = 10,

  enableBackend = true,
  enableOnchain = true,
  onPrepared,
  onCreated,
}) => {
  const toast = useToast();
  const showToast = (severity, summary, detail) =>
    toast.current?.show({ severity, summary, detail, life: 6000 });

  const lastTxHashRef = useRef(null);
  const explorerTxUrl = (hash) =>
    network === "mainnet"
      ? `https://etherscan.io/tx/${hash}`
      : `https://${network}.etherscan.io/tx/${hash}`;

  const [sourceMode, setSourceMode] = useState("manual");
  const [metadataURI, setMetadataURI] = useState("");
  const [suiteURI, setSuiteURI] = useState("");
  const [docsURI, setDocsURI] = useState("");

  const [bountyEth, setBountyEth] = useState(initialBountyEth);
  const [categoryKey, setCategoryKey] = useState(initialCategoryKey);
  const [fileFormatKey, setFileFormatKey] = useState(initialFileFormatKey);
  const [deadline, setDeadline] = useState(initialDeadline);
  const [totalExpected, setTotalExpected] = useState(initialTotalExpected);

  const [sending, setSending] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [prepared, setPrepared] = useState(null);

  const { byName, loading: regLoading } = useContractsRegistry(network);
  const srr = byName?.["DatasetRequestRegistry"];
  const { wallet, balance, web3, ensureSepolia, connect } = useMetamaskContext();

  const { create } = useSuiteRequestTx({ web3, srr, explorerTxUrl });

  const hasRegistry = !!(srr && srr.address && srr.abi);
  const canOnchain  = hasRegistry && !!web3 && !regLoading && !!enableOnchain;

  const isSigExpiredErr = (e) =>
    /sig expired/i.test(e?.message || e?.detail?.reason || e?.detail?.message || "");

  const handlePrepareBackend = async () => {
    try {
      setPreparing(true);
      setPrepared(null);

      let account = wallet;
      if (!account) {
        await connect();
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        account = accounts?.[0];
      }
      if (!account) {
        showToast("error", "Connect wallet", "Please connect your wallet before preparing.");
        return;
      }

      const expectationSuiteId = suitePayload?.expectation_suite_id || null;
      const deadlineTs = Math.floor(new Date(deadline).getTime() / 1000);

      const payload = {
        network,
        requester: account,
        suite: suitePayload,
        category: categoryKey,
        fileFormat: fileFormatKey,
        deadline: deadlineTs,
        totalExpected: Number(totalExpected || 0),
        expectation_suite_id: expectationSuiteId,
      };

      const { data } = await BLOCKCHAIN_API.prepareSuite(payload);

      let finalResult = data;
      if (data?.task_id) {
        finalResult = await pollTaskResult(data.task_id, 2000, 600000);
      }

      // ✅ unwrap pollTaskResult envelope
      const preparedPayload = finalResult?.result ?? finalResult?.data?.result ?? finalResult;

      const normalized = normalizePrepared(preparedPayload);

      // HARD guard so you see the real problem immediately
      if (!normalized?.suiteHash) {
        throw new Error("Backend prepare returned no suiteHash (check normalizePrepared / backend response)");
      }

      setPrepared(normalized);
      setSourceMode("backend");

      if (normalized?.certificateURI) setMetadataURI(normalized.certificateURI);
      if (normalized?.suiteURI) setSuiteURI(normalized.suiteURI);
      if (normalized?.docsURI) setDocsURI(normalized.docsURI);

      // ✅ call onPrepared with the thing you actually store/use
      onPrepared?.(normalized);

      showToast("success", "Prepared via backend", "IPFS URIs and suiteHash ready.");
    } catch (e) {
      showToast("error", "Backend prepare failed", e?.response?.data?.error || e?.message || "Unknown error");
      setPrepared(null);
    } finally {
      setPreparing(false);
    }
  };


  const createSuiteOnChain = async () => {
    if (!canOnchain) {
      showToast("warn", "Create disabled",
        !enableOnchain ? "On-chain flow disabled by props."
        : regLoading ? "Registry is still loading."
        : !hasRegistry ? "Registry ABI/address missing."
        : !web3 ? "Web3/MetaMask not available."
        : "Unknown precondition."
      );
      return;
    }

    setSending(true);
    try {
      const { warnings, txHash, receipt } = await create({
        sourceMode,
        prepared,
        suitePayload,
        suiteURI, docsURI, metadataURI,
        categoryKey, fileFormatKey,
        deadline,
        totalExpected,
        bountyEth,
        wallet, ensureSepolia, connect,
        onCreated,
        onHide,
        onTxHash: (hash) => { lastTxHashRef.current = hash; },
        probeMode: "warn",
      });

      // show any preflight warnings we got
      warnings?.forEach((w) => showToast("warn", "Preflight", w));

      if (txHash) {
        showToast("info", "Transaction submitted",
          <>Hash:&nbsp;<a href={explorerTxUrl(txHash)} target="_blank" rel="noreferrer">
            {txHash.slice(0,10)}…{txHash.slice(-8)}
          </a></>
        );
      }

      if (receipt?.transactionHash) {
        showToast("success", "Suite request mined",
          <>Tx:&nbsp;<a href={explorerTxUrl(receipt.transactionHash)} target="_blank" rel="noreferrer">
            {receipt.transactionHash.slice(0,10)}…{receipt.transactionHash.slice(-8)}
          </a></>
        );
        onCreated?.({ txHash: lastTxHashRef.current || receipt.transactionHash, receipt });

        try {
          const { data } = await BLOCKCHAIN_API.ingestTx({
            network,
            address: srr.address,
            tx_hash: receipt.transactionHash,
          });

          if (data?.task_id) {
            await pollTaskResult(data.task_id, 2000, 120000); // 2s interval, 2 min max
          }
        } catch (e) {
          showToast("warn", "Ingest warning", e?.response?.data?.error || e.message);
        }

        onHide?.(); // close dialog after success
      }

    } catch (e) {
      // unified error surface from the hook
      if (isSigExpiredErr(e) || e?.code === "E_SIG_EXPIRED") {
        showToast(
          "warn",
          "Signature expired",
          "Your prepared signature has expired. Please click “Prepare via backend” again to refresh it."
        );
        // keep the user in backend mode and make the prepare button obvious
        setSourceMode("backend");
        setPrepared((p) => p && { ...p, _expired: true });
      } else {
        const msg = e?.message || e?.detail?.reason || e?.detail?.message || "Unknown error";
        showToast("error", "Transaction failed", msg);
      }
    } finally {
      setSending(false);
    }
  };



  return (
    <Dialog
      header="Register Expectations Request (On-Chain)"
      visible={visible}
      onHide={() => !sending && onHide?.()}
      style={{ width: "40rem", maxWidth: "90vw" }}
      modal
      appendTo={document.body}
      blockScroll
      contentStyle={{ maxHeight: "70vh", overflowY: "auto" }}
      footer={
        <div className="flex justify-end gap-2 p-2">
          <Button
            label="Cancel"
            className="p-button-text"
            disabled={sending}
            onClick={() => onHide?.()}
          />
          <Button
            label={sending ? "Sending…" : "Create On-Chain"}
            icon={sending ? "pi pi-spin pi-spinner" : "pi pi-check"}
            disabled={
              sending ||
              preparing ||
              !hasRegistry || regLoading || !web3 ||
              !categoryKey || !fileFormatKey || !deadline ||
              !Number.isFinite(bountyEth) || bountyEth <= 0 ||
              !Number.isFinite(totalExpected) || totalExpected <= 0 ||
              (
                // require artifacts based on the selected source
                (sourceMode === "manual"  && (!suiteURI || !metadataURI)) ||
                (sourceMode === "backend" && !prepared)
              )
            }
            onClick={createSuiteOnChain}
          />
        </div>
      }
    >
      <div className="flex items-center justify-between mb-2 text-sm">
        <div>
          {wallet ? (
            <>Connected: {wallet.slice(0,6)}…{wallet.slice(-4)} {balance ? `• ${balance} ETH` : ""}</>
          ) : ("Wallet not connected")}
        </div>
        {!wallet && <Button label="Connect Wallet" size="small" onClick={connect} />}
      </div>

      {enableBackend && (
        <div className="mb-3">
          <div className="flex align-items-center gap-4">
            <div className="flex align-items-center gap-2">
              <RadioButton inputId="rb-man" value="manual" onChange={(e) => setSourceMode(e.value)} checked={sourceMode === "manual"} />
              <label htmlFor="rb-man">I already have IPFS URIs (manual)</label>
            </div>
            <div className="flex align-items-center gap-2">
              <RadioButton inputId="rb-bk" value="backend" onChange={(e) => setSourceMode(e.value)} checked={sourceMode === "backend"} />
              <label htmlFor="rb-bk">Let backend upload to IPFS</label>
            </div>
          </div>
        </div>
      )}

      {sourceMode === "manual" && (
        <div className="p-fluid grid">
          <div className="field col-12">
            <label>Suite URI (suite.json)</label>
            <InputText value={suiteURI} onChange={(e) => setSuiteURI(e.target.value || "")} placeholder="ipfs://…" />
          </div>
          <div className="field col-12">
            <label>Docs URI (optional)</label>
            <InputText value={docsURI} onChange={(e) => setDocsURI(e.target.value || "")} placeholder="ipfs://…" />
          </div>
          <div className="field col-12">
            <label>Metadata URI (SBT / certificateURI)</label>
            <InputText value={metadataURI} onChange={(e) => setMetadataURI(e.target.value || "")} placeholder="ipfs://…" />
          </div>
        </div>
      )}

      {enableBackend && sourceMode === "backend" && (
        <SuiteRequestPreparePanel
          preparing={preparing}
          prepared={prepared}
          onClickPrepare={handlePrepareBackend}
        />
      )}

      <div className="p-fluid grid">
        <div className="field col-12 md:col-6">
          <label>Bounty (ETH)</label>
          <InputNumber
            value={Number.isFinite(bountyEth) ? bountyEth : 0}
            onValueChange={(e) => setBountyEth(Number.isFinite(e?.value) ? e.value : 0)}
            mode="decimal"
            minFractionDigits={3}
            maxFractionDigits={6}
          />
        </div>
        <div className="field col-12 md:col-6">
          <label>Total Expected</label>
          <InputNumber
            value={Number.isFinite(totalExpected) ? totalExpected : 1}
            onValueChange={(e) => setTotalExpected(Number.isFinite(e?.value) ? e.value : 1)}
            min={1}
          />
        </div>
        <div className="field col-12 md:col-6">
          <label>Category</label>
          <InputText value={categoryKey} onChange={(e) => setCategoryKey(e.target.value || "")} />
        </div>
        <div className="field col-12 md:col-6">
          <label>File format</label>
          <InputText value={fileFormatKey} onChange={(e) => setFileFormatKey(e.target.value || "")} />
        </div>
        <div className="field col-12">
          <label>Deadline</label>
          <Calendar value={deadline} onChange={(e) => setDeadline(e.value)} showTime hourFormat="24" />
        </div>
      </div>

      <pre style={{fontSize:12, opacity:.6}}>
        {JSON.stringify({
          sourceMode,
          enableOnchain,
          hasRegistry,
          regLoading,
          web3: !!web3,
          registryAddress: srr?.address,
          hasAbi: !!srr?.abi,
          metadataURI_ok: !!metadataURI,
          prepared_ok: !!prepared,
          bountyEth,
          totalExpected
        }, null, 2)}
      </pre>
    </Dialog>
  );
};

export default SuiteRegisterDialog;
