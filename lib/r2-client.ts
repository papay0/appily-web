import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Lazy initialization to allow env vars to load first
let r2ClientInstance: S3Client | null = null;

function getR2Client(): S3Client {
  if (!r2ClientInstance) {
    if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
      throw new Error("R2 credentials are not configured. Please check your environment variables.");
    }

    r2ClientInstance = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return r2ClientInstance;
}

function getBucketName(): string {
  if (!process.env.R2_BUCKET_NAME) {
    throw new Error("R2_BUCKET_NAME is not configured");
  }
  return process.env.R2_BUCKET_NAME;
}

export interface UploadFileOptions {
  key: string;
  body: Buffer | string;
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface FileMetadata {
  key: string;
  size: number;
  lastModified: Date;
  contentType?: string;
}

/**
 * Upload a file to R2
 */
export async function uploadFile({
  key,
  body,
  contentType,
  metadata,
}: UploadFileOptions): Promise<void> {
  try {
    const command = new PutObjectCommand({
      Bucket: getBucketName(),
      Key: key,
      Body: body,
      ContentType: contentType,
      Metadata: metadata,
    });

    await getR2Client().send(command);
  } catch (error) {
    console.error("Error uploading file to R2:", error);
    throw new Error(`Failed to upload file: ${key}`);
  }
}

/**
 * Download a file from R2
 */
export async function downloadFile(key: string): Promise<Buffer> {
  try {
    const command = new GetObjectCommand({
      Bucket: getBucketName(),
      Key: key,
    });

    const response = await getR2Client().send(command);

    if (!response.Body) {
      throw new Error("No file body returned");
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  } catch (error) {
    console.error("Error downloading file from R2:", error);
    throw new Error(`Failed to download file: ${key}`);
  }
}

/**
 * Delete a file from R2
 */
export async function deleteFile(key: string): Promise<void> {
  try {
    const command = new DeleteObjectCommand({
      Bucket: getBucketName(),
      Key: key,
    });

    await getR2Client().send(command);
  } catch (error) {
    console.error("Error deleting file from R2:", error);
    throw new Error(`Failed to delete file: ${key}`);
  }
}

/**
 * List files in a directory (prefix)
 */
export async function listFiles(prefix: string): Promise<FileMetadata[]> {
  try {
    const command = new ListObjectsV2Command({
      Bucket: getBucketName(),
      Prefix: prefix,
    });

    const response = await getR2Client().send(command);

    return (
      response.Contents?.map((item) => ({
        key: item.Key!,
        size: item.Size || 0,
        lastModified: item.LastModified || new Date(),
        contentType: undefined, // Not returned in list operation
      })) || []
    );
  } catch (error) {
    console.error("Error listing files from R2:", error);
    throw new Error(`Failed to list files with prefix: ${prefix}`);
  }
}

/**
 * Check if a file exists
 */
export async function fileExists(key: string): Promise<boolean> {
  try {
    const command = new HeadObjectCommand({
      Bucket: getBucketName(),
      Key: key,
    });

    await getR2Client().send(command);
    return true;
  } catch (error: any) {
    if (error.name === "NotFound") {
      return false;
    }
    throw error;
  }
}

/**
 * Get a signed URL for temporary file access (expires in 1 hour)
 */
export async function getFileSignedUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  try {
    const command = new GetObjectCommand({
      Bucket: getBucketName(),
      Key: key,
    });

    const signedUrl = await getSignedUrl(getR2Client(), command, { expiresIn });
    return signedUrl;
  } catch (error) {
    console.error("Error generating signed URL:", error);
    throw new Error(`Failed to generate signed URL for: ${key}`);
  }
}

/**
 * Upload multiple files (batch operation)
 */
export async function uploadFiles(
  files: UploadFileOptions[]
): Promise<void> {
  try {
    await Promise.all(files.map((file) => uploadFile(file)));
  } catch (error) {
    console.error("Error uploading multiple files:", error);
    throw new Error("Failed to upload files batch");
  }
}

/**
 * Delete all files with a specific prefix (e.g., delete entire project)
 */
export async function deleteDirectory(prefix: string): Promise<void> {
  try {
    const files = await listFiles(prefix);
    await Promise.all(files.map((file) => deleteFile(file.key)));
  } catch (error) {
    console.error("Error deleting directory from R2:", error);
    throw new Error(`Failed to delete directory: ${prefix}`);
  }
}

/**
 * Get total size of files in a directory
 */
export async function getDirectorySize(prefix: string): Promise<number> {
  try {
    const files = await listFiles(prefix);
    return files.reduce((total, file) => total + file.size, 0);
  } catch (error) {
    console.error("Error calculating directory size:", error);
    return 0;
  }
}

export { getR2Client as r2Client };
