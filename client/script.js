// Global state
let recentUploads = JSON.parse(localStorage.getItem('recentUploads') || '[]');

// DOM elements
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const uploadProgress = document.getElementById('uploadProgress');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const uploadResult = document.getElementById('uploadResult');
const uploadedFileName = document.getElementById('uploadedFileName');
const uploadedFileSize = document.getElementById('uploadedFileSize');
const uploadedS3Key = document.getElementById('uploadedS3Key');
const fileNameInput = document.getElementById('fileNameInput');
const viewResult = document.getElementById('viewResult');
const viewUrl = document.getElementById('viewUrl');
const previewImage = document.getElementById('previewImage');
const previewVideo = document.getElementById('previewVideo');
const recentList = document.getElementById('recentList');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    updateRecentUploads();

    // Listen for temp folder config changes
    const tempFolderInput = document.getElementById('tempFolderInput');
    if (tempFolderInput) {
        tempFolderInput.addEventListener('input', updateRecentUploads);
    }

    // AWS & S3 config fields
    const awsAccessKeyId = document.getElementById('awsAccessKeyId');
    const awsSecretAccessKey = document.getElementById('awsSecretAccessKey');
    const awsRegion = document.getElementById('awsRegion');
    const s3BucketName = document.getElementById('s3BucketName');

    // Load from localStorage
    if (awsAccessKeyId) awsAccessKeyId.value = localStorage.getItem('AWS_ACCESS_KEY_ID') || '';
    if (awsSecretAccessKey) awsSecretAccessKey.value = localStorage.getItem('AWS_SECRET_ACCESS_KEY') || '';
    if (awsRegion) awsRegion.value = localStorage.getItem('AWS_REGION') || awsRegion.value;
    if (s3BucketName) s3BucketName.value = localStorage.getItem('S3_BUCKET_NAME') || '';

    // Save to localStorage on change
    if (awsAccessKeyId) awsAccessKeyId.addEventListener('input', e => localStorage.setItem('AWS_ACCESS_KEY_ID', e.target.value));
    if (awsSecretAccessKey) awsSecretAccessKey.addEventListener('input', e => localStorage.setItem('AWS_SECRET_ACCESS_KEY', e.target.value));
    if (awsRegion) awsRegion.addEventListener('input', e => localStorage.setItem('AWS_REGION', e.target.value));
    if (s3BucketName) s3BucketName.addEventListener('input', e => localStorage.setItem('S3_BUCKET_NAME', e.target.value));

    // Config panel toggle logic
    const configToggleBtn = document.getElementById('configToggleBtn');
    const configPanel = document.getElementById('configPanel');
    if (configToggleBtn && configPanel) {
        configToggleBtn.addEventListener('click', () => {
            configPanel.style.display = (configPanel.style.display === 'none' || configPanel.style.display === '') ? 'block' : 'none';
        });
    }
});

// Event listeners setup
function setupEventListeners() {
    // File input change
    fileInput.addEventListener('change', handleFileSelect);
    
    // Drag and drop
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);
    
    // Click to browse (but not on the button)
    uploadArea.addEventListener('click', (e) => {
        // Don't trigger if clicking on the button (let the button handle it)
        if (!e.target.closest('.browse-btn')) {
            fileInput.click();
        }
    });
    
    // Enter key for filename input
    fileNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            generateViewUrl();
        }
    });
}

// Drag and drop handlers
function handleDragOver(e) {
    e.preventDefault();
    uploadArea.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
}

// File selection handler
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        handleFile(file);
        // Reset the file input to allow selecting the same file again
        e.target.value = '';
    }
}

// Main file handling
async function handleFile(file) {
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        showError('Please select an image or video file.');
        return;
    }
    
    // Show progress
    showUploadProgress();
    
    try {
        // Upload file to server
        const uploadResponse = await uploadToServer(file);
        
        if (uploadResponse.success) {
            // Success
            showUploadSuccess(uploadResponse.fileName, uploadResponse.fileSize, uploadResponse.s3Key);
            
            // Add to recent uploads
            addToRecentUploads(uploadResponse.fileName, uploadResponse.fileSize, uploadResponse.s3Key);
            
            // Auto-fill filename input for viewing
            fileNameInput.value = uploadResponse.fileName;
            
            // Auto-generate view URL after successful upload
            setTimeout(() => {
                generateViewUrl();
            }, 500);
        } else {
            throw new Error(uploadResponse.message || 'Upload failed');
        }
        
    } catch (error) {
        console.error('Upload error:', error);
        showError('Upload failed. Please try again.');
    } finally {
        hideUploadProgress();
    }
}

// Upload file to server
async function uploadToServer(file) {
    return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        formData.append('file', file);

        // Add config fields
        formData.append('awsAccessKeyId', localStorage.getItem('AWS_ACCESS_KEY_ID') || '');
        formData.append('awsSecretAccessKey', localStorage.getItem('AWS_SECRET_ACCESS_KEY') || '');
        formData.append('awsRegion', localStorage.getItem('AWS_REGION') || 'us-east-1');
        formData.append('s3BucketName', localStorage.getItem('S3_BUCKET_NAME') || '');
        formData.append('tempFolder', getTempFolder());
        
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percentComplete = (e.loaded / e.total) * 100;
                updateProgress(percentComplete);
            }
        });
        
        xhr.addEventListener('load', () => {
            try {
                const response = JSON.parse(xhr.responseText);
                resolve(response);
            } catch (error) {
                resolve({ 
                    success: false, 
                    message: 'Invalid server response' 
                });
            }
        });
        
        xhr.addEventListener('error', () => {
            resolve({ 
                success: false, 
                message: 'Network error' 
            });
        });
        
        xhr.open('POST', '/api/upload');
        xhr.send(formData);
    });
}

// Generate view URL
async function generateViewUrl() {
    const fileName = fileNameInput.value.trim();
    
    if (!fileName) {
        showError('Please enter a filename.');
        return;
    }
    
    try {
        const body = {
            fileName,
            awsAccessKeyId: localStorage.getItem('AWS_ACCESS_KEY_ID') || '',
            awsSecretAccessKey: localStorage.getItem('AWS_SECRET_ACCESS_KEY') || '',
            awsRegion: localStorage.getItem('AWS_REGION') || 'us-east-1',
            s3BucketName: localStorage.getItem('S3_BUCKET_NAME') || '',
            tempFolder: getTempFolder(),
        };
        const response = await fetch('/api/view-url', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });
        
        if (!response.ok) {
            throw new Error('Failed to generate view URL');
        }
        
        const { viewUrl: url } = await response.json();
        
        // Display URL
        viewUrl.value = url;
        viewResult.style.display = 'block';
        
        // Determine file type and show appropriate preview
        const fileExtension = fileName.split('.').pop()?.toLowerCase();
        const isVideo = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'].includes(fileExtension);
        
        if (isVideo) {
            // Show video preview
            previewVideo.src = url;
            previewVideo.style.display = 'block';
            previewImage.style.display = 'none';
            
            previewVideo.onloadeddata = () => {
                previewVideo.style.display = 'block';
            };
            previewVideo.onerror = () => {
                previewVideo.style.display = 'none';
                showError('Failed to load video preview.');
            };
        } else {
            // Show image preview
            previewImage.src = url;
            previewImage.style.display = 'block';
            previewVideo.style.display = 'none';
            
            previewImage.onload = () => {
                previewImage.style.display = 'block';
            };
            previewImage.onerror = () => {
                previewImage.style.display = 'none';
                showError('Failed to load image preview.');
            };
        }
        
    } catch (error) {
        console.error('View URL error:', error);
        showError('Failed to generate view URL. Please check the filename.');
    }
}

// Copy to clipboard
async function copyToClipboard(elementId) {
    const element = document.getElementById(elementId);
    
    try {
        await navigator.clipboard.writeText(element.value);
        showSuccess('URL copied to clipboard!');
    } catch (error) {
        // Fallback for older browsers
        element.select();
        document.execCommand('copy');
        showSuccess('URL copied to clipboard!');
    }
}

// Recent uploads management
function addToRecentUploads(fileName, fileSize, s3Key) {
    const upload = {
        fileName,
        fileSize,
        s3Key,
        timestamp: Date.now(),
    };
    
    // Add to beginning of array
    recentUploads.unshift(upload);
    
    // Keep only last 10 uploads
    if (recentUploads.length > 10) {
        recentUploads = recentUploads.slice(0, 10);
    }
    
    // Save to localStorage
    localStorage.setItem('recentUploads', JSON.stringify(recentUploads));
    
    // Update UI
    updateRecentUploads();
}

function getTempFolder() {
    const input = document.getElementById('tempFolderInput');
    return (input && input.value.trim()) ? input.value.trim() : 'temp';
}

function updateRecentUploads() {
    if (recentUploads.length === 0) {
        recentList.innerHTML = '<p class="no-uploads">No recent uploads</p>';
        return;
    }
    
    const tempFolder = getTempFolder();
    const html = recentUploads.map(upload => `
        <div class="recent-item">
            <div class="recent-item-info">
                <div class="recent-item-name">${upload.fileName}</div>
                <div class="recent-item-size">${upload.fileSize} • ${formatTimestamp(upload.timestamp)}</div>
                <div class="recent-item-path">📁 ${upload.s3Key || `${tempFolder}/${upload.fileName}`}</div>
            </div>
            <div class="recent-item-actions">
                <button class="action-btn view-action-btn" onclick="viewRecentFile('${upload.fileName}')">
                    👁️ View
                </button>
                <button class="action-btn copy-action-btn" onclick="copyRecentFileName('${upload.fileName}')">
                    📋 Copy Name
                </button>
            </div>
        </div>
    `).join('');
    
    recentList.innerHTML = html;
}

function viewRecentFile(fileName) {
    fileNameInput.value = fileName;
    generateViewUrl();
}

function copyRecentFileName(fileName) {
    navigator.clipboard.writeText(fileName).then(() => {
        showSuccess('Filename copied to clipboard!');
    }).catch(() => {
        // Fallback
        const textArea = document.createElement('textarea');
        textArea.value = fileName;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        showSuccess('Filename copied to clipboard!');
    });
}

// UI helpers
function showUploadProgress() {
    uploadProgress.style.display = 'block';
    uploadResult.style.display = 'none';
    updateProgress(0);
}

function hideUploadProgress() {
    uploadProgress.style.display = 'none';
}

function updateProgress(percent) {
    progressFill.style.width = `${percent}%`;
    progressText.textContent = `Uploading... ${Math.round(percent)}%`;
}

function showUploadSuccess(fileName, fileSize, s3Key) {
    uploadedFileName.textContent = fileName;
    uploadedFileSize.textContent = fileSize;
    uploadedS3Key.textContent = s3Key;
    uploadResult.style.display = 'block';
    
    // Show success message with temp folder info
    const tempFolder = getTempFolder();
    showSuccess(`File uploaded successfully to temp folder: ${s3Key || tempFolder + '/' + fileName}`);
}

function showError(message) {
    // Simple error display - you could enhance this with a toast notification
    alert(message);
}

function showSuccess(message) {
    // Simple success display - you could enhance this with a toast notification
    console.log(message);
}

// Utility functions
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) { // Less than 1 minute
        return 'Just now';
    } else if (diff < 3600000) { // Less than 1 hour
        const minutes = Math.floor(diff / 60000);
        return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (diff < 86400000) { // Less than 1 day
        const hours = Math.floor(diff / 3600000);
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
        return date.toLocaleDateString();
    }
} 