import QRCode from "qrcode";

/** Generates a QR code PNG buffer encoding the raw child id string. */
export async function generateQrPng(childId: string): Promise<Buffer> {
  return QRCode.toBuffer(childId, {
    type: "png",
    width: 500,
    margin: 2,
    errorCorrectionLevel: "M",
  });
}

/** Filesystem/URL-safe filename for a child's QR download. */
export function qrFileName(childName: string, childId: string) {
  const safe = childName.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "") || "child";
  return `${safe}_${childId.slice(0, 8)}.png`;
}
