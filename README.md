# S3 File Upload & Viewer

A modern web application built with Bun for uploading images and videos to AWS S3 through a server intermediary.

## Features

- 📤 **Drag & Drop Upload**: Easy file upload with drag-and-drop interface
- 🖥️ **Server-Side Upload**: Files are uploaded to the server first, then to S3
- 👀 **File Preview**: View uploaded images and videos with presigned URLs
- 📋 **Recent Uploads**: Track and manage recent uploads
- 📱 **Responsive Design**: Works on desktop and mobile devices
- ⚡ **Fast & Modern**: Built with Bun for optimal performance
- 🎥 **Video Support**: Upload and preview video files (MP4, WebM, OGG, MOV, AVI, MKV)

## Prerequisites

- [Bun](https://bun.sh/) installed on your system
- AWS S3 bucket with appropriate permissions
- AWS credentials configured

## Setup

1. **Clone or create the project**:
   ```bash
   # If starting fresh
   mkdir upload-s3 && cd upload-s3
   ```

2. **Install dependencies**:
   ```bash
   bun install
   ```

3. **Configure environment variables**:
   Create a `.env` file in the root directory:
   ```env
   AWS_ACCESS_KEY_ID=your_access_key_here
   AWS_SECRET_ACCESS_KEY=your_secret_key_here
   AWS_REGION=us-east-1
   S3_BUCKET_NAME=your-bucket-name
   ```

4. **Configure S3 bucket permissions**:
   Your S3 bucket needs the following bucket policy (adjust as needed):
   ```json
   {
       "Version": "2012-10-17",
       "Statement": [
           {
               "Sid": "PublicReadGetObject",
               "Effect": "Allow",
               "Principal": "*",
               "Action": "s3:GetObject",
               "Resource": "arn:aws:s3:::your-bucket-name/*"
           }
       ]
   }
   ```

## Usage

1. **Start the development server**:
   ```bash
   bun run dev
   ```

2. **Open your browser** and navigate to `http://localhost:3000`

3. **Upload files**:
   - Drag and drop an image or video onto the upload area
   - Or click "Choose File" to browse for a file
   - The file will be uploaded to the server first, then the server uploads it to S3

4. **View files**:
   - Enter the filename in the "View File" section
   - Click "Generate View URL" to create a presigned URL
   - The file will be displayed in the preview area (images show as images, videos show as video players)

## API Endpoints

### POST `/api/upload`
Upload a file to the server, which then uploads it to S3.

**Request**: FormData with a file field named "file"

**Response**:
```json
{
  "success": true,
  "fileName": "image_1234567890.jpg",
  "fileSize": "1.2 MB"
}
```

### POST `/api/view-url`
Generate a presigned URL for viewing a file from S3.

**Request Body**:
```json
{
  "fileName": "image.jpg"
}
```

**Response**:
```json
{
  "viewUrl": "https://...",
  "fileName": "image.jpg"
}
```

## Project Structure

```
upload-s3/
├── server.ts          # Main server file with S3 integration
├── package.json       # Dependencies and scripts
├── README.md         # This file
├── .env              # Environment variables (create this)
└── client/           # Frontend files
    ├── index.html    # Main HTML file
    ├── style.css     # Styles and responsive design
    └── script.js     # Frontend JavaScript logic
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AWS_ACCESS_KEY_ID` | AWS access key | Required |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key | Required |
| `AWS_REGION` | AWS region | `us-east-1` |
| `S3_BUCKET_NAME` | S3 bucket name | `your-bucket-name` |

## Security Considerations

- **Server-Side Upload**: Files are uploaded to the server first, providing better control and validation
- **AWS Credentials**: AWS credentials are only stored on the server and never exposed to the client
- **File Validation**: Server validates file types before uploading to S3
- **Presigned URLs**: View URLs still use presigned URLs for secure access
- **Bucket Policy**: Set appropriate bucket policies for your use case
- **Environment Variables**: Never commit `.env` files to version control

## Development

- **Hot Reload**: The server automatically restarts when files change
- **TypeScript**: Full TypeScript support with Bun
- **Error Handling**: Comprehensive error handling on both frontend and backend

## Production Deployment

1. **Build the project**:
   ```bash
   bun run build
   ```

2. **Set environment variables** on your production server

3. **Start the server**:
   ```bash
   bun run start
   ```

## Troubleshooting

### Common Issues

1. **Upload fails**: Check your AWS credentials and bucket permissions
2. **Permission denied**: Verify your S3 bucket has the correct permissions
3. **File type errors**: Only image and video files are allowed
4. **Server errors**: Check the server logs for detailed error messages

### Debug Mode

Run with debug logging:
```bash
DEBUG=* bun run dev
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - feel free to use this project for your own needs! 