// src/components/TxReceiptCard.js
import React from "react";
import { Button } from "primereact/button";
import { summarizeFeeFromReceipt } from "../utils/big";

function copy(text) {
  try { navigator.clipboard.writeText(text); } catch {}
}

export default function TxReceiptCard({ receipt, explorerTxUrl }) {
  const fee = receipt ? summarizeFeeFromReceipt(receipt) : null;
  const tx = receipt?.transactionHash || "";

  return (
    <div className="p-3 border-1 surface-border border-round">
      <div className="font-semibold mb-2">Transaction</div>

      <div className="text-sm mb-1 flex align-items-center gap-2">
        <span>Hash:&nbsp;</span>
        {tx ? (
          <>
            <a href={explorerTxUrl(tx)} target="_blank" rel="noreferrer">
              {tx.slice(0, 10)}…{tx.slice(-8)}
            </a>
            <Button
              icon="pi pi-copy"
              className="p-button-text p-button-sm"
              onClick={() => copy(tx)}
              tooltip="Copy tx hash"
            />
          </>
        ) : <span>—</span>}
      </div>

      <div className="text-sm">Block: {receipt?.blockNumber ?? "—"}</div>
      {fee && (
        <>
          <div className="text-sm">Gas used: {fee.gasUsed}</div>
          <div className="text-sm">Effective gas price (wei): {fee.effectiveGasPrice}</div>
          <div className="text-sm">
            Fee: {fee.feeEth} ETH ({fee.feeGwei} Gwei)
          </div>
        </>
      )}
      <div className="text-sm">Status: {receipt?.status ? "Success" : "Failed"}</div>
    </div>
  );
}
