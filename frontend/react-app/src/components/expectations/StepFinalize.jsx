import React, { useState } from "react";
import { Button } from "primereact/button";
import { ProgressSpinner } from "primereact/progressspinner";

const StepFinalize = ({ saveExpectations }) => {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    const success = await saveExpectations();
    setLoading(false);

    if (success) {
      setSubmitted(true);
    } else {
      // Optionally show an error fallback
      alert("Something went wrong while saving.");
    }
  };

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Finalize</h3>

      {!submitted ? (
        <div className="flex flex-col items-center gap-4">
          {loading ? (
            <ProgressSpinner style={{ width: '40px', height: '40px' }} strokeWidth="4" />
          ) : (
            <Button
              label="Save Expectations"
              className="btn btn-primary"
              onClick={handleSave}
            />
          )}
        </div>
      ) : (
        <div className="text-center text-sm text-green-500">
          🎉 Expectations saved! Triggering backend...
          {/* Optional: add countdown, animation or redirect */}
        </div>
      )}

      <p className="text-center text-sm text-gray-500 dark:text-gray-400 italic mt-4">
        🚧 Under construction — more features coming soon
      </p>

      <div className="text-center text-xs text-gray-400 dark:text-gray-500 space-y-1 mt-2">
        <p>@ Project Managers don't panic.</p>
        <p>Some NFTs might already be floating in the air...</p>
        <p>
          <a
            href="https://sepolia.etherscan.io/address/0x5D16763f15d63CB10aAC9B51F3268256D2BbB2A0"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Xxp NFTs
          </a>
        </p>
      </div>
    </div>
  );
};

export default StepFinalize;
