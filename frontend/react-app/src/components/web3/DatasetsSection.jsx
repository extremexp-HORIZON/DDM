// src/components/web3/DatasetsSection.jsx
import React from "react";
import { Button } from "primereact/button";
import { Tag } from "primereact/tag";
import DatasetCard from "./DatasetCard";
import { shortAddr, formatArgValue } from "../../utils/web3DashboardUtils";

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
            className={`text-xs badge-clickable ${isActive ? "badge-active" : ""}`}
            onClick={() => onToggle(name)}
          />
        );
      })}
    </div>
  );
};

// simple local counter (so you don't need to pass counts)
const countByName = (events = []) =>
  events.reduce((acc, ev) => {
    const k = ev?.name;
    if (!k) return acc;
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});

export default function DatasetsSection({
  cardClass,
  datasetContract,
  validationContract,
  loadingDatasets,
  filteredDatasets,
  registryCardHeader,
  formatRegisteredAt,
  onRegisterDataset,
  onSubmitValidationForDataset,
  onOpenValidationDialog,
  onOpenClaimDialog,

  // dataset registry props
  datasetExpanded,
  datasetLoading,
  datasetEvents,
  datasetEventFilter,
  setDatasetEventFilter,
  onToggleDatasetRegistry,

  // validation registry props
  validationExpanded,
  validationLoading,
  validationEvents,
  validationEventFilter,
  setValidationEventFilter,
  onToggleValidationRegistry,
  onClaimRewardForSuite,
}) {
  const datasetEventCounts = React.useMemo(
    () => countByName(datasetEvents || []),
    [datasetEvents]
  );
  const validationEventCounts = React.useMemo(
    () => countByName(validationEvents || []),
    [validationEvents]
  );




  return (
    <>
      <div className="flex justify-between items-center mb-2 mt-3">
        <h3>Datasets &amp; Validations</h3>
      </div>

      {(datasetContract || validationContract) && (
        <div className="dataset-registry-panel mb-2">
          {/* DatasetRegistry */}
          {datasetContract && (
            <div className={cardClass("thin-card")}>
              <div className="flex justify-between items-center">
                <div className="flex-1">
                  {registryCardHeader("DatasetRegistry", datasetContract)}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    className="p-button-text p-button-sm"
                    icon={datasetExpanded ? "pi pi-chevron-up" : "pi pi-chevron-down"}
                    label={datasetExpanded ? "Hide events" : "Show events"}
                    onClick={onToggleDatasetRegistry}
                  />
                  <Button
                    className="p-button-text p-button-sm"
                    icon="pi pi-plus"
                    label="Register dataset"
                    onClick={onRegisterDataset}
                  />
                </div>
              </div>

              {datasetExpanded && (
                <>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex-1">
                      <div className="text-xs text-muted flex items-center gap-2">
                        <span className="font-semibold">Filters:</span>
                        {datasetEventFilter && (
                          <span>
                            Showing only <strong>{datasetEventFilter}</strong> events.
                          </span>
                        )}
                      </div>

                      {renderEventBadges(
                        datasetEventCounts,
                        datasetEventFilter,
                        (name) =>
                          setDatasetEventFilter((prev) => (prev === name ? null : name))
                      )}
                    </div>

                    {datasetEventFilter && (
                      <Button
                        className="p-button-text p-button-sm ml-2"
                        icon="pi pi-filter-slash"
                        label="Clear"
                        onClick={() => setDatasetEventFilter(null)}
                      />
                    )}
                  </div>

                  <div className="mt-2 registry-events-container registry-scroll">
                    {datasetLoading ? (
                      <div className="text-xs text-muted">Loading events…</div>
                    ) : (
                      renderRegistryEventsTable(
                        datasetEvents,
                        "No dataset registry events yet.",
                        datasetEventFilter
                      )
                    )}
                  </div>

                </>
              )}
            </div>
          )}

          {/* ValidationRegistry */}
          {validationContract && (
            <div className={cardClass("thin-card")}>
              <div className="flex justify-between items-center">
                <div className="flex-1">
                  {registryCardHeader("ValidationRegistry", validationContract)}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    className="p-button-text p-button-sm"
                    icon={validationExpanded ? "pi pi-chevron-up" : "pi pi-chevron-down"}
                    label={validationExpanded ? "Hide events" : "Show events"}
                    onClick={onToggleValidationRegistry}
                  />
                  <Button
                   className="p-button-text p-button-sm"
                   icon="pi pi-check-circle"
                   label="Validate dataset"
                   onClick={() => onOpenValidationDialog?.("")}
                 />
                </div>
              </div>

              {validationExpanded && (
                <>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex-1">
                      <div className="text-xs text-muted flex items-center gap-2">
                        <span className="font-semibold">Filters:</span>
                        {validationEventFilter && (
                          <span>
                            Showing only <strong>{validationEventFilter}</strong> events.
                          </span>
                        )}
                      </div>

                      {renderEventBadges(
                        validationEventCounts,
                        validationEventFilter,
                        (name) =>
                          setValidationEventFilter((prev) =>
                            prev === name ? null : name
                          )
                      )}
                    </div>

                    {validationEventFilter && (
                      <Button
                        className="p-button-text p-button-sm ml-2"
                        icon="pi pi-filter-slash"
                        label="Clear"
                        onClick={() => setValidationEventFilter(null)}
                      />
                    )}
                  </div>

                  <div className="mt-2 registry-events-container registry-scroll">
                    {validationLoading ? (
                      <div className="text-xs text-muted">Loading events…</div>
                    ) : (
                      renderRegistryEventsTable(
                        validationEvents,
                        "No validation registry events yet.",
                        validationEventFilter
                      )
                    )}
                  </div>

                </>
              )}
            </div>
          )}
        </div>
      )}

      {loadingDatasets && (
        <div className="text-center mt-2 text-sm">Loading datasets…</div>
      )}

      {!loadingDatasets && filteredDatasets.length === 0 && (
        <div className={cardClass("mt-2 thin-card")}>
          <div className="text-center text-sm py-2">
            No datasets matching current filters on this network.
          </div>
        </div>
      )}

      <div className="text-xs text-muted ml-2">Registered Datasets</div>
      <div className="suite-grid dataset-grid">
        {filteredDatasets.map((d) => (
          <DatasetCard
            key={d.fingerprint}
            dataset={d}
            className={cardClass("thin-card")}
            formatRegisteredAt={formatRegisteredAt}
            onSubmitValidation={() => onSubmitValidationForDataset?.(d.fingerprint)}
            onClaimReward={() => onOpenClaimDialog?.(d.requestId, d.fingerprint)}
          />
        ))}
      </div>
      

    </>
    
  );
}
