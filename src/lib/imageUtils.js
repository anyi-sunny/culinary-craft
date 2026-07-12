// Image handling utilities for recipes
// Supports direct S3 uploads with automatic compression

const MAX_IMAGE_SIZE = 5242880; // 5MB max for S3
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const TARGET_WIDTH = 1200; // Max width for resized images
const QUALITY = 0.8; // JPEG quality (0-1)

/**
 * Compress and resize image using canvas
 * Returns a blob that's optimized for S3 storage
 */
async function compressImage(file) {
    return new Promise((resolve, reject) => {
        console.log(`🖼️ Compressing image: ${file.name}, size: ${(file.size / 1024).toFixed(2)}KB`);
        const reader = new FileReader();
        reader.onload = (e) => {
            console.log(`📖 File read complete for ${file.name}`);
            const img = new Image();
            img.onload = () => {
                console.log(`📐 Image loaded: ${img.width}x${img.height}`);
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Resize if width exceeds target
                if (width > TARGET_WIDTH) {
                    height = (height * TARGET_WIDTH) / width;
                    width = TARGET_WIDTH;
                    console.log(`📉 Resized to: ${width}x${height}`);
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Convert to blob with quality optimization
                canvas.toBlob(
                    (blob) => {
                        console.log(`✅ Compression complete. Compressed size: ${(blob.size / 1024).toFixed(2)}KB`);
                        resolve(blob);
                    },
                    'image/jpeg',
                    QUALITY
                );
            };
            img.onerror = () => {
                console.error(`❌ Failed to load image`);
                reject(new Error('Failed to load image'));
            };
            img.src = e.target.result;
        };
        reader.onerror = () => {
            console.error(`❌ Failed to read file`);
            reject(new Error('Failed to read file'));
        };
        reader.readAsDataURL(file);
    });
}

/**
 * Get presigned URL for S3 upload from Lambda
 */
async function getPresignedUploadUrl(userId, fileName, fileType) {
    const apiEndpoint = import.meta.env.VITE_API_ENDPOINT;
    console.log(`🌐 API Endpoint: ${apiEndpoint}`);
    if (!apiEndpoint) {
        throw new Error('API endpoint not configured');
    }

    console.log(`📤 Requesting presigned URL for: ${fileName} (${fileType})`);
    const requestBody = {
        userId,
        fileName,
        fileType
    };
    console.log(`📋 Request body:`, requestBody);

    const response = await fetch(`${apiEndpoint}/generate-upload-url`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
    });

    console.log(`📨 Response status: ${response.status}`);

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.error(`❌ Error response:`, error);
        throw new Error(error.error || `Failed to get upload URL: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ Presigned URL received:`, {
        presignedUrl: data.presignedUrl,
        imageUrl: data.imageUrl,
        s3Key: data.s3Key,
        fieldsCount: Object.keys(data.fields || {}).length
    });
    return data;
}

/**
 * Upload image directly to S3 using presigned URL
 */
async function uploadToS3(presignedUrl, fields, imageBlob) {
    console.log(`⬆️ Uploading to S3...`);
    console.log(`📍 URL: ${presignedUrl}`);
    console.log(`📦 Blob size: ${(imageBlob.size / 1024).toFixed(2)}KB`);
    console.log(`📋 Form fields:`, Object.keys(fields));

    const formData = new FormData();

    // Add presigned form fields
    Object.entries(fields).forEach(([key, value]) => {
        formData.append(key, value);
        console.log(`  - ${key}: ${typeof value === 'string' && value.length > 100 ? value.substring(0, 50) + '...' : value}`);
    });

    // Add the image file
    formData.append('file', imageBlob, 'image.jpg');
    console.log(`  - file: image.jpg (${(imageBlob.size / 1024).toFixed(2)}KB)`);

    const response = await fetch(presignedUrl, {
        method: 'POST',
        body: formData,
    });

    console.log(`📨 S3 upload response status: ${response.status}`);

    if (!response.ok) {
        const responseText = await response.text().catch(() => '');
        console.error(`❌ S3 upload failed: ${response.statusText}`, responseText);
        throw new Error(`S3 upload failed: ${response.statusText}`);
    }

    console.log(`✅ S3 upload successful!`);
    return response;
}

/**
 * Upload image to S3 and return the public URL
 * Handles compression automatically
 */
export async function uploadImageToS3(file, userId) {
    console.log(`🚀 uploadImageToS3 called with userId: ${userId}`);

    if (!file) {
        console.error(`❌ No file provided`);
        return null;
    }

    console.log(`📄 File: ${file.name}, Size: ${(file.size / 1024).toFixed(2)}KB, Type: ${file.type}`);

    if (!ALLOWED_TYPES.includes(file.type)) {
        const error = 'Only JPEG, PNG, and WebP images are supported';
        console.error(`❌ ${error}`);
        throw new Error(error);
    }

    if (file.size > MAX_IMAGE_SIZE) {
        const error = `Image must be smaller than ${MAX_IMAGE_SIZE / 1000000}MB`;
        console.error(`❌ ${error}`);
        throw new Error(error);
    }

    try {
        // Compress the image
        console.log(`🔧 Starting compression...`);
        const compressedBlob = await compressImage(file);

        // Get presigned URL from Lambda
        console.log(`🔑 Requesting presigned URL...`);
        const { presignedUrl, fields, imageUrl } = await getPresignedUploadUrl(
            userId,
            file.name,
            'image/jpeg' // Always use JPEG after compression
        );

        // Upload to S3
        console.log(`📤 Uploading to S3...`);
        await uploadToS3(presignedUrl, fields, compressedBlob);

        // Return the public S3 URL
        console.log(`🎉 Upload complete! Image URL: ${imageUrl}`);
        return imageUrl;
    } catch (error) {
        console.error(`❌ Image upload failed: ${error.message}`);
        throw new Error(`Image upload failed: ${error.message}`);
    }
}

/**
 * Validate image file
 */
export async function validateImage(file) {
    if (!file) return null;

    if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error('Only JPEG, PNG, and WebP images are supported');
    }

    if (file.size > MAX_IMAGE_SIZE) {
        throw new Error(`Image must be smaller than ${MAX_IMAGE_SIZE / 1000000}MB. Current size: ${(file.size / 1000000).toFixed(1)}MB`);
    }

    return true;
}

/**
 * Get placeholder color for recipe without image
 */
export function getPlaceholderColor(recipeId) {
    const colors = [
        '#FF8C42', // Orange
        '#FF9D5C', // Light orange
        '#FFA366', // Lighter orange
        '#FFB380', // Even lighter
        '#FFC29A', // Very light orange
    ];

    const hash = recipeId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
}

/**
 * Create placeholder element for recipe without image
 */
export function createImagePlaceholder(recipeId, title = '') {
    const color = getPlaceholderColor(recipeId);
    return {
        type: 'placeholder',
        color,
        title: title || 'Recipe Image'
    };
}
