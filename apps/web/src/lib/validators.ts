/**
 * Client-side field validators.
 * Each validator returns null on success, or an error string on failure.
 *
 * Usage:
 *   const gstinError = validators.gstin(inputValue)
 *   if (gstinError) setFieldError(gstinError)
 */
export const validators = {
  gstin: (v: string): string | null => {
    if (!v) return 'GSTIN is required'
    const cleaned = v.trim().toUpperCase()
    if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(cleaned)) {
      return 'Invalid GSTIN — must be 15 characters (e.g. 27AAACR5055K1Z5)'
    }
    return null
  },

  pan: (v: string): string | null => {
    if (!v) return 'PAN is required'
    const cleaned = v.trim().toUpperCase()
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleaned)) {
      return 'Invalid PAN — must be 10 characters (e.g. AAACR5055K)'
    }
    return null
  },

  phone: (v: string): string | null => {
    if (!v) return 'Phone number is required'
    const e164 = v.startsWith('+') ? v : `+91${v.replace(/^0+/, '')}`
    if (!/^\+[1-9]\d{9,14}$/.test(e164)) {
      return 'Invalid phone number — include country code (e.g. +919876543210)'
    }
    return null
  },

  fileSize: (file: File, maxMb = 10): string | null => {
    if (file.size > maxMb * 1024 * 1024) {
      return `File is too large. Maximum size is ${maxMb}MB.`
    }
    return null
  },

  fileType: (
    file: File,
    allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
  ): string | null => {
    if (!allowed.includes(file.type)) {
      return 'Invalid file type. Please upload a PDF, JPG, PNG, or WebP.'
    }
    return null
  },
}
