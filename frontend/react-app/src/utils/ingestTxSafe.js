import { pollTaskResult } from "../api/tasks";
import { BLOCKCHAIN_API } from "../api/blockchain";

export const ingestTxSafe = async ({
  network,
  toastRef,
  contract,
  txHash,
  actionLabel,
  onIndexed,
}) => {
  if (!contract?.address || !txHash) return;

  try {
    const { data } = await BLOCKCHAIN_API.ingestTx({
      network,
      address: contract.address,
      tx_hash: txHash,
    });

    if (data?.task_id) {
      try {
        await pollTaskResult(data.task_id, 2000, 120000);
      } catch (pollErr) {
        const msg =
          pollErr?.response?.data?.error ||
          pollErr?.response?.data?.message ||
          pollErr?.message ||
          String(pollErr);

        toastRef.current?.show({
          severity: "warn",
          summary: `${actionLabel} – ingest polling warning`,
          detail: msg,
        });
      }
    }

    if (typeof onIndexed === "function") await onIndexed();
  } catch (e) {
    const msg =
      e?.response?.data?.error ||
      e?.response?.data?.message ||
      e?.message ||
      String(e);

    toastRef.current?.show({
      severity: "warn",
      summary: `${actionLabel} – ingest warning`,
      detail: msg,
    });

    if (typeof onIndexed === "function") await onIndexed();
  }
};
