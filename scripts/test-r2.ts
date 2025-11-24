/**
 * Quick test script to verify R2 connection and file operations
 * Run with: npx tsx scripts/test-r2.ts
 */

import { config } from "dotenv";
import { uploadFile, downloadFile, listFiles, deleteFile, getFileSignedUrl } from "../lib/r2-client";

// Load environment variables from .env.local
config({ path: ".env.local" });

async function testR2() {
  console.log("🧪 Testing Cloudflare R2 Connection...\n");

  // Debug: Check if env vars are loaded
  console.log("🔍 Checking R2 environment variables:");
  console.log(`  - R2_ACCOUNT_ID: ${process.env.R2_ACCOUNT_ID ? "✅ Set" : "❌ Missing"}`);
  console.log(`  - R2_ACCESS_KEY_ID: ${process.env.R2_ACCESS_KEY_ID ? "✅ Set" : "❌ Missing"}`);
  console.log(`  - R2_SECRET_ACCESS_KEY: ${process.env.R2_SECRET_ACCESS_KEY ? "✅ Set" : "❌ Missing"}`);
  console.log(`  - R2_BUCKET_NAME: ${process.env.R2_BUCKET_NAME ? "✅ Set" : "❌ Missing"}\n`);

  try {
    // Test 1: Upload a test file
    console.log("📤 Test 1: Uploading test file...");
    const testKey = "test/hello.txt";
    const testContent = "Hello from Appily! R2 is working! 🎉";

    await uploadFile({
      key: testKey,
      body: Buffer.from(testContent),
      contentType: "text/plain",
      metadata: {
        test: "true",
        timestamp: new Date().toISOString(),
      },
    });
    console.log("✅ Test 1 passed: File uploaded successfully\n");

    // Test 2: Download the file
    console.log("📥 Test 2: Downloading test file...");
    const downloadedContent = await downloadFile(testKey);
    const downloadedText = downloadedContent.toString("utf-8");

    if (downloadedText === testContent) {
      console.log("✅ Test 2 passed: File downloaded and content matches\n");
    } else {
      throw new Error("Downloaded content doesn't match uploaded content");
    }

    // Test 3: List files
    console.log("📋 Test 3: Listing files in 'test/' directory...");
    const files = await listFiles("test/");
    console.log(`Found ${files.length} file(s):`);
    files.forEach((file) => {
      console.log(`  - ${file.key} (${file.size} bytes, modified: ${file.lastModified})`);
    });
    console.log("✅ Test 3 passed: Files listed successfully\n");

    // Test 4: Generate signed URL
    console.log("🔗 Test 4: Generating signed URL...");
    const signedUrl = await getFileSignedUrl(testKey, 300); // 5 minutes
    console.log(`Signed URL (valid for 5 minutes):\n${signedUrl.substring(0, 100)}...`);
    console.log("✅ Test 4 passed: Signed URL generated\n");

    // Test 5: Delete the test file
    console.log("🗑️  Test 5: Deleting test file...");
    await deleteFile(testKey);
    console.log("✅ Test 5 passed: File deleted successfully\n");

    // Verify deletion
    console.log("🔍 Verifying deletion...");
    const filesAfterDelete = await listFiles("test/");
    if (filesAfterDelete.length === 0) {
      console.log("✅ Verification passed: File no longer exists\n");
    } else {
      console.warn("⚠️  Warning: Files still exist after deletion");
    }

    console.log("🎉 All tests passed! R2 is configured correctly!\n");
    console.log("✨ You can now use R2 storage in your application.");

  } catch (error) {
    console.error("\n❌ Test failed:");
    console.error(error);
    console.error("\nPlease check your R2 credentials in .env.local");
    process.exit(1);
  }
}

testR2();
