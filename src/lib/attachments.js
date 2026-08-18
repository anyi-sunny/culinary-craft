// Attachment encoding for the AI endpoints (chat + upload-to-save).
// Images are downscaled client-side and sent as Claude "image" blocks;
// PDFs go up as-is as "document" blocks (the model reads PDFs natively,
// scanned pages included — no parser needed).

// Images get downscaled before sending, but PDFs go up verbatim — cap them
// so the base64 payload stays under the backend's request size limit.
export const MAX_PDF_BYTES = 3.5 * 1024 * 1024;

// Claude reads images best at ≤1568px on the long side, and phone photos
// base64-encoded can blow past the backend's request size cap — so
// downscale/re-encode on the client before sending.
const MAX_IMAGE_DIM = 1568;

const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            // Strip the data:<type>;base64, prefix
            resolve(reader.result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

const getMimeType = (file) => {
    const type = file.type.toLowerCase();
    if (type === 'image/jpeg') return 'image/jpeg';
    if (type === 'image/png') return 'image/png';
    if (type === 'image/webp') return 'image/webp';
    if (type === 'image/gif') return 'image/gif';
    return 'image/jpeg';
};

const encodeImageForChat = async (file) => {
    try {
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(1, MAX_IMAGE_DIM / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff'; // flatten any transparency to white
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close();
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        return { base64: dataUrl.split(',')[1], mimeType: 'image/jpeg' };
    } catch {
        // Decode/canvas failed — fall back to sending the original file.
        const base64 = await fileToBase64(file);
        return { base64, mimeType: getMimeType(file) };
    }
};

/** Encode a picked file for the agent API: {kind: 'image'|'document', base64, mimeType}. */
export const encodeAttachment = async (file) => {
    if (file.type === 'application/pdf') {
        const base64 = await fileToBase64(file);
        return { kind: 'document', base64, mimeType: 'application/pdf' };
    }
    const image = await encodeImageForChat(file);
    return { kind: 'image', ...image };
};

/** The Claude content-block array for a user turn with an attachment —
 * attachment first (the recommended order), then the text. */
export const attachmentContent = (text, attachment) => [
    {
        type: attachment.kind === 'document' ? 'document' : 'image',
        source: {
            type: 'base64',
            media_type: attachment.mimeType,
            data: attachment.base64,
        },
    },
    { type: 'text', text },
];
