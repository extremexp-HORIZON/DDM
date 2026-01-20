// src/components/web3/DatasetRequestSection.jsx
import React from "react";
import SuiteCard from "./SuiteCard";
import { Button } from "primereact/button";
import { Tag } from "primereact/tag";
import { shortAddr, formatArgValue, getExplorerAddressUrl, openInExplorer } from "../../utils/web3DashboardUtils";

const renderRegistryEventsTable = (events, emptyLabel, activeFilter) => {
  if (!events || events.length === 0) {
    return <div className="text-xs text-muted py-1">{emptyLabel}</div>;
  }

  const filtered = activeFilter ? events.filter((ev) => ev.name === activeFilter) : events;

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
            className={`text-xs badge-clickable ${isActive ? "badge-active" : ""}`}
            onClick={() => onToggle(name)}
          />
        );
      })}
    </div>
  );
};

const countByName = (events = []) =>
  events.reduce((acc, ev) => {
    const k = ev?.name;
    if (!k) return acc;
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

export default function DatasetRequestSection({
  cardClass,
  suiteContract,
  suitesToRender,
  loadingSuites,

  // actions
  onClaimSuite,
  notImplemented,
  onCancelRequest,
  onRegisterDatasetForSuite,

  // ✅ request-registry events props (same pattern as DatasetsSection)
  requestsExpanded,
  requestsLoading,
  requestEvents,
  requestEventFilter,
  setRequestEventFilter,
  onToggleRequestsRegistry,
}) {
  const requestEventCounts = React.useMemo(
    () => countByName(requestEvents || []),
    [requestEvents]
  );

  if (!suiteContract && !loadingSuites) return null;

  return (
    <>
      <h3>Dataset Request Registry</h3>

      {suiteContract && (
        <div className={cardClass("mb-3 thin-card full-width-card")}>
          <div className="flex justify-between items-center">
            <div>
              <div className="text-xs text-muted">DatasetRequestRegistry</div>
              <div className="font-semibold text-sm">{suiteContract.name}</div>
              <div className="text-xs text-muted mt-1">{suiteContract.network}</div>
            </div>

            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-1">
                <span className="text-xs" title={suiteContract.address}>
                  {shortAddr(suiteContract.address)}
                   <Button
                  className="p-button-text p-button-sm tag-icon-btn tag-icon-copy"
                  icon="pi pi-copy"
                  onClick={() => navigator.clipboard.writeText(suiteContract.address)}
                  tooltip="Copy address"
                  tooltipOptions={{ position: "top" }}
                />

                {getExplorerAddressUrl(suiteContract.network, suiteContract.address) && (
                  <Button
                    className="p-button-text p-button-sm tag-icon-btn tag-icon-navigate"
                    icon="pi pi-external-link"
                    onClick={() => openInExplorer(suiteContract.address, suiteContract.network)}
                    tooltip="Open in explorer"
                    tooltipOptions={{ position: "top" }}
                  />
                )}
                </span>               
              </div>

              {/* ✅ same toggle style */}
              <div className="flex items-center gap-2">
                <Button
                  className="p-button-text p-button-sm"
                  icon={requestsExpanded ? "pi pi-chevron-up" : "pi pi-chevron-down"}
                  label={requestsExpanded ? "Hide events" : "Show events"}
                  onClick={onToggleRequestsRegistry}
                />

                <Button
                  className="p-button-text p-button-sm"
                  icon="pi pi-plus-circle"
                  label="Register suite"
                  onClick={() => notImplemented?.("Register suite")}
                />
              </div>
            </div>
          </div>

          {/* ✅ expanded events block */}
          {requestsExpanded && (
            <>
              <div className="flex items-center justify-between mt-2">
                <div className="flex-1">
                  <div className="text-xs text-muted flex items-center gap-2">
                    <span className="font-semibold">Filters:</span>
                    {requestEventFilter && (
                      <span>
                        Showing only <strong>{requestEventFilter}</strong> events.
                      </span>
                    )}
                  </div>

                  {renderEventBadges(requestEventCounts, requestEventFilter, (name) =>
                    setRequestEventFilter?.((prev) => (prev === name ? null : name))
                  )}
                </div>

                {requestEventFilter && (
                  <Button
                    className="p-button-text p-button-sm ml-2"
                    icon="pi pi-filter-slash"
                    label="Clear"
                    onClick={() => setRequestEventFilter?.(null)}
                  />
                )}
              </div>

              <div className="mt-2 registry-events-container registry-scroll">
                {requestsLoading ? (
                  <div className="text-xs text-muted">Loading events…</div>
                ) : (
                  renderRegistryEventsTable(
                    requestEvents,
                    "No dataset request registry events yet.",
                    requestEventFilter
                  )
                )}
              </div>
            </>
          )}
        </div>
      )}

      {loadingSuites && (
        <div className="text-center mt-2 text-sm">Loading suite requests…</div>
      )}

      {!loadingSuites && suitesToRender.length === 0 && (
        <div className={cardClass("mt-2 thin-card")}>
          <div className="text-center text-sm py-2">
            No suite requests found for this network / filters.
          </div>
        </div>
      )}

      <div className="text-xs text-muted ml-2">Registered Dataset Requests</div>

      <div className="suite-requests-scroll">
        <div className="suite-grid mb-4">
          {suitesToRender.map((row) => (
            <SuiteCard
              key={row.id}
              suite={row}
              className={cardClass("thin-card")}
              onCancel={() => onCancelRequest?.(row.id)}
              onClaim={onClaimSuite ? () => onClaimSuite(row.id) : undefined}
              onRegisterDataset={
                onRegisterDatasetForSuite ? () => onRegisterDatasetForSuite(row) : undefined
              }
            />
          ))}
        </div>
      </div>
    </>
  );
}
