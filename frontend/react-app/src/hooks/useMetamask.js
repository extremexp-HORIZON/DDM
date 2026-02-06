import { useEffect, useState } from "react";
import Web3 from "web3";

const SEPOLIA_CHAIN_ID = "0xaa36a7"; // 11155111 in hex

export const useMetamask = () => {
  const [isAvailable, setIsAvailable] = useState(false);
  const [wallet, setWallet] = useState(null);
  const [balance, setBalance] = useState(null);
  const [error, setError] = useState(null);


  const [web3, setWeb3] = useState(null);

  useEffect(() => {
    if (typeof window !== "undefined" && window.ethereum) {
      setIsAvailable(true);
      // ✅ initialize early if you want
      setWeb3(new Web3(window.ethereum));
    }
  }, []);

  const fetchBalance = async (address) => {
    try {
      const rawBalance = await window.ethereum.request({
        method: "eth_getBalance",
        params: [address, "latest"],
      });

      const eth = parseFloat(parseInt(rawBalance, 16) / 1e18).toFixed(4);
      setBalance(eth);
    } catch (err) {
      setBalance(null);
      console.error("Failed to fetch balance:", err);
    }
  };


  const ensureSepolia = async () => {
    const chainId = await window.ethereum.request({ method: "eth_chainId" });
    if (chainId?.toLowerCase() !== SEPOLIA_CHAIN_ID) {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SEPOLIA_CHAIN_ID }],
      });
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

      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      const address = accounts[0];
      setWallet(address);


      if (!web3) setWeb3(new Web3(window.ethereum));

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
    // optional:
    // setWeb3(null);
  };

  return {
    isAvailable,
    wallet,
    balance,
    web3,         
    ensureSepolia, 
    connect,
    disconnect,
    error,
  };
};
