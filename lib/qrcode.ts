import QRCode from "qrcode";

/**
 * Generates a QR code as a data URL (base64 PNG image)
 * @param text - The text/URL to encode in the QR code
 * @param options - Optional QR code generation options
 * @returns Base64 data URL of the QR code image
 */
export async function generateQRCode(
  text: string,
  options?: {
    width?: number;
    margin?: number;
    color?: {
      dark?: string;
      light?: string;
    };
  }
): Promise<string> {
  try {
    const qrOptions = {
      width: options?.width || 512,
      margin: options?.margin || 2,
      color: {
        dark: options?.color?.dark || "#000000",
        light: options?.color?.light || "#FFFFFF",
      },
      type: "image/png" as const,
    };

    const dataUrl = await QRCode.toDataURL(text, qrOptions);
    return dataUrl;
  } catch (error) {
    throw new Error(
      `Failed to generate QR code: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Generates a QR code as an SVG string
 * @param text - The text/URL to encode in the QR code
 * @param options - Optional QR code generation options
 * @returns SVG string of the QR code
 */
export async function generateQRCodeSVG(
  text: string,
  options?: {
    width?: number;
    margin?: number;
    color?: {
      dark?: string;
      light?: string;
    };
  }
): Promise<string> {
  try {
    const qrOptions = {
      width: options?.width || 512,
      margin: options?.margin || 2,
      color: {
        dark: options?.color?.dark || "#000000",
        light: options?.color?.light || "#FFFFFF",
      },
    };

    const svg = await QRCode.toString(text, { ...qrOptions, type: "svg" });
    return svg;
  } catch (error) {
    throw new Error(
      `Failed to generate QR code SVG: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}
