import React from "react";
import { useTheme } from "../context/ThemeContext";
import TutorialStepCard from "../components/tutorials/TutorialStepCard";
import "../styles/components/web3Dashboard.css";
import "../styles/components/tutorials.css";
import { Dropdown } from "primereact/dropdown";
import { SelectButton } from "primereact/selectbutton";
import { TUTORIALS_API } from "../api/tutorials";
import { useAuth } from "../context/AuthContext";

const OWNER = "extremexp-HORIZON";
const REPO = "ddm_client";
const BRANCH = "main";

const MEDIA_OWNER = "extremexp-HORIZON";
const MEDIA_REPO = "DDM";
const MEDIA_REF = process.env.REACT_APP_TUTORIAL_MEDIA_REF || "nft_provenance";

// --- Challenge 05 links ---
const CH05_README =
  `https://github.com/${OWNER}/${REPO}/blob/${BRANCH}/challenges/challenge_05_ddm_access_control/README.md`;

const CH05_CODE_BASE =
  `https://github.com/${OWNER}/${REPO}/blob/${BRANCH}/challenges/challenge_05_ddm_access_control`;

// --- Challenge 08 links ---
const CH08_README =
  `https://github.com/${OWNER}/${REPO}/blob/${BRANCH}/challenges/challenge_08_nft_provenance/README.md`;

const CH08_CODE_BASE =
  `https://github.com/${OWNER}/${REPO}/blob/${BRANCH}/challenges/challenge_08_nft_provenance`;

// --- sample files folder ---
const SAMPLE_FILES_FOLDER =
  `https://github.com/${OWNER}/${REPO}/tree/${BRANCH}/challenges/sample_files`;

const sampleFiles = {
  titanicCsv: `https://github.com/${OWNER}/${REPO}/blob/${BRANCH}/challenges/sample_files/Titanic-Dataset.csv`,
  titanicLarge: `https://github.com/${OWNER}/${REPO}/blob/${BRANCH}/challenges/sample_files/titanic_large.csv`,
  titanicParquet: `https://github.com/${OWNER}/${REPO}/blob/${BRANCH}/challenges/sample_files/titanic.parquet`,
  titanicSample: `https://github.com/${OWNER}/${REPO}/blob/${BRANCH}/challenges/sample_files/titanic_sample.csv`,
  expectations: `https://github.com/${OWNER}/${REPO}/blob/${BRANCH}/challenges/sample_files/expectations.json`,
  filters: `https://github.com/${OWNER}/${REPO}/blob/${BRANCH}/challenges/sample_files/filters.json`,
  uploaderMeta: `https://github.com/${OWNER}/${REPO}/blob/${BRANCH}/challenges/sample_files/uploader_metadata.json`,
  prepareValidation: `https://github.com/${OWNER}/${REPO}/blob/${BRANCH}/challenges/sample_files/prepare_validation.json`,
};

// Helper to build one step object
const mkStep = ({
  stepNumber,
  name,
  descriptionSdk,
  descriptionUi,
  readmeBase,
  anchor,
  codeBase,
  codeFile,
  filesNeeded,
  mediaFolderPath,
}) => ({
  id: `step-${stepNumber}`,
  stepNumber,
  name,

  descriptionSdk: descriptionSdk || "",
  descriptionUi: descriptionUi || "",

  docsUrl: `${readmeBase}#${anchor}`,
  codeUrl: codeFile ? `${codeBase}/${codeFile}` : null,

  filesNeeded: filesNeeded || [],
  sampleFilesFolderUrl: SAMPLE_FILES_FOLDER,

  codeFolderUrl: codeBase.includes("/tree/")
    ? codeBase
    : codeBase.replace("/blob/", "/tree/"),

  mediaFolder: mediaFolderPath
    ? {
        owner: MEDIA_OWNER,
        repo: MEDIA_REPO,
        ref: MEDIA_REF,
        folderPath: mediaFolderPath,
      }
    : null,


  status: "pending",     // backend will override this
  payload: null,         // backend will override this
});

// --------- Step definitions ---------
const STEPS = [
  mkStep({
    stepNumber: 1,
    name: "Step 1 — Upload files",
    descriptionSdk:
      "Upload the datasets to DDM (Titanic-Dataset.csc + titanic.parquet + titanic_large.csv), add use_case crisis,under project tutorial-<username> and keep the returned file IDs.",
    descriptionUi:
      "Go to the Upload page and upload the files (Titanic-Dataset.csc + titanic.parquet + titanic_large.csv) under project <username>. Keep the page open — Step 2 needs it.",
    readmeBase: CH05_README,
    anchor: "1-upload-files",
    codeBase: CH05_CODE_BASE,
    codeFile: "01_upload_file.py",
    filesNeeded: [sampleFiles.titanicCsv, sampleFiles.titanicParquet, sampleFiles.titanicLarge],
    mediaFolderPath: "docs/tutorial_media/ch05/step_01",
  }),
  mkStep({
    stepNumber: 2,
    name: "Step 2 — Create uploader metadata JSON and attach it",
    descriptionSdk: "Edit uploader_metadata.json and attach it to your parquet upload.",
    descriptionUi:
      "In the same Upload page from Step 1, upload/attach metadata to the parquet file as seen in files needed." ,
    readmeBase: CH05_README,
    anchor: "2-create-uploader-metadata-json-and-attach-it",
    codeBase: CH05_CODE_BASE,
    codeFile: "02_attach_metadata.py",
    filesNeeded: [sampleFiles.uploaderMeta],
    mediaFolderPath: "docs/tutorial_media/ch05/step_02",
  }),
  mkStep({
    stepNumber: 3,
    name: "Step 3 — Download DDM generated file metadata for both files",
    descriptionSdk: "Fetch system-generated metadata artifacts and inspect output under out/runtime/...",
    descriptionUi:
      "Go to the Catalog page and download the DDM-generated metadata for both uploaded files.",
    readmeBase: CH05_README,
    anchor: "3-download-ddm-generated-file-metadata-for-both-files",
    codeBase: CH05_CODE_BASE,
    codeFile: "03_download_file_metadata.py",
    filesNeeded: [],
    mediaFolderPath: "docs/tutorial_media/ch05/step_03",
  }),
  mkStep({
    stepNumber: 4,
    name: "Step 4 — Download profiling report (HTML) and open it",
    descriptionSdk: "Download the profiling report and open it locally to inspect data duality metrics.",
    descriptionUi:
      "Go to the Catalog page and download the file report (HTML) for the dataset.\nhttps://ddm.extremexp-icom.intracom-telecom.com/",
    readmeBase: CH05_README,
    anchor: "4-download-profiling-report-for-csv-file-html-and-open-it",
    codeBase: CH05_CODE_BASE,
    codeFile: "04_download_report_html.py",
    filesNeeded: [],
    mediaFolderPath: "docs/tutorial_media/ch05/step_04",
  }),
  mkStep({
    stepNumber: 5,
    name: "Step 5 — Set / Run custom advanced catalog query",
    descriptionSdk: "Run an advanced query using filters.json and iterate until you list only your CSV.",
    descriptionUi:
      "Go to Catalog Advanced and run a custom query according to filters.json (files needed) until you list only your Titanic-Dataset.csv. Keep the page open — Step 6 needs it.",
    readmeBase: CH05_README,
    anchor: "5-set--run-custom-advanced-catalog-query",
    codeBase: CH05_CODE_BASE,
    codeFile: "05_catalog_advanced.py",
    filesNeeded: [sampleFiles.filters],
    mediaFolderPath: "docs/tutorial_media/ch05/step_05",
  }),
  mkStep({
    stepNumber: 6,
    name: "Step 6 — Save custom advanced query",
    descriptionSdk: "Save your advanced query under your username for reuse.",
    descriptionUi:
      "In Catalog Advanced Page, save the query that returns only one result, the Titanic-Dataset-csv.",
    readmeBase: CH05_README,
    anchor: "6-save-custom-advanced-query",
    codeBase: CH05_CODE_BASE,
    codeFile: "06_save_advanced_query.py",
    filesNeeded: [],
    mediaFolderPath: "docs/tutorial_media/ch05/step_06",
  }),
  mkStep({
    stepNumber: 7,
    name: "Step 7 — Create expectations suite",
    descriptionSdk: "Upload titanic_sample, generate expectations + column descriptions, then create the suite.",
    descriptionUi:
      "Go to Set Expectations and create a suite with name <username>, category crisis, fileformat csv, according to the expectations.json. See images/videos if needed.",
    readmeBase: CH05_README,
    anchor: "7-create-expectations-suite",
    codeBase: CH05_CODE_BASE,
    codeFile: "07_create_suite.py",
    filesNeeded: [sampleFiles.titanicSample, sampleFiles.expectations],
    mediaFolderPath: "docs/tutorial_media/ch05/step_07",
  }),
  mkStep({
    stepNumber: 8,
    name: "Step 8 — Validate dataset(s) against the suite",
    descriptionSdk: "Run validation for Titanic-Dataset.csv and compare results with the large dataset.",
    descriptionUi:
      "Go to Expectation Suites Page, copy your suite_id, then go to Catalog and validate both Titanic-Dtaset.csn and titanic_large.csv against that suite_id. What do you notice?",
    readmeBase: CH05_README,
    anchor: "8-validate-datasets-against-the-suite",
    codeBase: CH05_CODE_BASE,
    codeFile: "08_validate.py",
    filesNeeded: [sampleFiles.titanicCsv, sampleFiles.titanicLarge],
    mediaFolderPath: "docs/tutorial_media/ch05/step_08",
  }),
  mkStep({
    stepNumber: 9,
    name: "Step 9 — Download file",
    descriptionSdk: "Download Titanic-Dataset.csv from DDM using its file_id and inspect runtime output.",
    descriptionUi:
      "Go to My Catalog and download Titanic-Dataset.csv",
    readmeBase: CH05_README,
    anchor: "9-download-file",
    codeBase: CH05_CODE_BASE,
    codeFile: "09_download_file.py",
    filesNeeded: [],
    mediaFolderPath: "docs/tutorial_media/ch05/step_09",
  }),
  mkStep({
    stepNumber: 10,
    name: "Step 10 — Get catalog",
    descriptionSdk: "List catalog entries for the project to verify uploads exist in the catalog.",
    descriptionUi:
      "In My Catalog, expand the file view to see file log history of your previous actions",
    readmeBase: CH05_README,
    anchor: "10-get-catalog",
    codeBase: CH05_CODE_BASE,
    codeFile: "10_catalog_list.py",
    filesNeeded: [],
    mediaFolderPath: "docs/tutorial_media/ch05/step_10",
  }),

  // Challenge 08 step 11-16...
  mkStep({
    stepNumber: 11,
    name: "Step 11 — Update profile (optional but recommended)",
    descriptionSdk: "Register/update your wallet profile so the platform links your user to an on-chain address.",
    descriptionUi:
      "All next steps are done in Suite Requests Dashboard. You will need Metamask walleta and ipfsClient to view IPFS assets.",
    readmeBase: CH08_README,
    anchor: "1-update-profile-optional-but-recommended",
    codeBase: CH08_CODE_BASE,
    codeFile: "01_update_profile.py",
    filesNeeded: [],
    mediaFolderPath: "docs/tutorial_media/ch08/step_11",
  }),
  mkStep({
    stepNumber: 12,
    name: "Step 12 — Register dataset request (on-chain)",
    descriptionSdk: "Register the expectation suite request on Sepolia using suite.json from Challenge 05.",
    descriptionUi:
      "Use the Suite Requests Dashboard to create/register the dataset request.",
    readmeBase: CH08_README,
    anchor: "2-register-suite-on-chain",
    codeBase: CH08_CODE_BASE,
    codeFile: "02_register_dataset_request.py",
    filesNeeded: [],
    mediaFolderPath: "docs/tutorial_media/ch08/step_12",
  }),
  mkStep({
    stepNumber: 13,
    name: "Step 13 — Register dataset (on-chain)",
    descriptionSdk: "Register your dataset for the request: suite_id + catalog_id + dataset-uri. Copy the printed fingerprint.",
    descriptionUi:
      "In Suite Requests Dashboard, register the dataset for your request (suite_id + catalog_id + dataset-uri).",
    readmeBase: CH08_README,
    anchor: "3-register-dataset-on-chain",
    codeBase: CH08_CODE_BASE,
    codeFile: "03_register_dataset.py",
    filesNeeded: [],
    mediaFolderPath: "docs/tutorial_media/ch08/step_13",
  }),
  mkStep({
    stepNumber: 14,
    name: "Step 14 — Register validation (on-chain)",
    descriptionSdk: "Prepare prepare_validation.json and attempt to register validation. Non-validators will revert; wait for human validators.",
    descriptionUi:
      "In Suite Requests Dashboard, register validation for the dataset fingerprint. Use prepare_validation.json as your payload.",
    readmeBase: CH08_README,
    anchor: "4-register-validation-on-chain",
    codeBase: CH08_CODE_BASE,
    codeFile: "04_register_validation.py",
    filesNeeded: [sampleFiles.prepareValidation],
    mediaFolderPath: "docs/tutorial_media/ch08/step_14",
  }),
  mkStep({
    stepNumber: 15,
    name: "Step 15 — Claim rewards",
    descriptionSdk: "After human validation, claim rewards and receive the Dataset NFT certificate 🏅",
    descriptionUi:
      "In Suite Requests Dashboard, claim rewards when your dataset is validated.",
    readmeBase: CH08_README,
    anchor: "5-claim-rewards",
    codeBase: CH08_CODE_BASE,
    codeFile: "05_claim_rewards.py",
    filesNeeded: [],
    mediaFolderPath: "docs/tutorial_media/ch08/step_15",
  }),
  mkStep({
    stepNumber: 16,
    name: "Step 16 — Get notifications",
    descriptionSdk: "Check notifications to see validator actions and reward readiness (recommended: check often ⏳).",
    descriptionUi:
      "Use notifications in Sidebar to track validator actions.",
    readmeBase: CH08_README,
    anchor: "6-get-notifications",
    codeBase: CH08_CODE_BASE,
    codeFile: "06_get_notifications.py",
    filesNeeded: [],
    mediaFolderPath: "docs/tutorial_media/ch08/step_16",
  }),
];

export default function TutorialsPage() {
    const { isDarkMode } = useTheme();
    const { user } = useAuth();               // ✅ from context
    const username = user?.preferred_username;

    const [statusFilter, setStatusFilter] = React.useState(null);
    const [mode, setMode] = React.useState("ui");

    const [steps, setSteps] = React.useState(STEPS);

    const containerClass = `dataset-container ${isDarkMode ? "dark-mode" : "light-mode"}`;
    const cardClass = (extra = "") =>
        `suite-card ${isDarkMode ? "suite-card-dark" : "suite-card-light"} ${extra}`;

    const normalizeStatus = (s) => {
        const v = (s || "pending").toLowerCase();
        if (v === "passed") return "success";
        if (v === "rejected") return "failure";
        return v;
    };

    // ✅ load progress whenever mode changes
    React.useEffect(() => {
        let cancelled = false;
        if (!username) return; 

        const load = async () => {
            try {
            const data = await TUTORIALS_API.fetchTutorialProgress(username, mode);

            if (cancelled) return;

            const apiSteps = data?.steps || {};

            setSteps(prev =>
              prev.map(s => {
                const r = apiSteps[s.id];
                const statusForMode = r ? (r.status || "pending") : "pending";
                const payloadForMode = r ? (r.payload ?? null) : null;

                return {
                  ...s,
                  statusByMode: {
                    ...(s.statusByMode || {}),
                    [mode]: statusForMode,
                  },
                  payloadByMode: {
                    ...(s.payloadByMode || {}),
                    [mode]: payloadForMode,
                  },

                  // derived for rendering (what your filter + cards use)
                  status: statusForMode,
                  payload: payloadForMode,
                };
              })
            );

            } catch (e) {
                if (!cancelled) console.error("Failed to load tutorial progress:", e);
            }
        };

        load();
        return () => { cancelled = true; };
        }, [mode, username]);

    // ✅ filter based on state
    const filtered = steps.filter((s) => {
        const matchStatus = !statusFilter || normalizeStatus(s.status) === statusFilter;
        return matchStatus;
    });

    return (
        <div className={containerClass}>
            <div className="flex flex-wrap gap-2 align-items-center mb-3">
                <Dropdown
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.value)}
                options={[
                    { label: "All statuses", value: null },
                    { label: "Pending", value: "pending" },
                    { label: "Success", value: "success" },
                    { label: "Failure", value: "failure" },
                ]}
                placeholder="Filter by status"
                className="w-14rem"
                />

                <SelectButton
                value={mode}
                onChange={(e) => setMode(e.value)}
                options={[
                    { label: "Client SDK", value: "sdk" },
                    { label: "UI", value: "ui" },
                ]}
                className="tutorial-mode-toggle"
                />
            </div>
            <div className="tutorial-web3-note">
              <i className="pi pi-info-circle" />
              <span>
                <strong> Web3 steps (11–16)</strong> require a connected wallet <strong>(MetaMask)</strong> to sign transactions.
                and an <strong>IPFS client</strong> to view on-chain artifacts (URIs).
              </span>
            </div>


            <h3>Tutorial Steps</h3>

            <div className="grid tutorial-steps-grid">
                {filtered.map((s) => (
                <TutorialStepCard key={s.id} step={s} cardClass={cardClass()} mode={mode} />
                ))}
            </div>
        </div>
  );
}
