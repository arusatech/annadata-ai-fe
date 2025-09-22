/**
 * Device and location information service
 */

// Type definitions
interface LocationData {
  latitude: number | string;
  longitude: number | string;
  city: string;
  region: string;
  postal: string;
  country: string;
  country_code: string;
  timezone: string;
  ip: string;
}

interface DeviceInfo {
  device_id: string | null;
  device_type: 'mobile' | 'tablet' | 'desktop';
  user_agent: string;
  platform: string;
  language: string;
  screen_size: string;
  pixel_ratio: number | string;
  color_depth: number | string;
  timezone_offset: number | string;
  hardware_concurrency: number | string;
  device_memory: number | string;
  is_mobile: boolean;
  latitude: number | string;
  longitude: number | string;
  location: string;
  country: string;
  local_TZ: string;
  ip_address: string;
}

interface UserAgentData {
  platform?: string;
  brands?: Array<{ brand: string; version: string }>;
}

// Extend Navigator interface for userAgentData
declare global {
  interface Navigator {
    userAgentData?: UserAgentData;
    deviceMemory?: number;
    hardwareConcurrency?: number;
  }
}

// Function to get device type
function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  const ua: string = navigator.userAgent;
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return "tablet";
  } else if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
    return "mobile";
  }
  return "desktop";
}

// Function to generate a device fingerprint
async function generateDeviceId(): Promise<string> {
  const components: (string | number | undefined)[] = [
    navigator.userAgent,
    navigator.language,
    new Date().getTimezoneOffset(),
    navigator.hardwareConcurrency,
    navigator.deviceMemory,
    navigator.userAgentData?.platform || 'unknown',
    navigator.userAgentData?.brands?.map(b => b.brand).join(',') || 'unknown',
    `${screen.width}x${screen.height}`,
    screen.colorDepth,
    window.devicePixelRatio,
    Math.random().toString(36).substring(2)
  ];
  
  const filteredComponents: (string | number)[] = components.filter((item): item is string | number => item !== undefined);
  const fingerprint: string = filteredComponents.join('###');
  
  try {
    // Try to use crypto.subtle.digest if available
    if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
      const hashBuffer: ArrayBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fingerprint));
      const hashArray: number[] = Array.from(new Uint8Array(hashBuffer));
      const hashHex: string = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex.substring(0, 16);
    } else {
      // Fallback: simple hash function
      console.warn('crypto.subtle.digest not available, using fallback hash');
      return simpleHash(fingerprint).substring(0, 16);
    }
  } catch (error) {
    console.warn('Error using crypto.subtle.digest, using fallback hash:', error);
    return simpleHash(fingerprint).substring(0, 16);
  }
}

// Simple hash function as fallback
function simpleHash(str: string): string {
  let hash = 0;
  if (str.length === 0) return hash.toString(16);
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash).toString(16);
}

// Function to get a unique device ID
async function getDeviceId(): Promise<string | null> {
  try {
    let deviceId: string | null = localStorage.getItem('device_id');
    if (deviceId) {
      return deviceId;
    }
    deviceId = await generateDeviceId();
    localStorage.setItem('device_id', deviceId);
    return deviceId;
  } catch (error) {
    console.error('Error getting device ID:', error);
    return null;
  }
}

// Function to check if device ID is available
function isDeviceIdAvailable(): boolean {
  try {
    const deviceId: string | null = localStorage.getItem('device_id');
    return deviceId !== null && deviceId !== undefined && deviceId !== '';
  } catch (error) {
    console.error('Error checking device ID availability:', error);
    return false;
  }
}

/**
 * Fetches location data based on the user's IP address
 * @returns {Promise<LocationData>} A promise that resolves to an object with location data
 */
async function fetchIPBasedLocation(): Promise<LocationData> {
  try {
    const response: Response = await fetch('https://ipapi.co/json/');
    if (!response.ok) {
      throw new Error(`IP geolocation API returned ${response.status}: ${response.statusText}`);
    }
    const data: any = await response.json();
    if (data.error) {
      throw new Error(`IP geolocation error: ${data.reason}`);
    }
    return {
      latitude: data.latitude,
      longitude: data.longitude,
      city: data.city,
      region: data.region,
      postal: data.postal,
      country: data.country_name,
      country_code: data.country_code,
      timezone: data.timezone,
      ip: data.ip
    };
  } catch (error) {
    console.error('Error fetching IP-based location:', error);
    // Return a default object in case of an error
    return {
      latitude: 'N/A',
      longitude: 'N/A',
      city: 'N/A',
      region: 'N/A',
      postal: 'N/A',
      country: 'N/A',
      country_code: 'N/A',
      timezone: 'N/A',
      ip: 'N/A'
    };
  }
}

/**
 * Get complete device information
 * @returns {Promise<DeviceInfo>} Object containing all device information
 */
export async function getFullDeviceInfo(): Promise<DeviceInfo> {
  const deviceId: string | null = await getDeviceId();
  const deviceType: 'mobile' | 'tablet' | 'desktop' = getDeviceType();
  const location: LocationData = await fetchIPBasedLocation();
  
  const deviceInfo: DeviceInfo = {
    device_id: deviceId,
    device_type: deviceType,
    user_agent: navigator.userAgent || 'unknown',
    platform: navigator.platform || 'unknown',
    language: navigator.language || 'unknown',
    screen_size: `${screen.width}x${screen.height}` || 'unknown',
    pixel_ratio: window.devicePixelRatio || 'unknown',
    color_depth: screen.colorDepth || 'unknown',
    timezone_offset: new Date().getTimezoneOffset() || 'unknown',
    hardware_concurrency: navigator.hardwareConcurrency || 'unknown',
    device_memory: navigator.deviceMemory || 'unknown',
    is_mobile: deviceType !== 'desktop',
    latitude: location.latitude,
    longitude: location.longitude,
    location: `${location.city}, ${location.region}, ${location.postal}`,
    country: `${location.country}, ${location.country_code}`,
    local_TZ: location.timezone,
    ip_address: location.ip,
  };
  
  localStorage.setItem('deviceInfo', JSON.stringify(deviceInfo));
  return deviceInfo;
}

// Session management functions
async function getCurrentSessionId(): Promise<string | null> {
  try {
    return localStorage.getItem('current_session_id');
  } catch (error) {
    console.error('Error getting current session ID:', error);
    return null;
  }
}

async function setCurrentSessionId(sessionId: string): Promise<void> {
  try {
    localStorage.setItem('current_session_id', sessionId);
  } catch (error) {
    console.error('Error setting current session ID:', error);
  }
}

// Export the functions
export { getDeviceId, isDeviceIdAvailable, getCurrentSessionId, setCurrentSessionId };
