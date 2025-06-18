import { VALIDATIONS_API } from "../api/validations";
import { useToast } from "../context/ToastContext";
import { showMessage } from "../utils/messages";

export const useValidations = () => {
  const toast = useToast();

  const validateFileAgainstSuites = async (fileId, suiteIds) => {
    try {
      const payload = {
        file_id: fileId,
        suite_ids: Array.isArray(suiteIds) ? suiteIds : [suiteIds],
      };
      await VALIDATIONS_API.validateFileAgainstSuites(payload);
      showMessage(toast, "success", "Validation started.");
    } catch (error) {
      console.error(error);
      showMessage(toast, "error", error.message || "Failed to start validation.");
    }
  };

  return {
    validateFileAgainstSuites,
  };
};
