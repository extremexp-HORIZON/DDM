// src/components/web3/ClaimRewardDialog.jsx
import React, { useEffect, useState } from "react";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import { Button } from "primereact/button";
import { Checkbox } from "primereact/checkbox";
import { openIpfsUri } from "../../utils/web3DashboardUtils";

export default function ClaimRewardDialog({
  visible,
  suiteId,
  datasetFingerprint,
  onChangeDatasetFingerprint,
  onHide,
  onSubmit,
  submitting,


  preparing = false,
  prepared = null, // { metadataURI, level, deadline, signature, category }
}) {
  const [mintNft, setMintNft] = useState(true);

  // reset checkbox when dialog opens if you want
  useEffect(() => {
    if (visible) setMintNft(true);
  }, [visible]);

  const showPreparedBlock = mintNft && (preparing || prepared);

  return (
    <Dialog
      header={`Claim reward for request #${suiteId ?? "-"}`}
      visible={visible}
      onHide={submitting || preparing ? undefined : onHide}
      style={{ width: "30rem", maxWidth: "90vw" }}
      modal
    >
      <div className="flex flex-column gap-3 mt-1">
        <div className="text-xs text-muted">
          You can claim a reward for a dataset you uploaded that:
          <ul className="ml-3 mt-1">
            <li>matches this request’s <code>suiteHash</code>,</li>
            <li>has been validated as <strong>valid</strong>, and</li>
            <li>hasn’t already been used to claim this reward.</li>
          </ul>
        </div>

        <div className="flex flex-column gap-1">
          <label className="text-sm">Dataset fingerprint (bytes32)</label>
          <InputText
            value={datasetFingerprint}
            onChange={(e) => onChangeDatasetFingerprint(e.target.value)}
            placeholder="0x... (dataset fingerprint)"
            disabled={submitting || preparing}
          />
        </div>

        <div className="flex align-items-center gap-2">
          <Checkbox
            inputId="mintNft"
            checked={mintNft}
            onChange={(e) => setMintNft(!!e.checked)}
            disabled={submitting || preparing}
          />
          <label htmlFor="mintNft" className="text-sm">
            Mint NFT badge (recommended)
          </label>
        </div>

        {showPreparedBlock && (
          <div className="flex flex-column gap-2 p-2 border-1 border-round surface-border">
            <div className="text-xs text-muted">
              {preparing ? "Preparing NFT metadata (IPFS)..." : "NFT metadata prepared:"}
            </div>

            <div className="flex flex-column gap-1">
              <label className="text-sm">metadataURI</label>
              <div className="flex gap-2">
                <InputText value={prepared?.metadataURI || ""} readOnly className="w-full" />
                <Button
                  className="p-button-text p-button-sm"
                  icon="pi pi-copy"
                  disabled={!prepared?.metadataURI || preparing}
                  onClick={() => navigator.clipboard.writeText(prepared.metadataURI)}
                  tooltip="Copy"
                  tooltipOptions={{ position: "top" }}
                />
                <Button
                  className="p-button-text p-button-sm"
                  icon="pi pi-external-link"
                  disabled={!prepared?.metadataURI || preparing}
                  onClick={() => openIpfsUri(prepared.metadataURI)}
                  tooltip="Open"
                  tooltipOptions={{ position: "top" }}
                />
              </div>
            </div>

            <div className="flex flex-column gap-1">
              <label className="text-sm">level</label>
              <InputText value={prepared?.level || ""} readOnly />
            </div>

            <div className="flex flex-column gap-1">
              <label className="text-sm">deadline</label>
              <InputText value={prepared?.deadline || ""} readOnly />
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 mt-4">
        <Button
          label="Cancel"
          className="p-button-text"
          onClick={onHide}
          disabled={submitting || preparing}
        />
        <Button
          label={
            submitting ? "Claiming…" : mintNft ? "Claim + mint" : "Claim reward"
          }
          icon={submitting ? "pi pi-spin pi-spinner" : "pi pi-gift"}
          onClick={() => onSubmit({ mintNft })}
          disabled={submitting || preparing || !datasetFingerprint}
        />
      </div>
    </Dialog>
  );
}
