/* eslint-env es2020 */
/* global BigInt */
import Big from "big.js";

// --- Big helpers -------------------------------------------------------------

export const isBigLike = (v) =>
  typeof v === "string" || (typeof v === "number" && !Number.isSafeInteger(v));

export const isUnsafeBig = (v) =>
  typeof v === "number" && !Number.isSafeInteger(v);

export const ensure0x = (hex) =>
  hex?.startsWith("0x") ? hex : (hex ? `0x${hex}` : hex);

export const toBytes32 = (hex) => {
  const h = ensure0x(hex);
  if (!h || h.length !== 66) throw new Error("suiteHash must be 32-byte hex");
  return h;
};

// Stable stringify for deterministic keccak
export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

// --- Conversions -------------------------------------------------------------

/** best-effort hex/dec -> BigInt */
export const toBigIntCompat = (v) => {
  if (v === null || v === undefined) return 0n;
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(Math.trunc(v));
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return 0n;
    // supports "0x..." and decimal strings
    return BigInt(s);
  }
  if (typeof v === "object") {
    // common shapes from various libs
    if (v.hex) return toBigIntCompat(v.hex);
    if (v._hex) return toBigIntCompat(v._hex);
    if (typeof v.toString === "function") return toBigIntCompat(v.toString());
  }
  return 0n;
};

const weiToEthStr = (weiBigInt, dp = 6) =>
  Big(weiBigInt.toString()).div(Big(10).pow(18)).toFixed(dp);

/**
 * Compute gas fee summary from a web3 v4 tx receipt without precision loss.
 * Accepts gasUsed, effectiveGasPrice / gasPrice as number/string/hex/bigint.
 */
export const summarizeFeeFromReceipt = (receipt) => {
  const gasUsed = toBigIntCompat(receipt?.gasUsed);
  // prefer EIP-1559 effectiveGasPrice; fallback to legacy gasPrice
  const gasPrice =
    toBigIntCompat(receipt?.effectiveGasPrice) || toBigIntCompat(receipt?.gasPrice);

  const feeWei = gasUsed * gasPrice;

  return {
    gasUsed: gasUsed.toString(),
    gasPriceWei: gasPrice.toString(),
    feeWei: feeWei.toString(),
    feeEth: weiToEthStr(feeWei, 6),
  };
};
