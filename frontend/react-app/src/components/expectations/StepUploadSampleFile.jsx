import React from 'react';
import { FileUpload } from 'primereact/fileupload';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Button } from 'primereact/button';
import SupportedFileTypesDialog from '../SupportedFileTypesDialog'; // adjust the path
import "../../styles/components/stepper.css"

const StepUploadSampleFile = ({
  loadingExpectations,
  uploadSampleFile,
  fileFormats,
  showFileExtensions,
  setShowFileExtensions,
  isDarkMode
}) => {

  // ✅ Custom header template for FileUpload
  const headerTemplate = (options) => {
    const { className, chooseButton, uploadButton } = options;
  
    return (
      <div
        className={className}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          padding: '10px'
        }}
      >
        {/* Left side */}
        <Button
          icon="pi pi-info-circle"
          className="p-button p-button-sm"
          onClick={() => setShowFileExtensions(true)}
        />
  
        {/* Right side */}
        <div className="flex items-center gap-2">
          {chooseButton}
          {uploadButton}
        </div>
      </div>
    );
  };
  
  

  return (
    <div>
      {loadingExpectations && (
        <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ProgressSpinner style={{ width: '20px', height: '20px' }} strokeWidth="5" />
            <span>Generating expectations...</span>
          </div>
        </div>
      )}

      <h3>Upload Sample File</h3>

      <FileUpload
        mode="advanced"
        chooseLabel="Choose File"
        accept={fileFormats}
        customUpload
        uploadHandler={uploadSampleFile}
        headerTemplate={headerTemplate}
      />

      {/* ✅ Dialog mounted here */}
      <SupportedFileTypesDialog
        visible={showFileExtensions}
        onHide={() => setShowFileExtensions(false)}
        isDarkMode={isDarkMode}
      />
    </div>
  );
};

export default StepUploadSampleFile;
