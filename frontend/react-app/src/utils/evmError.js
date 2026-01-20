// src/utils/evmErrors.js

// --- small helpers ---
const strip0x = (s) => (typeof s === "string" && s.startsWith("0x") ? s.slice(2) : s || "");
const add0x = (s) => (s && !s.startsWith("0x") ? "0x" + s : s || "");

// Providers wrap errors in many shapes; try to pull the deepest hex blob.
const extractHexPayload = (errLike) => {
  if (!errLike) return "";
  // common nests first
  const candidates = [
    errLike?.data?.originalError?.data,
    errLike?.data?.data,
    errLike?.data,
    errLike?.cause?.data,
    errLike?.cause,
    errLike?.message,
    errLike?.stack,
    errLike, // last
  ];

  for (const c of candidates) {
    if (typeof c === "string") {
      // direct hex or "execution reverted: ..." (no hex)
      const s = c.trim();
      if (s.startsWith("0x")) return strip0x(s);
    } else if (c && typeof c === "object") {
      // recurse a little
      const inner = extractHexPayload(c);
      if (inner) return inner;
    }
  }
  return "";
};

// Decode Error(string) and Panic(uint256)
const tryDecodeRevert = (rawHexNoPrefix, web3) => {
  if (!rawHexNoPrefix || typeof rawHexNoPrefix !== "string") return null;

  // Error(string) selector 0x08c379a0
  if (rawHexNoPrefix.startsWith("08c379a0")) {
    // layout: selector(4) + offset(32) + len(32) + data
    const afterSelector = rawHexNoPrefix.slice(8);
    const afterOffset   = afterSelector.slice(64);  // skip offset
    const lenHex        = add0x(afterOffset.slice(0, 64));
    const len           = parseInt(lenHex, 16) || 0;
    const dataHex       = add0x(afterOffset.slice(64, 64 + len * 2));
    try {
      return web3.eth.abi.decodeParameter("string", dataHex);
    } catch {
      // Some nodes pack as a full ABI blob; fallback to blind decode
      try {
        return web3.eth.abi.decodeParameter("string", add0x(afterOffset.slice(64)));
      } catch {
        return "execution reverted";
      }
    }
  }

  // Panic(uint256) selector 0x4e487b71
  if (rawHexNoPrefix.startsWith("4e487b71")) {
    // layout: selector(4) + (ABI encoded uint256)
    // There can be ABI headroom; take the last 32 bytes as code
    const codeHex = add0x(rawHexNoPrefix.slice(-64));
    const code    = parseInt(codeHex, 16);
    return `Panic(${code})`;
  }

  return null;
};

// Trim "Internal JSON-RPC error." prefix if present
const cleanProviderMessage = (msg) => {
  if (!msg || typeof msg !== "string") return msg;
  return msg.replace(/^Internal JSON-RPC error\.\s*/i, "").trim();
};

export const decodeRevertReason = (rawLike, web3) => {
  try {
    const hexNoPrefix = extractHexPayload(rawLike);
    if (!hexNoPrefix) return null;

    const reason = tryDecodeRevert(hexNoPrefix, web3);
    if (reason) return reason;

    // Some providers send plain "execution reverted: <reason>" strings;
    // attempt to salvage from the higher-level message if available.
    if (typeof rawLike?.message === "string") {
      const m = rawLike.message;
      const idx = m.toLowerCase().indexOf("execution reverted:");
      if (idx >= 0) return m.slice(idx + "execution reverted:".length).trim();
    }
    if (typeof rawLike?.data?.message === "string") {
        const m = rawLike.data.message;
        const idx = m.toLowerCase().indexOf("execution reverted:");
    if (idx >= 0) return m.slice(idx + "execution reverted:".length).trim();
    }
    return null;
  } catch {
    return null;
  }
};

export const prettyProviderError = (err, web3) => {
  // Best-effort reason
  const reason =
    decodeRevertReason(err, web3) ||
    err?.data?.message ||
    cleanProviderMessage(err?.message) ||
    null;

  // Safely capture the deepest raw we found (hex or otherwise)
  const raw =
    err?.data?.originalError?.data ??
    err?.data?.data ??
    err?.data ??
    err?.cause?.data ??
    err?.cause ??
    err?.message ??
    err?.stack ??
    null;

  // Safe BigInt stringify for logging
  const safe = (x) =>
    JSON.parse(JSON.stringify(x, (_, v) => (typeof v === "bigint" ? v.toString() : v)));

  return {
    code: err?.code,
    message: cleanProviderMessage(err?.message),
    reason,
    raw: safe(raw),
  };
};
