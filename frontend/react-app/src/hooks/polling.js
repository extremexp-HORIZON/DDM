// hooks/polling.js
import { pollTaskResult } from "../api/tasks";
import { showMessage } from "../utils/messages";

const POLL_INTERVAL = 2000;
const MAX_POLL_DURATION = 120000;

export const pollFetchTask = async (taskId, fileRef, processTaskId, setFiles, toast) => {
  try {
    await pollTaskResult(taskId, POLL_INTERVAL, MAX_POLL_DURATION);

    setFiles((prev) =>
      prev.map((file) =>
        file.id === fileRef
          ? {
              ...file,
              statuses: [
                ...file.statuses.filter((s) => s.step !== "Downloading"),
                { step: "Downloading", status: "✅ Downloaded" },
              ],
            }
          : file
      )
    );

    if (processTaskId) {
      pollMetadataTask(processTaskId, fileRef, setFiles, toast);
    }
  } catch (err) {
    showMessage(toast, "error", `Fetch failed: ${err.message}`);
    setFiles((prev) =>
      prev.map((file) =>
        file.id === fileRef
          ? {
              ...file,
              statuses: [
                ...file.statuses.filter((s) => s.step !== "Downloading"),
                { step: "Downloading", status: "❌ Download Failed" },
              ],
            }
          : file
      )
    );
  }
};

export const pollMetadataTask = async (taskId, fileRef, setFiles, toast) => {
  try {
    const result = await pollTaskResult(taskId, POLL_INTERVAL, MAX_POLL_DURATION);
    if (!result.profile_html) throw new Error("Missing profile_html");

    setFiles((prev) =>
      prev.map((file) =>
        file.id === fileRef
          ? {
              ...file,
              profileHtml: result.profile_html,
              statuses: [
                ...file.statuses.filter(
                  (s) => 
                    s.step !== "Report" && 
                    s.step !== "Processing Metadata" &&
                    s.status !== "⏳ Waiting for report"   
                ),
                { step: "Report", status: "✅ Report Ready" },
              ],
            }
          : file
      )
    );
  } catch (err) {
    showMessage(toast, "error", `Metadata fetch failed: ${err.message}`);
    setFiles((prev) =>
      prev.map((file) =>
        file.id === fileRef
          ? {
              ...file,
              statuses: [
                ...file.statuses.filter(
                  (s) =>
                    s.step !== "Report" &&
                    s.step !== "Processing Metadata"                
                ),
                { step: "Report", status: "❌ Report Failed" },
              ],
            }
          : file
      )
    );
  }
};


export const pollMergeTask = async (mergeTaskId, index, fileName, setFiles, toast) => {
  try {
    const result = await pollTaskResult(mergeTaskId, 2000, 120000);
    console.log("✅ Merge result:", result);
    setFiles(prevFiles => {
      const updatedFiles = prevFiles.map((fileObj, idx) =>
        idx === index
          ? {
              ...fileObj,
              statuses: fileObj.statuses.map(status =>
                status.step === "Merging"
                  ? { ...status, status: "✅ Merge Complete!" }
                  : status
              ),
              merged: true,
              progress: 100,
            }
          : fileObj
      );

      const metadataTaskId = updatedFiles[index]?.metadataTaskId;
      if (metadataTaskId) {
        setTimeout(() =>
          pollMetadataTask(metadataTaskId, updatedFiles[index].id, setFiles, toast),
          1000
        );
      }

      showMessage(toast, "success", `File ${fileName} merged successfully!`);
      return updatedFiles;
    });
  } catch (error) {
    console.error(`❌ Merge task polling failed for ${fileName}:`, error);
    setFiles(prevFiles =>
      prevFiles.map((fileObj, idx) =>
        idx === index
          ? {
              ...fileObj,
              statuses: fileObj.statuses.map(status =>
                status.step === "Merging"
                  ? { ...status, status: "❌ Merge Timed Out!" }
                  : status
              ),
            }
          : fileObj
      )
    );
    showMessage(toast, "error", `Merge task failed or timed out for ${fileName}. Try again.`);
  }
};