// components/web3/RegistriesPanel.jsx
import React from "react";
import { Button } from "primereact/button";
import { Tag } from "primereact/tag";
import {
  shortAddr,
  getExplorerAddressUrl,
  openInExplorer,
  formatArgValue,
  shortHex,
} from "../../utils/web3DashboardUtils";
import { openIpfsUri } from "../../utils/web3DashboardUtils";

const registryCardHeader = (label, contract) => {
  const addr = contract?.address;
  const net = contract?.network;
  const explorerUrl = getExplorerAddressUrl(net, addr);

  return (
    <div className="flex justify-between items-center mb-1">
      <div>
        <div className="text-xs text-muted">{label}</div>
        <div className="font-semibold text-sm">{contract?.name || "-"}</div>
        <div className="text-xs text-muted mt-1">{net}</div>
      </div>

      <div className="text-right">
        <div className="flex items-center justify-end gap-1">
          <span className="text-xs" title={addr || ""}>
            {addr ? shortAddr(addr) : "-"}
          </span>

          {addr && (
            <>
              <Button
                className="p-button-text p-button-sm tag-icon-btn tag-icon-copy"
                icon="pi pi-copy"
                onClick={() => navigator.clipboard.writeText(addr)}
                tooltip="Copy address"
                tooltipOptions={{ position: "top" }}
              />
              {explorerUrl && (
                <Button
                  className="p-button-text p-button-sm tag-icon-btn tag-icon-navigate"
                  icon="pi pi-external-link"
                  onClick={() => openInExplorer(addr, net)}
                  tooltip="Open in explorer"
                  tooltipOptions={{ position: "top" }}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const renderRegistryEventsTable = (events, emptyLabel, activeFilter) => {
  if (!events || events.length === 0) {
    return <div className="text-xs text-muted py-1">{emptyLabel}</div>;
  }

  const filtered = activeFilter
    ? events.filter((ev) => ev.name === activeFilter)
    : events;

  if (filtered.length === 0) {
    return (
      <div className="text-xs text-muted py-1">
        No events matching <strong>{activeFilter}</strong>.
      </div>
    );
  }

  const slice = filtered.slice(0, 50);

  return (
    <div className="registry-events-table-wrapper">
      <table className="registry-events-table">
        <thead>
          <tr>
            <th className="text-xs">Block</th>
            <th className="text-xs">LogIdx</th>
            <th className="text-xs">Event</th>
            <th className="text-xs">Tx</th>
            <th className="text-xs">Args</th>
          </tr>
        </thead>
        <tbody>
          {slice.map((ev) => {
            const args = ev.args || {};
            const argEntries = Object.entries(args);

            return (
              <tr key={ev.id}>
                <td className="text-xs">{ev.block_number}</td>
                <td className="text-xs">{ev.log_index}</td>
                <td className="text-xs">{ev.name}</td>
                <td className="text-xs" title={ev.tx_hash || ""}>
                  {shortAddr(ev.tx_hash || "")}
                </td>
                <td className="text-xs args-cell">
                  {argEntries.length === 0 ? (
                    <span className="text-muted">-</span>
                  ) : (
                    argEntries.map(([k, v]) => (
                      <div key={k} className="arg-row">
                        <span className="arg-key">{k}:</span>{" "}
                        <span className="arg-value">{formatArgValue(v)}</span>
                      </div>
                    ))
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {filtered.length > slice.length && (
        <div className="registry-event-more text-xs text-muted mt-1">
          +{filtered.length - slice.length} more…
        </div>
      )}
    </div>
  );
};

const renderEventBadges = (counts, activeName, onToggle) => {
  const entries = Object.entries(counts || {});
  if (!entries.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {entries.map(([name, count]) => {
        const isActive = activeName === name;
        return (
          <Tag
            key={name}
            value={`${name} (${count})`}
            className={`text-xs badge-clickable ${
              isActive ? "badge-active" : ""
            }`}
            onClick={() => onToggle(name)}
          />
        );
      })}
    </div>
  );
};

export default function RegistriesPanel({
  cardClass,

  // category props
  categoryContract,
  allowedCategories,
  catExpanded,
  onToggleCategory,
  catEvents,
  catLoading,
  catEventCounts,
  catEventFilter,
  setCatEventFilter,
  onRegisterCategory,
  onRemoveCategory,

  // format props
  fileFormatContract,
  allowedFormats,
  fmtExpanded,
  onToggleFileFormat,
  fmtEvents,
  fmtLoading,
  fmtEventCounts,
  fmtEventFilter,
  setFmtEventFilter,
  onRegisterFormat,
  onRemoveFormat,
  renderCategoryChip,
  renderFileFormatChip,

  // validator props
  validatorsContract,
  valRegExpanded,
  onToggleValidators,
  activeValidators,
  valRegEvents,
  valRegLoading,
  valRegEventCounts,
  valRegEventFilter,
  setValRegEventFilter,
  onRegisterValidator,
  openValidatorEdit,
  onRemoveValidator,
}) {
  return (
    <div className="registry-panel mb-3">
      {/* CategoryRegistry */}
      <div className={cardClass("thin-card")}>
        {registryCardHeader("CategoryRegistry", categoryContract)}

        {/* fixed-height registered area */}
        <div className="registry-registered-block">
          <div className="text-xs text-muted mb-1">Registered categories</div>
          {allowedCategories.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {allowedCategories.map((c) => (
                <Tag key={c} className="text-xs removable-tag">
                  <span className="flex items-center gap-1 m-2">
                    {renderCategoryChip(c)}
                    <Button
                      className="p-button-text p-button-danger p-button-sm tag-remove-btn"
                      icon="pi pi-times"
                      onClick={() => onRemoveCategory(c)}
                    />
                  </span>
                </Tag>
              ))}
            </div>
          ) : (
            <div className="text-2xs text-muted">
              No categories registered yet.
            </div>
          )}
        </div>

        {/* buttons BELOW, aligned across cards */}
        <div className="flex justify-between items-center mt-1">
          <Button
            className="p-button-text p-button-sm"
            icon={catExpanded ? "pi pi-chevron-up" : "pi pi-chevron-down"}
            label={catExpanded ? "Hide events" : "Show events"}
            onClick={onToggleCategory}
          />
          <Button
            className="p-button-text p-button-sm"
            icon="pi pi-plus"
            label="Register category"
            onClick={onRegisterCategory}
          />
        </div>

        {catExpanded && (
          <>
            <div className="flex items-center justify-between mt-2">
              <div className="flex-1">
                <div className="text-xs text-muted flex items-center gap-2">
                  <span>Filters:</span>
                  {catEventFilter && (
                    <span>
                      Showing only <strong>{catEventFilter}</strong> events.
                    </span>
                  )}
                </div>

                {renderEventBadges(
                  catEventCounts,
                  catEventFilter,
                  (name) =>
                    setCatEventFilter((prev) => (prev === name ? null : name))
                )}
              </div>

              {catEventFilter && (
                <Button
                  className="p-button-text p-button-sm ml-2"
                  icon="pi pi-filter-slash"
                  label="Clear"
                  onClick={() => setCatEventFilter(null)}
                />
              )}
            </div>

            <div className="mt-2 registry-events-container">
              {catLoading ? (
                <div className="text-xs text-muted">Loading events…</div>
              ) : (
                renderRegistryEventsTable(
                  catEvents,
                  "No category events yet.",
                  catEventFilter
                )
              )}
            </div>
          </>
        )}
      </div>

      {/* FileFormatRegistry */}
      <div className={cardClass("thin-card")}>
        {registryCardHeader("FileFormatRegistry", fileFormatContract)}

        {/* fixed-height registered area */}
        <div className="registry-registered-block">
          <div className="text-xs text-muted mb-1">Registered formats</div>
          {allowedFormats.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {allowedFormats.map((f) => (
                <Tag key={f} className="text-xs removable-tag">
                  <span className="flex items-center gap-2 m-2">
                    {renderFileFormatChip(f)}
                    <Button
                      className="p-button-text p-button-danger p-button-sm tag-remove-btn"
                      icon="pi pi-times"
                      onClick={() => onRemoveFormat(f)}
                    />
                  </span>
                </Tag>
              ))}
            </div>
          ) : (
            <div className="text-2xs text-muted">
              No formats registered yet.
            </div>
          )}
        </div>

        {/* buttons BELOW */}
        <div className="flex justify-between items-center mt-1">
          <Button
            className="p-button-text p-button-sm"
            icon={fmtExpanded ? "pi pi-chevron-up" : "pi pi-chevron-down"}
            label={fmtExpanded ? "Hide events" : "Show events"}
            onClick={onToggleFileFormat}
          />
          <Button
            className="p-button-text p-button-sm"
            icon="pi pi-plus"
            label="Register format"
            onClick={onRegisterFormat}
          />
        </div>

        {fmtExpanded && (
            <>
                
            <div className="flex items-center justify-between mt-2">
                <div className="flex-1">
                <div className="text-xs text-muted flex items-center gap-2">
                    <span className="font-semibold">Filters:</span>
                    {fmtEventFilter && (
                    <span>
                        Showing only <strong>{fmtEventFilter}</strong> events.
                    </span>
                    )}
                </div>

                {renderEventBadges(
                    fmtEventCounts,
                    fmtEventFilter,
                    (name) =>
                    setFmtEventFilter((prev) => (prev === name ? null : name))
                )}
                </div>

                {fmtEventFilter && (
                <Button
                    className="p-button-text p-button-sm ml-2"
                    icon="pi pi-filter-slash"
                    label="Clear"
                    onClick={() => setFmtEventFilter(null)}
                />
                )}
            </div>

            <div className="mt-2 registry-events-container">
                {fmtLoading ? (
                <div className="text-xs text-muted">Loading events…</div>
                ) : (
                renderRegistryEventsTable(
                    fmtEvents,
                    "No file format events yet.",
                    fmtEventFilter
                )
                )}
            </div>
            </>
        )}

      </div>

      {/* ValidatorsRegistry */}
      <div className={cardClass("thin-card")}>
        {registryCardHeader("ValidatorsRegistry", validatorsContract)}

        {/* fixed-height registered area */}
        <div className="registry-registered-block">
            <div className="text-xs text-muted mb-1">Registered Validators</div>
            {activeValidators.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                {activeValidators.map((v) => (
                    <Tag key={v.validator} className="text-xs validator-tag">
                    <div className="validator-badge m-2">
                        <div className="validator-badge-left">
                        <div
                            className="flex items-center gap-2"
                            title={v.validator}
                        >
                            <span>
                            <strong>validator:</strong> {shortAddr(v.validator)}
                            </span>
                            <span
                            className={`validator-status-pill ${
                                v.active ? "validator-status-active" : "validator-status-inactive"
                            }`}
                            >
                            {v.active ? "Active" : "Inactive"}
                            </span>
                        </div>

                        {v.description && (
                            <div title={v.description}>
                            <strong>description:</strong> {v.description}
                            </div>
                        )}

                        {v.codeURI && (
                            <div
                            className="flex items-center gap-1"
                            title={v.codeURI}
                            >
                            <span>
                                <strong>codeURI:</strong>{" "}
                                {formatArgValue(v.codeURI)}
                            </span>
                            <Button
                                className="p-button-text p-button-sm tag-icon-btn tag-icon-copy"
                                icon="pi pi-copy"
                                onClick={() =>
                                navigator.clipboard.writeText(v.codeURI)
                                }
                                tooltip="Copy codeURI"
                                tooltipOptions={{ position: "top" }}
                            />
                            <Button
                                className="p-button-text p-button-sm tag-icon-btn tag-icon-navigate"
                                icon="pi pi-external-link"
                                onClick={() => openIpfsUri(v.codeURI)}
                                tooltip="Open in IPFS gateway"
                                tooltipOptions={{ position: "top" }}
                            />
                            </div>
                        )}

                        {v.codeHash && (
                            <div title={v.codeHash}>
                            <strong>codeHash:</strong> {shortHex(v.codeHash)}
                            </div>
                        )}
                        </div>

                        <div className="validator-badge-right">
                        <Button
                            className="p-button-text p-button-sm tag-icon-btn tag-icon-edit"
                            icon="pi pi-pencil"
                            onClick={() => openValidatorEdit(v)}
                            tooltip="Edit validator"
                            tooltipOptions={{ position: "top" }}
                        />
                        <Button
                            className="p-button-text p-button-sm tag-icon-btn tag-icon-remove"
                            icon="pi pi-times"
                            onClick={() => onRemoveValidator(v.validator)}
                            tooltip="Remove validator"
                            tooltipOptions={{ position: "top" }}
                        />
                        </div>
                    </div>
                    </Tag>
                ))}
                </div>
            ) : (
                <div className="text-2xs text-muted">
                No validators registered yet.
                </div>
            )}
            </div>

        {/* buttons BELOW */}
        <div className="flex justify-between items-center mt-1">
          <Button
            className="p-button-text p-button-sm"
            icon={valRegExpanded ? "pi pi-chevron-up" : "pi pi-chevron-down"}
            label={valRegExpanded ? "Hide events" : "Show events"}
            onClick={onToggleValidators}
          />
          <Button
            className="p-button-text p-button-sm"
            icon="pi pi-plus"
            label="Register validator"
            onClick={onRegisterValidator}
          />
        </div>
        {valRegExpanded && (
          <>
            <div className="flex items-center justify-between mt-2">
              <div className="flex-1">
                <div className="text-xs text-muted flex items-center gap-2">
                  <span className="font-semibold">Filters:</span>
                  {valRegEventFilter && (
                    <span>
                      Showing only <strong>{valRegEventFilter}</strong> events.
                    </span>
                  )}
                </div>

                {renderEventBadges(
                  valRegEventCounts,
                  valRegEventFilter,
                  (name) =>
                    setValRegEventFilter((prev) =>
                      prev === name ? null : name
                    )
                )}
              </div>

              {valRegEventFilter && (
                <Button
                  className="p-button-text p-button-sm ml-2"
                  icon="pi pi-filter-slash"
                  label="Clear"
                  onClick={() => setValRegEventFilter(null)}
                />
              )}
            </div>

            <div className="mt-2 registry-events-container">
              {valRegLoading ? (
                <div className="text-xs text-muted">Loading events…</div>
              ) : (
                renderRegistryEventsTable(
                  valRegEvents,
                  "No validator events yet.",
                  valRegEventFilter
                )
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
