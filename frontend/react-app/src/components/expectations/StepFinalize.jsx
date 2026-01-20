// src/pages/Wizard/steps/StepFinalize.jsx
import { useMemo, useState, useEffect } from "react";
import { Button } from "primereact/button";
import { ProgressSpinner } from "primereact/progressspinner";
import { useToast } from "../../context/ToastContext";
import { useExpectationSuite } from "../../hooks/useExpectationSuite";
import { useContractsRegistry } from "../../hooks/useContractsRegistry";
import SuiteRegisterDialog from "../../components/SuiteRegisterDialog";
import ExpectationSuiteViewer from "../../components/ExpectationSuiteViewer";
import TxReceiptCard from "../../components/TxReceiptCard";

const StepFinalize = ({
  saveExpectations,
  useCase,
  selectedCategory,
  customCategory,
  selectedFileTypes,
  expectations,
}) => {
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dlgOpen, setDlgOpen] = useState(false);
  const [txInfo, setTxInfo] = useState(null);

  const toast = useToast();
  const showToast = (s, t, d) =>
    toast.current?.show({ severity: s, summary: t, detail: d, life: 6000 });

  const { suite, fetchSuite } = useExpectationSuite();
  const { loading: regLoading } = useContractsRegistry("sepolia");

  // ✅ Reset saving spinner when step mounts (fix for the pre-show spinner)
  useEffect(() => {
    setSaving(false);
  }, []);

  const handleSave = async () => {
    setLoading(true);  
    try {
      const response = await saveExpectations();
      if (response.success) {
        setSubmitted(true);
        await fetchSuite(res.suite_id);
      }
    } finally {
      setSaving(false);
    }
  };

  const initialCategoryKey =
    (selectedCategory?.key ||
      selectedCategory ||
      customCategory ||
      "mobility") ?? "mobility";

  const suitePayload = useMemo(() => {
    // Prefer metadata coming from the saved suite (DB), fall back to wizard state
    const fromSuite = suite || {};
    return {
      name: useCase?.name ?? fromSuite.suite_name ?? "",
      description: useCase?.description ?? fromSuite.description ?? "",
      category: initialCategoryKey ?? fromSuite.category,
      fileFormats: selectedFileTypes ?? fromSuite.file_types ?? [],
      expectation_suite_id: fromSuite.id,
      // expectations selected in the wizard
      expectations: expectations?.expectations ?? fromSuite.expectations ?? [],
      tableExpectations: expectations?.tableExpectations ?? [],
      selectedExpectations: expectations?.selectedExpectations ?? [],

      // *** add these so docs can render columns ***
      column_names: fromSuite.column_names ?? [],
      column_descriptions: fromSuite.column_descriptions ?? {},

      // optional: if you already have them in memory (backend can also enrich)
      expectation_descriptions: fromSuite.expectation_descriptions ?? undefined,
    };
  }, [suite, useCase, initialCategoryKey, selectedFileTypes, expectations]);

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Finalize</h3>

      {/* single row toolbar */}
      <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
        {/* show SAVE only if not saved yet (no suite in store) */}
        {!suite && (
          <Button
            label={saving ? "Saving..." : "Save Expectations"}
            className="p-button-primary"
            onClick={handleSave}
            disabled={saving}
            loading={saving}                         // PrimeReact built-in loader
            icon={saving ? "pi pi-spin pi-spinner" : undefined} // optional spinning icon
          />
        )}

        {/* your Create On-Chain Request button can stay as it was below */}
        {!txInfo && (
          <Button
            label="Create On-Chain Request"
            className="p-button-success"
            disabled={!suite || regLoading}
            onClick={() => setDlgOpen(true)}
            tooltip={
              !suite
                ? "Save expectations first"
                : regLoading
                ? "Loading contract registry…"
                : ""
            }
          />
        )}
      </div>


      {/* Show tx summary after success */}
      {txInfo && (
        <TxReceiptCard
          network="sepolia"
          txHash={txInfo.txHash || txInfo?.receipt?.transactionHash}
          receipt={txInfo.receipt}
          explorerTxUrl={(hash) => `https://sepolia.etherscan.io/tx/${hash}`}
        />
      )}

      {!!suite && <ExpectationSuiteViewer suite={suite} animate />}

      <SuiteRegisterDialog
        visible={dlgOpen}
        onHide={() => setDlgOpen(false)}
        network="sepolia"
        suitePayload={suitePayload}
        initialCategoryKey={initialCategoryKey}
        initialFileFormatKey={selectedFileTypes?.[0] || "csv"}
        initialBountyEth={0.05}
        initialTotalExpected={10}
        enableBackend={true}
        enableOnchain={true}
        onPrepared={(res) =>
          showToast("info", "Prepared", "Suite artifacts ready")
        }
        onCreated={({ txHash, receipt }) => {
          setTxInfo({ txHash, receipt });
          showToast("success", "Created", "Suite request created on-chain");
        }}
      />
    </div>
  );
};

export default StepFinalize;
