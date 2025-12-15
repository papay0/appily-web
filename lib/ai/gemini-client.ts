/**
 * Gemini AI Client for Image Generation
 *
 * Uses Google's Gemini 3 Pro Image Preview model (Nano Banana Pro) via Vertex AI.
 * Supports both text-to-image generation and image editing.
 *
 * Configuration: Uses GOOGLE_APPLICATION_CREDENTIALS_JSON, GOOGLE_CLOUD_PROJECT,
 * and GOOGLE_CLOUD_LOCATION from environment variables.
 */

import { GoogleGenAI } from "@google/genai";

/** Supported aspect ratios for image generation */
export type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4" | "3:2" | "2:3";

/** Supported image resolutions */
export type ImageResolution = "1K" | "2K";

/** Options for image generation */
export interface ImageGenerationOptions {
  /** Aspect ratio of the generated image (default: "1:1") */
  aspectRatio?: AspectRatio;
  /** Resolution of the generated image (default: "1K") */
  resolution?: ImageResolution;
}

/** Result from image generation */
export interface ImageGenerationResult {
  /** Base64-encoded image data (without data: prefix) */
  imageBase64: string;
  /** MIME type of the image */
  mimeType: string;
  /** Optional text response from the model */
  text?: string;
}

/** Gemini client singleton */
let geminiClient: GoogleGenAI | null = null;

/**
 * Get or create the Gemini client
 * Uses Vertex AI credentials from environment variables
 */
function getGeminiClient(): GoogleGenAI {
  if (geminiClient) {
    return geminiClient;
  }

  const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  const projectId = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION || "global";

  if (!credentialsJson || !projectId) {
    throw new Error(
      "Missing Vertex AI credentials. Set GOOGLE_APPLICATION_CREDENTIALS_JSON and GOOGLE_CLOUD_PROJECT."
    );
  }

  // Parse service account credentials
  let credentials: {
    client_email: string;
    private_key: string;
  };

  try {
    credentials = JSON.parse(credentialsJson);
  } catch (error) {
    throw new Error("Invalid GOOGLE_APPLICATION_CREDENTIALS_JSON format");
  }

  // Initialize client with Vertex AI configuration
  geminiClient = new GoogleGenAI({
    vertexai: true,
    project: projectId,
    location: location,
    googleAuthOptions: {
      credentials: {
        client_email: credentials.client_email,
        private_key: credentials.private_key,
      },
    },
  });

  return geminiClient;
}

/**
 * Generate an image from a text prompt
 *
 * @param prompt - Text description of the image to generate
 * @param options - Generation options (aspect ratio, resolution)
 * @returns Generated image as base64
 */
export async function generateImageFromPrompt(
  prompt: string,
  options: ImageGenerationOptions = {}
): Promise<ImageGenerationResult> {
  const client = getGeminiClient();
  const { aspectRatio = "1:1", resolution = "1K" } = options;

  const response = await client.models.generateContent({
    model: "gemini-3-pro-image-preview",
    contents: prompt,
    config: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        aspectRatio: aspectRatio,
        imageSize: resolution,
      },
    },
  });

  return extractImageFromResponse(response);
}

/**
 * Edit an existing image using a text prompt
 *
 * @param imageBase64 - Base64-encoded source image (with or without data: prefix)
 * @param prompt - Text description of the edits to make
 * @param options - Generation options (aspect ratio, resolution)
 * @returns Edited image as base64
 */
export async function editImageWithPrompt(
  imageBase64: string,
  prompt: string,
  options: ImageGenerationOptions = {}
): Promise<ImageGenerationResult> {
  const client = getGeminiClient();
  const { aspectRatio = "1:1", resolution = "1K" } = options;

  // Remove data: prefix if present
  const cleanBase64 = imageBase64.includes(",")
    ? imageBase64.split(",")[1]
    : imageBase64;

  // Detect MIME type from data URL or default to JPEG
  let mimeType = "image/jpeg";
  if (imageBase64.startsWith("data:")) {
    const match = imageBase64.match(/^data:([^;]+);/);
    if (match) {
      mimeType = match[1];
    }
  }

  const response = await client.models.generateContent({
    model: "gemini-3-pro-image-preview",
    contents: [
      { text: prompt },
      {
        inlineData: {
          mimeType: mimeType,
          data: cleanBase64,
        },
      },
    ],
    config: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        aspectRatio: aspectRatio,
        imageSize: resolution,
      },
    },
  });

  return extractImageFromResponse(response);
}

/**
 * Extract image data from Gemini response
 */
function extractImageFromResponse(response: unknown): ImageGenerationResult {
  // Type the response structure
  const typedResponse = response as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
          inlineData?: {
            data: string;
            mimeType: string;
          };
        }>;
      };
    }>;
  };

  const parts = typedResponse.candidates?.[0]?.content?.parts;

  if (!parts || parts.length === 0) {
    throw new Error("No content in Gemini response");
  }

  let imageBase64: string | null = null;
  let mimeType: string = "image/png";
  let text: string | undefined;

  for (const part of parts) {
    if (part.text) {
      text = part.text;
    } else if (part.inlineData) {
      imageBase64 = part.inlineData.data;
      mimeType = part.inlineData.mimeType || "image/png";
    }
  }

  if (!imageBase64) {
    throw new Error("No image generated in response");
  }

  return {
    imageBase64,
    mimeType,
    text,
  };
}
