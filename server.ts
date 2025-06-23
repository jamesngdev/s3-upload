import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { serve } from "bun";

// S3 Configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || "your-bucket-name";

// Types
interface UploadResponse {
  success: boolean;
  fileName: string;
  fileSize: string;
  s3Key: string; // Full S3 key including temp folder
  message?: string;
}

interface ViewRequest {
  fileName: string;
}

interface ViewResponse {
  viewUrl: string;
  fileName: string;
}

// Upload file to S3
async function uploadToS3(fileName: string, fileBuffer: Buffer, contentType: string, s3Config: { accessKeyId: string, secretAccessKey: string, region: string, bucket: string, tempFolder: string }): Promise<{ success: boolean, s3Key: string }> {
  try {
    // Upload to temp folder in S3
    const tempFileName = `${s3Config.tempFolder}/${fileName}`;
    const s3Client = new S3Client({
      region: s3Config.region,
      credentials: {
        accessKeyId: s3Config.accessKeyId,
        secretAccessKey: s3Config.secretAccessKey,
      },
    });
    const command = new PutObjectCommand({
      Bucket: s3Config.bucket,
      Key: tempFileName,
      Body: fileBuffer,
      ContentType: contentType,
    });
    await s3Client.send(command);
    return { success: true, s3Key: tempFileName };
  } catch (error) {
    console.error("S3 upload error:", error);
    return { success: false, s3Key: '' };
  }
}

// Generate presigned URL for viewing
async function generateViewUrl(fileName: string, s3Config: { accessKeyId: string, secretAccessKey: string, region: string, bucket: string, tempFolder: string }): Promise<string> {
  // Check if the file is in temp folder, if not, assume it's in temp
  const key = fileName.startsWith(s3Config.tempFolder + '/') ? fileName : `${s3Config.tempFolder}/${fileName}`;
  const s3Client = new S3Client({
    region: s3Config.region,
    credentials: {
      accessKeyId: s3Config.accessKeyId,
      secretAccessKey: s3Config.secretAccessKey,
    },
  });
  const command = new GetObjectCommand({
    Bucket: s3Config.bucket,
    Key: key,
  });
  return await getSignedUrl(s3Client, command, { expiresIn: 3600 }); // 1 hour
}

// Format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Server
const server = serve({
  port: 3001,
  fetch: async (req) => {
    const url = new URL(req.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Serve static files
      if (path === "/" || path === "/index.html") {
        const file = Bun.file("./client/index.html");
        return new Response(file, {
          headers: { ...corsHeaders, "Content-Type": "text/html" },
        });
      }

      if (path === "/style.css") {
        const file = Bun.file("./client/style.css");
        return new Response(file, {
          headers: { ...corsHeaders, "Content-Type": "text/css" },
        });
      }

      if (path === "/script.js") {
        const file = Bun.file("./client/script.js");
        return new Response(file, {
          headers: { ...corsHeaders, "Content-Type": "application/javascript" },
        });
      }

      // API endpoints
      if (path === "/api/upload" && req.method === "POST") {
        try {
          const formData = await req.formData();
          const file = formData.get("file") as File;
          
          if (!file) {
            return new Response(JSON.stringify({ 
              success: false, 
              message: "No file provided" 
            }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          // Validate file type - support both images and videos
          if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
            return new Response(JSON.stringify({ 
              success: false, 
              message: "Only image and video files are allowed" 
            }), {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          // Generate unique filename
          const timestamp = Date.now();
          const extension = file.name.split('.').pop();
          const fileType = file.type.startsWith('image/') ? 'image' : 'video';
          const fileName = `${fileType}_${timestamp}.${extension}`;

          // Convert file to buffer
          const fileBuffer = Buffer.from(await file.arrayBuffer());

          // Get config from formData or env
          const awsAccessKeyId = formData.get('awsAccessKeyId')?.toString() || process.env.AWS_ACCESS_KEY_ID || '';
          const awsSecretAccessKey = formData.get('awsSecretAccessKey')?.toString() || process.env.AWS_SECRET_ACCESS_KEY || '';
          const awsRegion = formData.get('awsRegion')?.toString() || process.env.AWS_REGION || 'us-east-1';
          const s3BucketName = formData.get('s3BucketName')?.toString() || process.env.S3_BUCKET_NAME || 'your-bucket-name';
          const tempFolder = formData.get('tempFolder')?.toString() || 'temp';

          // Upload to S3
          const uploadResult = await uploadToS3(fileName, fileBuffer, file.type, {
            accessKeyId: awsAccessKeyId,
            secretAccessKey: awsSecretAccessKey,
            region: awsRegion,
            bucket: s3BucketName,
            tempFolder: tempFolder,
          });

          if (uploadResult.success) {
            const response: UploadResponse = {
              success: true,
              fileName: fileName,
              fileSize: formatFileSize(file.size),
              s3Key: uploadResult.s3Key,
            };

            return new Response(JSON.stringify(response), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          } else {
            return new Response(JSON.stringify({ 
              success: false, 
              message: "Failed to upload to S3" 
            }), {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

        } catch (error) {
          console.error("Upload error:", error);
          return new Response(JSON.stringify({ 
            success: false, 
            message: "Upload processing failed" 
          }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      if (path === "/api/view-url" && req.method === "POST") {
        const body = await req.json();
        const awsAccessKeyId = body.awsAccessKeyId || process.env.AWS_ACCESS_KEY_ID || '';
        const awsSecretAccessKey = body.awsSecretAccessKey || process.env.AWS_SECRET_ACCESS_KEY || '';
        const awsRegion = body.awsRegion || process.env.AWS_REGION || 'us-east-1';
        const s3BucketName = body.s3BucketName || process.env.S3_BUCKET_NAME || 'your-bucket-name';
        const tempFolder = body.tempFolder || 'temp';
        const viewUrl = await generateViewUrl(body.fileName, {
          accessKeyId: awsAccessKeyId,
          secretAccessKey: awsSecretAccessKey,
          region: awsRegion,
          bucket: s3BucketName,
          tempFolder: tempFolder,
        });
        const response: ViewResponse = {
          viewUrl,
          fileName: body.fileName,
        };
        return new Response(JSON.stringify(response), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 404 for unknown routes
      return new Response("Not Found", { 
        status: 404,
        headers: corsHeaders,
      });

    } catch (error) {
      console.error("Server error:", error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  },
});

console.log(`🚀 Server running at http://localhost:${server.port}`);
console.log("�� Upload your images and videos to server, then server uploads to S3!");
console.log("👀 View your files with presigned URLs!"); 
