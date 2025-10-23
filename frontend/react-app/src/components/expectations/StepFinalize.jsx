// src/pages/Wizard/steps/StepFinalize.jsx
import React, { useMemo, useState } from "react";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import { InputNumber } from "primereact/inputnumber";
import { Calendar } from "primereact/calendar";
import { ProgressSpinner } from "primereact/progressspinner";
import Web3 from "web3";
import { useToast } from "../../context/ToastContext";

import "../../styles/components/stepper.css";
import { useExpectationSuite } from "../../hooks/useExpectationSuite";
import ExpectationSuiteViewer from "../../components/ExpectationSuiteViewer";
import { useContractsRegistry } from "../../hooks/useContractsRegistry";
import { useMetamask } from "../../hooks/useMetamask";

const StepFinalize = ({ saveExpectations }) => {
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  function showToast(severity, summary, detail) {
    toast.current?.show({ severity, summary, detail, life: 6000 });
  }

  function explorerTxUrl(hash, network = "sepolia") {
    const bases = {
      sepolia: "https://sepolia.etherscan.io/tx/",
      mainnet: "https://etherscan.io/tx/",
    };
    return (bases[network] || bases.sepolia) + hash;
  }

  // on-chain dialog state
  const [dlgOpen, setDlgOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [bountyEth, setBountyEth] = useState(0.05);
  const [category, setCategory] = useState("general");
  const [receiptURI, setReceiptURI] = useState("");
  const [deadline, setDeadline] = useState(new Date(Date.now() + 7 * 24 * 3600 * 1000)); // +7 days
  const [totalExpected, setTotalExpected] = useState(10);

  const { suite, fetchSuite } = useExpectationSuite();
  const { byName, loading: regLoading, error: regErr } = useContractsRegistry("sepolia");

  // Your MetaMask hook
  const { isAvailable, wallet, connect, error: mmError } = useMetamask();

  // Build web3 from injected provider (only when available)
  const web3 = useMemo(() => {
    if (!isAvailable || !window.ethereum) return null;
    return new Web3(window.ethereum);
  }, [isAvailable]);

  const srr = byName?.["SuiteRequestRegistry"];
  const okToTransact = !!srr && !!suite && !regLoading && !!web3;

  // ---------- server-side save (unchanged) ----------
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await saveExpectations();
      if (res?.success) {
        setSubmitted(true);
        await fetchSuite(res.suite_id);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // ---------- on-chain submit using MetaMask + web3 ----------
  const createSuiteOnChain = async () => {
    if (!okToTransact) return;

    setSending(true);
    try {
      // Ensure connected account
      let account = wallet;
      if (!account) {
        await connect(); // your hook also ensures Sepolia
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        account = accounts?.[0];
      }
      if (!account) throw new Error("No wallet connected.");

      const suiteJson  = JSON.stringify(suite);
      const suiteHash  = web3.utils.keccak256(suiteJson);
      const valueWei   = web3.utils.toWei(String(bountyEth), "ether");
      const deadlineTs = Math.floor(new Date(deadline).getTime() / 1000);

      const contract = new web3.eth.Contract(srr.abi, srr.address);
      const promi = contract.methods
        .createSuiteRequest(suiteHash, receiptURI || "", category || "", deadlineTs, Number(totalExpected))
        .send({ from: account, value: valueWei });

      promi
        .on("transactionHash", (hash) => {
          showToast(
            "info",
            "Transaction submitted",
            <>
              Hash:&nbsp;
              <a href={explorerTxUrl(hash, "sepolia")} target="_blank" rel="noreferrer">
                {hash.slice(0,10)}…{hash.slice(-8)}
              </a>
            </>
          );
        })
        .on("receipt", (rcpt) => {
          const hash = rcpt?.transactionHash;
          showToast(
            "success",
            "Suite request mined",
            <>
              Tx:&nbsp;
              <a href={explorerTxUrl(hash, "sepolia")} target="_blank" rel="noreferrer">
                {hash?.slice(0,10)}…{hash?.slice(-8)}
              </a>
            </>
          );
          setDlgOpen(false);
        })
        .on("confirmation", (conf, rcpt) => {
          if (conf === 1) {
            showToast("info", "1 confirmation", "Your transaction is now more secure.");
          }
        })
        .on("error", (err) => {
          showToast("error", "Transaction failed", err?.message || "User denied or RPC error");
        });

      // Await completion to control spinner (optional)
      await promi;
    } catch (err) {
      console.error("On-chain create failed:", err);
      showToast("error", "On-chain create failed", err?.message || "Unknown error");
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Finalize</h3>

      {submitted && suite ? (
        <div>
          <ExpectationSuiteViewer suite={suite} animate />
          <div className="text-center text-sm text-green-500 mt-2">
            ✅ Expectations saved. You can now create an on-chain request.
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          {saving ? (
            <ProgressSpinner style={{ width: 40, height: 40 }} strokeWidth="4" />
          ) : (
            <Button label="Save Expectations" className="btn btn-primary" onClick={handleSave} />
          )}
        </div>
      )}

      <div className="flex justify-center mt-4">
        <Button
          label="Create On-Chain Request"
          className="p-button-success"
          disabled={!suite || regLoading || !srr || !web3}
          onClick={() => setDlgOpen(true)}
          tooltip={
            !suite
              ? "Save expectations first"
              : regLoading
              ? "Loading contract registry…"
              : !srr
              ? regErr || "SuiteRequestRegistry not found"
              : !web3
              ? mmError || "MetaMask/Web3 not available"
              : ""
          }
        />
      </div>

      <Dialog
        header="Create Suite Request (On-Chain)"
        visible={dlgOpen}
        onHide={() => !sending && setDlgOpen(false)}
        style={{ width: "36rem", maxWidth: "90vw" }}
        modal
      >
        <div className="p-fluid grid">
          <div className="field col-12 md:col-6">
            <label>Bounty (ETH)</label>
            <InputNumber
              value={bountyEth}
              onValueChange={(e) => setBountyEth(e.value ?? 0)}
              mode="decimal"
              minFractionDigits={3}
              maxFractionDigits={6}
            />
          </div>
          <div className="field col-12 md:col-6">
            <label>Total Expected</label>
            <InputNumber value={totalExpected} onValueChange={(e) => setTotalExpected(e.value ?? 1)} min={1} />
          </div>

          <div className="field col-12">
            <label>Category</label>
            <InputText value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>

          <div className="field col-12">
            <label>Receipt URI (optional)</label>
            <InputText value={receiptURI} onChange={(e) => setReceiptURI(e.target.value)} placeholder="ipfs://…" />
          </div>

          <div className="field col-12">
            <label>Deadline</label>
            <Calendar value={deadline} onChange={(e) => setDeadline(e.value)} showTime hourFormat="24" />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-3">
          <Button label="Cancel" className="p-button-text" disabled={sending} onClick={() => setDlgOpen(false)} />
          <Button
            label={sending ? "Sending…" : "Create On-Chain"}
            icon={sending ? "pi pi-spin pi-spinner" : "pi pi-check"}
            disabled={sending || !okToTransact}
            onClick={createSuiteOnChain}
          />
        </div>
      </Dialog>
    </div>
  );
};

export default StepFinalize;
