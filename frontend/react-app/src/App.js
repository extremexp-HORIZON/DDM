import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { PrimeReactProvider } from "primereact/api";
import { ThemeProvider } from "./context/ThemeContext"; 
import { ToastProvider } from "./context/ToastContext";
import Layout from "./components/Layout";
import FileUploader from "./pages/UploadFiles";
import ChunkUploader from "./pages/UploadChunks";
import LinkUploader from "./pages/UploadLinks";
import Catalog from "./pages/Catalog";
import MyCatalog from "./pages/MyCatalog";
import SetPolicies from "./pages/SetPolicies";
import SetExpectations from "./pages/SetExpectations";
import ExperimentCards from "./pages/ExperimentCards";
import Parametrics from "./pages/Parametrics";


import "primeicons/primeicons.css";
import "./Layout.css";
import "./App.css";

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <PrimeReactProvider>
          <Router>
            <Layout>
              <Routes>
                <Route path="/" element={<Catalog />} />
                <Route path="/my-catalog" element={<MyCatalog />} />
                <Route path="/upload" element={<FileUploader />} />
                <Route path="/upload-async" element={<ChunkUploader />} />
                <Route path="/upload-links" element={<LinkUploader />} />
                <Route path="/set-policies" element={<SetPolicies />} />
                <Route path="/set-expectations" element={<SetExpectations />} />
                <Route path="/experiment-cards" element={<ExperimentCards />} />
                <Route path="/parametrics" element={<Parametrics />} />
              </Routes>
            </Layout>
          </Router>
        </PrimeReactProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
