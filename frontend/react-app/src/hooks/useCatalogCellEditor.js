import { FILES_API } from "../api/files";
import { showMessage } from "../utils/messages";

export const useCatalogCellEditor = (toast, datasets, setDatasets) => {
  const onCellEditComplete = async ({ rowData, newValue, field }) => {
    if (rowData[field] === newValue) {
      showMessage(toast, "info", `No changes made to ${field}.`);
      return;
    }

    const updated = [...datasets];
    const idx = updated.findIndex((d) => d.id === rowData.id);
    if (idx !== -1) {
      updated[idx][field] = newValue;
      setDatasets(updated);
    }

    try {
      const updatedData = await FILES_API.updateFileField(rowData.id, field, newValue);
      showMessage(toast, "success", `Updated ${field}: ${JSON.stringify(updatedData[field])}`);
    } catch (err) {
      showMessage(toast, "error", err.message);
    }
  };

  return { onCellEditComplete };
};
