/**
 * Emergency Contact Data Normalization and Utilities
 *
 * Ensures consistent handling of emergency contacts across the entire app
 * (ProfileTab, EmergencyTab, useHealthProfile hook, and Firestore storage).
 *
 * Handles legacy string formats, missing fields, object formats, and multi-contact arrays.
 */

export const DEFAULT_EMERGENCY_CONTACT = Object.freeze({
  name: '',
  relation: '',
  phone: ''
});

/**
 * Normalizes any emergency contact value (string, object, array, null, undefined)
 * into a consistent structured object: { name, relation, phone }.
 *
 * @param {unknown} raw - The emergency contact in any format
 * @returns {{ name: string, relation: string, phone: string }}
 */
export function normalizeEmergencyContact(raw) {
  if (!raw) {
    return { ...DEFAULT_EMERGENCY_CONTACT };
  }

  // Case 1: Array of contacts (multiple contacts) -> pick primary (first valid)
  if (Array.isArray(raw)) {
    if (raw.length === 0) return { ...DEFAULT_EMERGENCY_CONTACT };
    return normalizeEmergencyContact(raw[0]);
  }

  // Case 2: Object representation
  if (typeof raw === 'object') {
    const name = typeof raw.name === 'string'
      ? raw.name.trim()
      : (typeof raw.contactName === 'string' ? raw.contactName.trim() : '');

    const relation = typeof raw.relation === 'string'
      ? raw.relation.trim()
      : (typeof raw.relationship === 'string' ? raw.relationship.trim() : '');

    const phone = typeof raw.phone === 'string'
      ? raw.phone.trim()
      : (typeof raw.phoneNumber === 'string' ? raw.phoneNumber.trim() : '');

    return { name, relation, phone };
  }

  // Case 3: Legacy string representation (e.g. "Jane Doe (Spouse) 555-1234" or "Jane Doe, Sister, 555-1234")
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return { ...DEFAULT_EMERGENCY_CONTACT };

    // Extract telephone number pattern (7+ digits with formatting)
    const phoneRegex = /(\+?\d[\d\s\-().]{6,}\d)/;
    const phoneMatch = trimmed.match(phoneRegex);

    let phone = '';
    let remaining = trimmed;

    if (phoneMatch) {
      phone = phoneMatch[1].trim();
      remaining = trimmed.replace(phoneMatch[0], '').trim();
    }

    // Extract relation from parentheses, e.g. "Jane Doe (Spouse)"
    let relation = '';
    const relationMatch = remaining.match(/\(([^)]+)\)/);
    if (relationMatch) {
      relation = relationMatch[1].trim();
      remaining = remaining.replace(relationMatch[0], '').trim();
    }

    // If no relation found via parentheses, check if comma-separated: "Jane Doe, Sister"
    if (!relation && remaining.includes(',')) {
      const parts = remaining.split(',').map(p => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        remaining = parts[0];
        relation = parts.slice(1).join(', ');
      }
    }

    // Clean leading/trailing punctuation
    let name = remaining.replace(/^[,\s:\-]+|[,\s:\-]+$/g, '').trim();

    // If no phone was matched but the entire string is numeric/phone-like
    if (!phone && /^\+?[\d\s\-().]{7,}$/.test(trimmed)) {
      phone = trimmed;
      name = '';
    }

    return { name, relation, phone };
  }

  return { ...DEFAULT_EMERGENCY_CONTACT };
}

/**
 * Formats a structured emergency contact into a readable single-line string.
 *
 * @param {unknown} contact - Structured or raw contact
 * @returns {string} e.g. "Jane Doe (Spouse) - 555-1234"
 */
export function formatEmergencyContact(contact) {
  const norm = normalizeEmergencyContact(contact);
  const parts = [];
  if (norm.name) parts.push(norm.name);
  if (norm.relation) parts.push(`(${norm.relation})`);
  if (norm.phone) parts.push(norm.phone);
  return parts.join(' ').trim();
}

/**
 * Checks if an emergency contact has any non-empty fields.
 *
 * @param {unknown} contact
 * @returns {boolean}
 */
export function hasEmergencyContact(contact) {
  const norm = normalizeEmergencyContact(contact);
  return Boolean(norm.name || norm.phone);
}
