import React from "react";
import {BrowserRouter as Router, Routes, Route} from "react-router-dom";
import {PrimeReactProvider} from "primereact/api";
import {ThemeProvider} from "./context/ThemeContext";
import {ToastProvider} from "./context/ToastContext";
import {AuthProvider} from "./context/AuthContext";
import Layout from "./components/Layout";
import FileUploader from "./pages/UploadFiles";
import ChunkUploader from "./pages/UploadChunks";
import LinkUploader from "./pages/UploadLinks";
import Catalog from "./pages/Catalog";
import MyCatalog from "./pages/MyCatalog";
import ExpectationSuites from "./pages/ExpectationSuites";
import SetPolicies from "./pages/SetPolicies";
import SetExpectations from "./pages/SetExpectations";
import ValidationsResults from "./pages/ValidationsResults";
import ValidationViewerPage from "./pages/ValidationViewerPage";
import ReportViewerPage from "./pages/ReportViewerPage";
import ExperimentCards from "./pages/ExperimentCards";
import Parametrics from "./pages/Parametrics";
import "./styles/layout.css";
import "./styles/global.css";
import "primeicons/primeicons.css";
import LoginPage from "./pages/Login";
import Logout from "./pages/Logout";


function App() {
  return (
    <Router>
      <AuthProvider>
        <ThemeProvider>
          <ToastProvider>
            <PrimeReactProvider>
              <Layout>
                <Routes>
                  <Route path="/" element={<Catalog/>}/>
                  <Route path="/login" element={<LoginPage/>}/>
                  <Route path="/logout" element={<Logout/>}/>
                  <Route path="/my-catalog" element={<MyCatalog/>}/>
                  <Route path="/upload" element={<FileUploader/>}/>
                  <Route path="/upload-async" element={<ChunkUploader/>}/>
                  <Route path="/upload-links" element={<LinkUploader/>}/>
                  <Route path="/set-policies" element={<SetPolicies/>}/>
                  <Route path="/expectation-suites" element={<ExpectationSuites/>}/>
                  <Route path="/set-expectations" element={<SetExpectations/>}/>
                  <Route path="/validation-results" element={<ValidationsResults/>}/>
                  <Route path="/validation_results_viewer/:suiteId/:datasetId" element={<ValidationViewerPage/>}/>
                  <Route path="/report_viewer/:fileId" element={<ReportViewerPage/>}/>
                  <Route path="/experiment-cards" element={<ExperimentCards/>}/>
                  <Route path="/parametrics" element={<Parametrics/>}/>
                </Routes>
              </Layout>
            </PrimeReactProvider>
          </ToastProvider>
        </ThemeProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
