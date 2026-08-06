import DOMPurify from 'dompurify';

const sanitizationConfig = {
  ALLOWED_TAGS: [],
  ALLOWED_ATTR: [],
  KEEP_CONTENT: true,
};

/**
 * Sanitize user input to prevent XSS attacks
 * Removes all HTML/script tags and dangerous attributes
 */
export function sanitizeInput(input) {
  if (typeof input !== 'string') return String(input || '');
  return DOMPurify.sanitize(input, sanitizationConfig);
}

/**
 * Sanitize multiple fields from an object
 */
export function sanitizeObject(obj, fieldsToSanitize = []) {
  const sanitized = { ...obj };
  fieldsToSanitize.forEach(field => {
    if (typeof sanitized[field] === 'string') {
      sanitized[field] = sanitizeInput(sanitized[field]);
    }
  });
  return sanitized;
}

/**
 * Sanitize array of strings
 */
export function sanitizeArray(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(item =>
    typeof item === 'string' ? sanitizeInput(item) : item
  );
}
