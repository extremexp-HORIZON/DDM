export const ensure0x = (hex) =>
  hex?.startsWith("0x") ? hex : (hex ? `0x${hex}` : hex);

export const toBytes32 = (hex) => {
  const h = ensure0x(hex);
  if (!h || h.length !== 66) throw new Error("suiteHash must be 32-byte hex");
  return h;
};
