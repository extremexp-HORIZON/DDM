import React from "react";
import {BrowserRouter as Router, Routes, Route} from "react-router-dom";
import {PrimeReactProvider} from "primereact/api";
import {ThemeProvider} from "./context/ThemeContext";
import {ToastProvider} from "./context/ToastContext";
import {AuthProvider} from "./context/AuthContext";
import { MetamaskProvider } from "./context/MetamaskContext";
import Layout from "./components/Layout";
import FileUploader from "./pages/UploadFiles";
import ChunkUploader from "./pages/UploadChunks";
import LinkUploader from "./pages/UploadLinks";
import Catalog from "./pages/Catalog";
import MyCatalog from "./pages/MyCatalog";
import ExploreProjectsTable from "./pages/ExploreProjectsTable";
import SuiteRequestsDashboard from "./pages/SuiteRequestsDashboard";
import FileQueryBuilder from './pages/FileQueryBuilder';
import ExpectationSuites from "./pages/ExpectationSuites";
import SetPolicies from "./pages/SetPolicies";
import SetExpectations from "./pages/SetExpectations";
import ValidationsResults from "./pages/ValidationsResults";
import ValidationViewerPage from "./pages/ValidationViewerPage";
import ReportViewerPage from "./pages/ReportViewerPage";
import BlockchainContracts from "./pages/BlockchainContracts";
import Parametrics from "./pages/Parametrics";
import Tutorials from "./pages/Tutorials"
import "./styles/layout.css";
import "./styles/global.css";
import "primeicons/primeicons.css";
import LoginPage from "./pages/Login";



function App() {
  return (
    <Router>
      <AuthProvider>
        <ThemeProvider>
          <ToastProvider>
            <MetamaskProvider>
              <PrimeReactProvider>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Catalog/>}/>
                    <Route path="/login" element={<LoginPage/>}/>
                    <Route path="/my-catalog" element={<MyCatalog/>}/>
                    <Route path="/projects" element={<ExploreProjectsTable />} />
                    <Route path="/upload" element={<FileUploader/>}/>
                    <Route path="/catalog-advanced" element={<FileQueryBuilder/>}/>
                    <Route path="/upload-async" element={<ChunkUploader/>}/>
                    <Route path="/upload-links" element={<LinkUploader/>}/>
                    <Route path="/set-policies" element={<SetPolicies/>}/>
                    <Route path="/expectation-suites" element={<ExpectationSuites/>}/>
                    <Route path="/set-expectations" element={<SetExpectations/>}/>
                    <Route path="/validation-results" element={<ValidationsResults/>}/>
                    <Route path="/validation_results_viewer/:suiteId/:datasetId" element={<ValidationViewerPage/>}/>
                    <Route path="/report_viewer/:fileId" element={<ReportViewerPage/>}/>
                    <Route path="/parametrics" element={<Parametrics/>}/>
                    <Route path="/blockchain/contracts" element={<BlockchainContracts />} />
                    <Route path="/suite-requests-dashboard" element={<SuiteRequestsDashboard/>}/>
                    <Route path="/tutorials" element={<Tutorials/>}/>
                  </Routes>
                </Layout>
              </PrimeReactProvider>
            </MetamaskProvider>
          </ToastProvider>
        </ThemeProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
