export const ensureWallet = async (wallet, connect) => {
  if (wallet) return wallet;
  return await connect();
};

export const mkWriteContract = (web3, row) => {
  if (!web3 || !row?.abi || !row?.address) return null;
  return new web3.eth.Contract(row.abi, row.address);
};

export const extractRevertReason = (err) => {
  const raw =
    err?.data?.message ||
    err?.data?.originalError?.message ||
    err?.error?.message ||
    err?.message ||
    "";

  if (!raw) return "Smart contract call reverted";

  return (
    raw
      .replace("Internal JSON-RPC error.", "")
      .replace("execution reverted:", "")
      .replace("execution reverted", "")
      .trim() || "Smart contract call reverted"
  );
};
