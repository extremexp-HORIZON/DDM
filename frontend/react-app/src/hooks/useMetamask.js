// src/hooks/useMetamask.js
import { useEffect, useState } from "react";
import Web3 from "web3";

const SEPOLIA_CHAIN_ID_HEX = "0xaa36a7"; // 11155111

export const useMetamask = () => {
  const [isAvailable, setIsAvailable] = useState(false);
  const [wallet, setWallet] = useState(null);
  const [balance, setBalance] = useState(null);
  const [web3, setWeb3] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (typeof window !== "undefined" && window.ethereum) {
      setIsAvailable(true);
      setWeb3(new Web3(window.ethereum));
    }
  }, []);

  const ensureSepolia = async () => {
    if (!window.ethereum) throw new Error("No wallet");
    const chainId = await window.ethereum.request({ method: "eth_chainId" });
    if (chainId !== SEPOLIA_CHAIN_ID_HEX) {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA_CHAIN_ID_HEX }],
      });
    }
  };

  const requestAccounts = async () => {
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    return accounts;
  };

  const fetchBalance = async (address) => {
    try {
      const raw = await window.ethereum.request({
        method: "eth_getBalance",
        params: [address, "latest"],
      });
      const eth = parseFloat(parseInt(raw, 16) / 1e18).toFixed(4);
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
      await ensureSepolia();
      const accounts = await requestAccounts();
      const address = accounts[0];
      setWallet(address);
      await fetchBalance(address);
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
    web3,            
    ensureSepolia,   
    requestAccounts, 
    connect,
    disconnect,
    error,
  };
};
