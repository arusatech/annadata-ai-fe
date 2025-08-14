// Security service for certificate pinning and security measures
interface CertificateFingerprints {
  [hostname: string]: string[];
}

interface SecurityHeaders {
  [key: string]: string;
}

class SecurityService {
  private certificateFingerprints: CertificateFingerprints;

  constructor() {
    // Certificate fingerprints for pinning
    this.certificateFingerprints = {
      'staging.annadata.ai': [
        // Add your server's certificate fingerprint here
        // You can get this by running: openssl s_client -connect staging.annadata.ai:443 -servername staging.annadata.ai < /dev/null | openssl x509 -noout -fingerprint -sha256
        // Example: 'sha256/XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
        'sha256 Fingerprint=C2:78:B7:45:E8:51:E0:19:C1:09:F8:61:8D:81:6B:3C:3D:63:41:DD:8A:F4:EA:B6:82:33:2B:CB:1E:CE:80:F5'
      ],
      'annadata.ai': [
        'sha256 Fingerprint=16:6E:6E:25:4A:0E:83:CB:C0:84:3D:06:54:1F:63:99:10:22:91:F3:33:1F:F0:32:D6:45:D3:99:7D:66:DF:B7'
      ]
    };
  }

  // Validate certificate fingerprint
  validateCertificate(hostname: string, certificate: any): boolean {
    if (!this.certificateFingerprints[hostname]) {
      console.warn(`No certificate fingerprint configured for ${hostname}`);
      return true; // Allow if no fingerprint configured
    }

    const expectedFingerprints = this.certificateFingerprints[hostname];
    const actualFingerprint = this.getCertificateFingerprint(certificate);

    return expectedFingerprints.includes(actualFingerprint);
  }

  // Get certificate fingerprint
  getCertificateFingerprint(certificate: any): string {
    // This would be implemented based on the platform
    // For now, we'll return a placeholder
    return 'sha256/placeholder';
  }

  // Add security headers to requests
  addSecurityHeaders(headers: SecurityHeaders = {}): SecurityHeaders {
    return {
      ...headers,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block'
    };
  }

  // Validate JWT token format
  validateJWTFormat(token: string | null | undefined): boolean {
    if (!token || typeof token !== 'string') {
      return false;
    }

    // JWT should have 3 parts separated by dots
    const parts = token.split('.');
    if (parts.length !== 3) {
      return false;
    }

    // Each part should be base64 encoded
    try {
      parts.forEach(part => {
        // Add padding if needed
        const paddedPart = part + '='.repeat((4 - part.length % 4) % 4);
        atob(paddedPart.replace(/-/g, '+').replace(/_/g, '/'));
      });
      return true;
    } catch (error) {
      return false;
    }
  }

  // Sanitize user input
  sanitizeInput(input: any): any {
    if (typeof input !== 'string') {
      return input;
    }

    // Basic XSS prevention
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  // Generate secure random string
  generateSecureRandom(length: number = 32): string {
    const array = new Uint8Array(length);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(array);
    } else {
      // Fallback for environments without crypto API
      for (let i = 0; i < length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
    }
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }
}

export default new SecurityService();
