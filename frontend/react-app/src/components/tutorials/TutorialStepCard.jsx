import React, { useRef, useState } from "react";
import { Button } from "primereact/button";
import { OverlayPanel } from "primereact/overlaypanel";
import { Tag } from "primereact/tag";
import { listGithubFolderMedia, githubFolderUrl } from "./githubMedia";

const openUrl = (u) => u && window.open(u, "_blank", "noopener,noreferrer");

const statusTag = (status) => {
  const s = (status || "pending").toLowerCase();

  const isSuccess = s === "success" || s === "passed";
  const isFailure = s === "failure" || s === "rejected";

  let cls = "status-pending";
  let label = "Pending";

  if (isSuccess) {
    cls = "status-success";
    label = "Success";
  } else if (isFailure) {
    cls = "status-failure";
    label = "Failure";
  }

  return <Tag value={label} className={`status-badge ${cls} text-xs`} />;
};

const fileName = (url) => {
  try {
    return decodeURIComponent(url.split("/").pop());
  } catch {
    return url;
  }
};

export default function TutorialStepCard({ step, cardClass, mode }) {
  const filesRef = useRef(null);
  const mediaRef = useRef(null);
  const detailsRef = useRef(null);

  const [mediaLoading, setMediaLoading] = useState(false);
  const [media, setMedia] = useState({ images: [], videos: [], error: null });

  const files = step.filesNeeded || [];
  const mf = step.mediaFolder;

  const isUiMode = mode === "ui";

  // UI mode => docs+code disabled; files+media enabled
  // SDK mode => docs+code enabled; files+media disabled
  const docsEnabled = !isUiMode;
  const codeEnabled = !isUiMode;
  const filesEnabled = isUiMode;
  const mediaEnabled = isUiMode;

  const desc = isUiMode ? (step.descriptionUi || "") : (step.descriptionSdk || "");

  const mediaFolderHtml =
    mf ? githubFolderUrl(mf.owner, mf.repo, mf.ref, mf.folderPath) : null;

  const loadMedia = async () => {
    if (!mf) return;
    setMediaLoading(true);
    const out = await listGithubFolderMedia(mf);
    setMedia(out);
    setMediaLoading(false);
  };

  // ✅ payload panel only if success (later backend will fill `step.payload`)
  const st = (step.status || "pending").toLowerCase();
  const isSuccess = st === "success" || st === "passed";
  const hasPayload = !!step.payload;

  return (
    <div className={cardClass}>
      <div className="suite-status-pill">{statusTag(step.status)}</div>

      {/* Header */}
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="text-xs text-muted">Step</div>
          <div className="font-semibold text-sm">{step.name}</div>
          <div className="text-xs text-muted mt-1">
            Created:{" "}
            {step.timestamp_created ? new Date(step.timestamp_created).toLocaleString() : "-"}
          </div>
        </div>
      </div>

      {/* Description */}
    <div className="text-xs mb-2 tutorial-step-desc">
        <span className="text-muted">Description: </span>
        <span>{desc || "-"}</span>
    </div>


      {/* Bottom Buttons */}
      <div className="action-row mt-2 text-xs" style={{ justifyContent: "flex-end" }}>
        {/* Docs */}
        <Button
          icon="pi pi-book"
          className="p-button-rounded p-button-text p-button-sm icon-btn btn-purple"
          disabled={!step.docsUrl || !docsEnabled}
          tooltip="Open documentation (README anchor)"
          tooltipOptions={{ position: "top" }}
          onClick={() => openUrl(step.docsUrl)}
        />

        {/* Code */}
        <Button
          icon="pi pi-github"
          className="p-button-rounded p-button-text p-button-sm icon-btn"
          disabled={!step.codeUrl || !codeEnabled}
          tooltip="Open code file (GitHub)"
          tooltipOptions={{ position: "top" }}
          onClick={() => openUrl(step.codeUrl)}
        />

        {/* Files */}
        <Button
          icon="pi pi-file"
          className="p-button-rounded p-button-text p-button-sm icon-btn btn-orange"
          disabled={!files.length || !filesEnabled}
          tooltip="Files needed"
          tooltipOptions={{ position: "top" }}
          onClick={(e) => filesRef.current?.toggle(e)}
        />

        {/* Media */}
        <Button
          icon="pi pi-images"
          className="p-button-rounded p-button-text p-button-sm icon-btn btn-teal"
          disabled={!mf || !mediaEnabled}
          tooltip="Images / videos (GitHub folder)"
          tooltipOptions={{ position: "top" }}
          onClick={async (e) => {
            mediaRef.current?.toggle(e);
            if (mf && !mediaLoading && !media.images.length && !media.videos.length) {
              await loadMedia();
            }
          }}
        />

        {/* Details (only if success + payload exists) */}
        <Button
          icon="pi pi-info-circle"
          className="p-button-rounded p-button-text p-button-sm icon-btn"
          disabled={!isSuccess || !hasPayload}
          tooltip="Details (only when success)"
          tooltipOptions={{ position: "top" }}
          onClick={(e) => detailsRef.current?.toggle(e)}
        />
      </div>

      {/* Files Panel */}
      <OverlayPanel ref={filesRef} style={{ width: "32rem" }}>
        <div className="text-xs" style={{ maxHeight: "20rem", overflow: "auto" }}>
          <div className="font-semibold mb-2">Files needed</div>

          <div className="flex flex-column gap-2">
            {files.map((u, idx) => (
              <div key={idx} className="flex justify-between items-center gap-2">
                <span className="text-muted">{fileName(u)}</span>
                <Button
                  className="p-button-text p-button-sm"
                  icon="pi pi-external-link"
                  tooltip="Open file on GitHub"
                  tooltipOptions={{ position: "top" }}
                  onClick={() => openUrl(u)}
                />
              </div>
            ))}
          </div>

          {step.sampleFilesFolderUrl && (
            <div className="mt-3">
              <Button
                className="p-button-text p-button-sm"
                icon="pi pi-folder-open"
                label="Open sample_files folder"
                onClick={() => openUrl(step.sampleFilesFolderUrl)}
              />
            </div>
          )}
        </div>
      </OverlayPanel>

      {/* Media Panel */}
      <OverlayPanel ref={mediaRef} style={{ width: "36rem" }}>
        <div className="text-xs" style={{ maxHeight: "24rem", overflow: "auto" }}>
          <div className="flex justify-between items-center mb-2">
            <div className="font-semibold">Media</div>
            <div className="flex items-center gap-2">
              {mediaFolderHtml && (
                <Button
                  className="p-button-text p-button-sm"
                  icon="pi pi-github"
                  tooltip="Open folder on GitHub"
                  tooltipOptions={{ position: "top" }}
                  onClick={() => openUrl(mediaFolderHtml)}
                />
              )}
              <Button
                className="p-button-text p-button-sm"
                icon="pi pi-refresh"
                tooltip="Refresh"
                tooltipOptions={{ position: "top" }}
                onClick={loadMedia}
                disabled={mediaLoading}
              />
            </div>
          </div>

          {mediaLoading && <div className="text-muted">Loading…</div>}
          {media.error && <div className="text-muted">No media ({media.error})</div>}

          {!!media.images.length && (
            <>
              <div className="font-semibold mb-1">Images</div>
              <div className="flex flex-wrap gap-2">
                {media.images.slice(0, 6).map((img) => (
                  <img
                    key={img.raw}
                    src={img.raw}
                    alt={img.name}
                    style={{ width: "10rem", borderRadius: "10px", cursor: "pointer" }}
                    onClick={() => openUrl(img.html)}
                    title="Open on GitHub"
                  />
                ))}
              </div>
            </>
          )}

          {!!media.videos.length && (
            <>
              <div className="font-semibold mt-3 mb-1">Videos</div>
              {media.videos.slice(0, 2).map((v) => (
                <div key={v.raw} className="mb-2">
                  <div className="text-muted mb-1">{v.name}</div>
                  <video controls style={{ width: "100%", borderRadius: "10px" }}>
                    <source src={v.raw} />
                  </video>
                </div>
              ))}
            </>
          )}

          {!mediaLoading && !media.error && !media.images.length && !media.videos.length && (
            <div className="text-muted">No images/videos found in this folder.</div>
          )}
        </div>
      </OverlayPanel>

      {/* Details Panel */}
      <OverlayPanel ref={detailsRef} style={{ width: "36rem" }}>
        <pre style={{ margin: 0, fontSize: "12px", maxHeight: "20rem", overflow: "auto" }}>
          {JSON.stringify(step.payload, null, 2)}
        </pre>
      </OverlayPanel>
    </div>
  );
}
