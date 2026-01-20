import { useEffect, useState } from "react";

const SEPOLIA_CHAIN_ID = "0xaa36a7"; // 11155111 in hex

export const useMetamask = () => {
  const [isAvailable, setIsAvailable] = useState(false);
  const [wallet, setWallet] = useState(null);
  const [balance, setBalance] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (typeof window !== "undefined" && window.ethereum) {
      setIsAvailable(true);
    }
  }, []);

  const fetchBalance = async (address) => {
    try {
      const rawBalance = await window.ethereum.request({
        method: "eth_getBalance",
        params: [address, "latest"]
      });

      const eth = parseFloat(parseInt(rawBalance, 16) / 1e18).toFixed(4);
      setBalance(eth);
    } catch (err) {
      setBalance(null);
      console.error("Failed to fetch balance:", err);
    }
  };

  const connect = async () => {
    setError(null);

    if (!window.ethereum) {
      setError("MetaMask is not installed.");
      return;
    }

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA_CHAIN_ID }]
      });

      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts"
      });

      const address = accounts[0];
      setWallet(address);
      await fetchBalance(address);
      return address;
    } catch (err) {
      if (err.code === 4902) {
        setError("Sepolia network not found. Please add it manually.");
      } else {
        setError(err.message || "An error occurred while connecting.");
      }
    }
  };

  const disconnect = () => {
    setWallet(null);
    setBalance(null);
  };

  return {
    isAvailable,
    wallet,
    balance,
    connect,
    disconnect,
    error
  };
};
