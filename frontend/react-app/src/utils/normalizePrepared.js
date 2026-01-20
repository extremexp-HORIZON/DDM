import { ensure0x } from "./big";

// Keep exact normalization semantics
const pick = (obj, k, d = undefined) => (obj && obj[k] !== undefined ? obj[k] : d);
const toStr = (v) => (typeof v === "string" ? v : (typeof v === "number" ? String(v) : v));

export function normalizePrepared(raw) {
  if (!raw) return raw;

  const normalized = {
    ...raw,
    suiteURI: pick(raw, "suiteURI"),
    docsURI: pick(raw, "docsURI"),
    certificateURI: pick(raw, "certificateURI"),
    category: pick(raw, "category", pick(raw?.typedData?.message || {}, "category")),
    fileFormat: pick(raw, "fileFormat", pick(raw?.typedData?.message || {}, "fileFormat")),
    deadline: toStr(pick(raw, "deadline", pick(raw?.typedData?.message || {}, "deadline"))),
    totalExpected: toStr(pick(raw, "totalExpected", pick(raw?.typedData?.message || {}, "totalExpected"))),
    nonce: toStr(pick(raw, "nonce", pick(raw?.typedData?.message || {}, "nonce"))),
    expiresAt: toStr(pick(raw, "expiresAt", pick(raw?.typedData?.message || {}, "expiresAt"))),
    suiteHash: ensure0x(pick(raw, "suiteHash", pick(raw?.typedData?.message || {}, "suiteHash"))),
    signature: ensure0x(raw.signature),
  };

  if (raw.typedData?.message) {
    normalized.typedData = {
      ...raw.typedData,
      message: {
        ...raw.typedData.message,
        deadline: toStr(raw.typedData.message.deadline),
        totalExpected: toStr(raw.typedData.message.totalExpected),
        nonce: toStr(raw.typedData.message.nonce),
        expiresAt: toStr(pick(raw, "expiresAt", raw.typedData.message.expiresAt)),
        suiteHash: ensure0x(raw.typedData.message.suiteHash),
      }
    };
  }
  return normalized;
}
