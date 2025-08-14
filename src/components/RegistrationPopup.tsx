import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { countryCodes } from '../data/langData';
import '../css/language.css';
import '../css/newUserSettings.css';
import '../css/common.css';
import CountryCodePopup from './CountryCodePopup';
import AuthService from '../services/AuthService';

const authService = AuthService;

// Custom confirmation dialog function
const showCustomConfirmation = (
  message: string, 
  onProceed: () => void, 
  onClose: () => void
): void => {
  // Create modal container
  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'language-popup';
  modalOverlay.style.display = 'block';
  modalOverlay.style.zIndex = '9999';
  
  // Create popup wrapper
  const popupWrapper = document.createElement('div');
  popupWrapper.className = 'popup-wrapper';
  
  // Create close button
  const closeBtn = document.createElement('span');
  closeBtn.className = 'close-btn';
  closeBtn.innerHTML = '&times;';
  closeBtn.addEventListener('click', () => {
    document.body.removeChild(modalOverlay);
    if (onClose) onClose();
  });
  
  // Create content container
  const contentDiv = document.createElement('div');
  contentDiv.className = 'popup-content';
  
  // Create message element
  const messageElement = document.createElement('p');
  messageElement.textContent = message;
  messageElement.style.margin = '20px 0';
  messageElement.style.textAlign = 'center';
  messageElement.style.whiteSpace = 'pre-line';
  messageElement.style.fontSize = '16px';
  messageElement.style.lineHeight = '1.5';
  
  // Create proceed button
  const proceedButton = document.createElement('button');
  proceedButton.textContent = 'Proceed';
  proceedButton.className = 'btn-primary';
  proceedButton.style.padding = '8px 16px';
  proceedButton.style.backgroundColor = '#000000';
  proceedButton.style.color = 'white';
  proceedButton.style.border = 'none';
  proceedButton.style.borderRadius = '4px';
  proceedButton.style.cursor = 'pointer';
  proceedButton.style.margin = '10px auto';
  proceedButton.style.display = 'block';
  proceedButton.style.width = '120px';
  
  // Add event listener to proceed button
  proceedButton.addEventListener('click', () => {
    document.body.removeChild(modalOverlay);
    if (onProceed) onProceed();
  });
  
  // Assemble the modal
  contentDiv.appendChild(messageElement);
  contentDiv.appendChild(proceedButton);
  
  popupWrapper.appendChild(closeBtn);
  popupWrapper.appendChild(contentDiv);
  
  modalOverlay.appendChild(popupWrapper);
  
  // Add to the document
  document.body.appendChild(modalOverlay);
};

const getFlagEmoji = (countryCode: string): string => {
  if (!countryCode || countryCode.length !== 2) return '';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

// Helper function to parse UIDs from error message
const parseUidsFromError = (errorMessage: string): { uid1: string | null; uid2: string | null } => {
  try {
    // Look for pattern: "Multiple ID [uid1,uid2] on same device is not allowed"
    const bracketMatch = errorMessage.match(/\[([^\]]+)\]/);
    if (!bracketMatch) {
      console.warn('No bracket content found in error message:', errorMessage);
      return { uid1: null, uid2: null };
    }
    
    const bracketContent = bracketMatch[1];
    const uids = bracketContent.split(',').map(uid => uid.trim());
    
    if (uids.length !== 2) {
      console.warn('Expected 2 UIDs, found:', uids.length, 'in:', bracketContent);
      return { uid1: null, uid2: null };
    }
    
    return { uid1: uids[0], uid2: uids[1] };
  } catch (error) {
    console.error('Error parsing UIDs from error message:', error);
    return { uid1: null, uid2: null };
  }
};

interface RegistrationPopupProps {
  onClose: () => void;
  onAuthStateChange?: (isAuthenticated: boolean, userExists: boolean) => void;
}

interface ValidationResult {
  isValid: boolean;
  error: string | null;
}

type ContactMethod = 'phone' | 'email';
type OtpState = 'idle' | 'requesting' | 'success' | 'failed';

const RegistrationPopup: React.FC<RegistrationPopupProps> = ({ onClose, onAuthStateChange }) => {
  const { t } = useTranslation();

  const [username, setUsername] = useState<string>('');
  const [contactInfo, setContactInfo] = useState<string>('');
  const [selectedContactMethod, setSelectedContactMethod] = useState<ContactMethod>('phone');
  const [countryCode, setCountryCode] = useState<string>('+91');
  const [otp, setOtp] = useState<string>('');
  const [isCountryPopupVisible, setIsCountryPopupVisible] = useState<boolean>(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [otpState, setOtpState] = useState<OtpState>('idle');
  const [countdown, setCountdown] = useState<number>(0);
  const [isPopupInactive, setIsPopupInactive] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const dropdownOptions = useMemo(() => {
    const options = Object.entries(countryCodes).map(([code, country]) => {
      if (code === 'email') {
        return { value: '@', label: 'Email @' };
      }
      const flag = getFlagEmoji(country);
      return { value: code, label: `${code} ${flag}` };
    });
    const india = options.find(o => o.value === '+91');
    const email = options.find(o => o.value === '@');
    const rest = options.filter(o => o.value !== '+91' && o.value !== '@');
    return [india, email, ...rest].filter(Boolean) as { value: string; label: string; }[];
  }, []);

  // Timer effect for countdown
  useEffect(() => {
    if (countdown > 0) {
      countdownRef.current = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
    } else if (countdown === 0 && otpState === 'success') {
      setOtpState('failed');
    }
    
    return () => {
      if (countdownRef.current) {
        clearTimeout(countdownRef.current);
      }
    };
  }, [countdown, otpState]);

  // Cleanup timer on component unmount
  useEffect(() => {
    return () => {
      if (countdownRef.current) {
        clearTimeout(countdownRef.current);
      }
    };
  }, []);

  // Start countdown timer
  const startCountdown = (): void => {
    setCountdown(180); // 3 minutes = 180 seconds
  };

  // Format countdown time
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Validate contact information
  const validateContactInfo = (value: string, method: ContactMethod, country: string): ValidationResult => {
    if (!value.trim()) {
      return { isValid: false, error: 'Please enter your contact information' };
    }

    if (method === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return { isValid: false, error: 'Please enter a valid email address' };
      }
    } else {
      // Phone number validation - restrict to 10-12 digits, no country/area codes
      const phoneRegex = /^[0-9]{10,12}$/;
      const cleanPhone = value.replace(/\s+/g, '').replace(/[^\d]/g, ''); // Remove all non-digits
      
      // Check if phone number contains country code patterns (starts with + or 00)
      if (value.includes('+') || value.startsWith('00')) {
        return { isValid: false, error: 'Please enter only the phone number without country code' };
      }
      
      // Check if phone number is too short
      if (cleanPhone.length < 10) {
        return { isValid: false, error: 'Phone number must be at least 10 digits' };
      }
      
      // Check if phone number is too long
      if (cleanPhone.length > 12) {
        return { isValid: false, error: 'Phone number cannot exceed 12 digits' };
      }
      
      // Validate format
      if (!phoneRegex.test(cleanPhone)) {
        return { isValid: false, error: 'Please enter a valid phone number (10-12 digits)' };
      }
      
      // Country-specific validation
      if (country === '+91' && cleanPhone.length !== 10) {
        return { isValid: false, error: 'Indian phone numbers must be 10 digits' };
      }
      
      if (country === '+1' && cleanPhone.length !== 10) {
        return { isValid: false, error: 'US/Canada phone numbers must be 10 digits' };
      }
    }

    return { isValid: true, error: null };
  };

  // Handle contact info change with validation
  const handleContactInfoChange = (value: string): void => {
    let processedValue = value;
    
    // For phone numbers, clean the input
    if (selectedContactMethod === 'phone') {
      // Remove all non-digit characters except spaces
      processedValue = value.replace(/[^\d\s]/g, '');
      
      // Limit to 12 digits
      const digitsOnly = processedValue.replace(/\s/g, '');
      if (digitsOnly.length > 12) {
        processedValue = digitsOnly.substring(0, 12);
      }
    }
    
    setContactInfo(processedValue);
    
    // Clear validation error if input is empty
    if (!processedValue.trim()) {
      setValidationError(null);
      return;
    }
    
    // Perform real-time validation
    const validation = validateContactInfo(processedValue, selectedContactMethod, countryCode);
    setValidationError(validation.isValid ? null : validation.error);
  };

  const handleSendOtp = async (): Promise<void> => {
    console.log('handleSendOtp called with:', {
      contactInfo,
      selectedContactMethod,
      countryCode,
      username
    });
    
    setOtpState('requesting');
    setError(null);
    setIsPopupInactive(true);

    // Validate contact information using the validation function
    const validation = validateContactInfo(contactInfo, selectedContactMethod, countryCode);
    if (!validation.isValid) {
      setError(validation.error);
      setOtpState('failed');
      setIsPopupInactive(false);
      return;
    }

    const contact = selectedContactMethod === 'phone' 
      ? `${countryCode}${contactInfo}` 
      : contactInfo;

    console.log('Contact to send OTP to:', contact);

    try {
      // Get device ID if not already available
      let deviceId = await authService.getSecureItem('device_id');
      if (!deviceId) {
        const { getDeviceId } = await import('../services/DeviceInfoService.js');
        deviceId = await getDeviceId();
        await authService.setSecureItem('device_id', deviceId);
      }

      console.log('Device ID:', deviceId);

      await authService.setSecureItem('username', username);
      await authService.setSecureItem('user_id', contact);
      await authService.setSecureItem('device_id', deviceId);
      
      console.log('Calling authService.sendOtp with:', selectedContactMethod, contact);
      const result = await authService.sendOtp(selectedContactMethod, contact);
      console.log('sendOtp result:', result);
      
      if (result.success) {
        setSessionId(result.sessionId || null);
        console.log('OTP sent successfully, sessionId:', result.sessionId);
        console.log('Setting otpState to success');
        setError(null); // Clear any previous errors
        setOtpState('success');
        startCountdown(); // Start 3-minute countdown
        console.log('Countdown started, otpState should be success');
      } else {
        console.error('sendOtp failed:', result.error);
        setError(result.error || 'Failed to send OTP');
        setOtpState('failed');
      }
    } catch (err: any) {
      console.error('Exception in handleSendOtp:', err);
      setError(err.message || 'An unexpected error occurred.');
      setOtpState('failed');
    } finally {
      setIsPopupInactive(false);
      // Use setTimeout to log the state after it's been updated
      setTimeout(() => {
        console.log('Final state - otpState:', otpState, 'sessionId:', sessionId, 'isPopupInactive:', false);
      }, 0);
    }
  };
  
  const handleVerifyOtp = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!sessionId) {
      setError('Please send OTP first');
      setLoading(false);
      return;
    }

    if (!otp || otp.length !== 4) {
      setError('Please enter a valid 4-digit OTP');
      setLoading(false);
      return;
    }
    
    // Fix: Use let instead of const for variables that need to be reassigned
    let username = await authService.getSecureItem('username');
    let user_id = await authService.getSecureItem('user_id');
    let deviceId = await authService.getSecureItem('device_id');
    if (!user_id) {
      user_id = deviceId as string || 'guest';
    }

    if (!username ) {
      username = 'guest';
    }
    try {
      // Fix 1: Add proper null checks before the function calls
      if (!sessionId) {
        setError('Please send OTP first');
        setLoading(false);
        return;
      }

      if (!deviceId) {
        setError('Device ID not available');
        setLoading(false);
        return;
      }
      

      // Now TypeScript knows these are not null
      const result = await authService.verifyOtp(username, user_id, sessionId as string, otp);
      if (result.success) {
        console.log('OTP verified successfully');
        
        // Now register the user with device_id
        const userData = {
          username: username,
          contact: selectedContactMethod === 'phone' 
            ? `${countryCode}${contactInfo}` 
            : contactInfo,
          contact_method: selectedContactMethod
        };
        
        console.log('User registered successfully');
        
        // Notify parent component about successful authentication
        if (onAuthStateChange) {
          onAuthStateChange(true, false); // isLoggedIn: true, isOffline: false
        }
        
        onClose();
      } else {
        // Check for specific error message about multiple users
        if (result.error && result.error.includes('Multiple ID')) {
          console.log('Multiple ID error');
          // {detail: '400: Multiple ID [uid1,uid2] on same device is not allowed'}
          //"Multiple ID [<UID_1>,<UID_2>] on same device is not allowed
          
          const { uid1, uid2 } = parseUidsFromError(result.error);
          
          if (uid1 && uid2) {
            showCustomConfirmation(
              `🔄 ${uid1} is registered on this device.\n\n Do you want to replace the existing user with ${uid2} on this device ?`,
              async () => {
                // Make the callback async
                try {
                  let force_register = true;
                  const result = await authService.registerUser(username, user_id, deviceId as string);
                  if (result.success) {
                    console.log('User registered successfully');
                    // Notify parent component about successful authentication
                    if (onAuthStateChange) {
                      onAuthStateChange(true, false);
                    }
                    onClose();
                  } else {
                    console.error('User registration failed:', result.error);
                    setError(result.error || 'Failed to register user');
                    setOtpState('failed');
                    setCountdown(0);
                  }
                } catch (err: any) {
                  console.error('Force register failed:', err);
                  setError(err.message || 'An unexpected error occurred.');
                  setOtpState('failed');
                  setCountdown(0);
                }
              },
              () => {
                // Close action - just close the confirmation dialog
                console.log('User closed the confirmation dialog');
              }
            );
          } else {
            // Fallback for parsing errors
            setError('Multiple users detected on this device. Please contact support.');
            setOtpState('failed');
            setCountdown(0);
          }
        } else {
          setError(result.error || 'Failed to register user');
          // Reset OTP state to failed after verification attempt
          setOtpState('failed');
          setCountdown(0);
        }
      }
    } catch (err: any) {
      // Check for specific error message in exception as well
      if (err.message && err.message.includes('Multiple users on same device is not allowed')) {
        showCustomConfirmation(
          'This device is already registered with another account. Please use a different device or contact support.',
          () => {
            // Proceed action - close the registration popup
            onClose();
          },
          () => {
            // Close action - just close the confirmation dialog
            console.log('User closed the confirmation dialog');
          }
        );
      } else {
        setError(err.message || 'An unexpected error occurred.');
        // Reset OTP state to failed after verification attempt
        setOtpState('failed');
        setCountdown(0);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
      <div 
        className="popup-backdrop show" 
        onClick={isPopupInactive ? undefined : onClose}
        style={{ 
          cursor: isPopupInactive ? 'not-allowed' : 'pointer',
          opacity: isPopupInactive ? 0.8 : 1
        }}
      ></div>
      <div className="language-popup show">
        {isPopupInactive && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            borderRadius: '8px'
          }}>
            <div style={{
              textAlign: 'center',
              color: '#666'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                border: '4px solid #f3f3f3',
                borderTop: '4px solid #3498db',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 10px'
              }}></div>
              <div>Processing...</div>
            </div>
          </div>
        )}
        <div className="popup-wrapper">
          <span 
            className="close-btn" 
            onClick={isPopupInactive ? undefined : onClose}
            style={{ 
              cursor: isPopupInactive ? 'not-allowed' : 'pointer',
              opacity: isPopupInactive ? 0.5 : 1
            }}
          >×</span>
          <h3 style={{ textAlign: 'center' }}>{t('register', 'Register')}</h3>

          <form className="new-user-settings-form" onSubmit={handleVerifyOtp}>
            {/* Error Message */}
            {error && (
              <div className="error-message" style={{ 
                color: 'red', 
                marginBottom: '10px', 
                textAlign: 'center',
                fontSize: '14px'
              }}>
                {error}
              </div>
            )}

            {/* Username Input */}
            <div className="form-group">
              <div className="icon">
                <i className="icon-user" style={{ marginRight: '8px' }}></i>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t('username', 'Username')}
                  disabled={isPopupInactive}
                />
              </div>
            </div>

            {/* Contact Info Input */}
            <div className="form-group contact-input-group">
              <div
                className="country-code-select"
                onClick={isPopupInactive ? undefined : () => setIsCountryPopupVisible(true)}
                style={{ 
                  cursor: isPopupInactive ? 'not-allowed' : 'pointer',
                  opacity: isPopupInactive ? 0.5 : 1
                }}
              >
                {selectedContactMethod === 'email' ? (
                  <i className="icon icon-email" />
                ) : (
                  <span>{getFlagEmoji(countryCodes[countryCode])}</span>
                )}
              </div>
              
              {selectedContactMethod === 'phone' ? (
                <input
                  type="tel"
                  className="contact-input"
                  value={contactInfo}
                  onChange={(e) => handleContactInfoChange(e.target.value)}
                  placeholder="Enter phone number (10-12 digits)"
                  maxLength={15}
                  disabled={isPopupInactive}
                  style={{
                    borderColor: validationError ? '#ff4444' : contactInfo.trim() ? '#4CAF50' : '#ddd'
                  }}
                />
              ) : (
                <input
                  type="email"
                  className="contact-input"
                  value={contactInfo}
                  onChange={(e) => handleContactInfoChange(e.target.value)}
                  placeholder={t('email', 'Email')}
                  disabled={isPopupInactive}
                  style={{
                    borderColor: validationError ? '#ff4444' : contactInfo.trim() ? '#4CAF50' : '#ddd'
                  }}
                />
              )}
            </div>
            
            {/* Validation Error Message */}
            {validationError && (
              <div className="validation-error" style={{ 
                color: '#ff4444', 
                marginTop: '5px', 
                fontSize: '12px',
                textAlign: 'left'
              }}>
                {validationError}
              </div>
            )}
            
            {/* Phone Number Help Text */}
            {selectedContactMethod === 'phone' && !validationError && contactInfo.trim() && (
              <div className="help-text" style={{ 
                color: '#666', 
                marginTop: '5px', 
                fontSize: '11px',
                textAlign: 'left'
              }}>
                ✓ Phone number format is correct
              </div>
            )}

            {/* OTP Section */}
            <fieldset>
              <legend>{t('otp_label', 'O.T.P')}</legend>
              <div className="form-otp">
                <button 
                  type="button" 
                  className="button-ad" 
                  onClick={handleSendOtp}
                  disabled={isPopupInactive || !contactInfo.trim() || !!validationError || otpState === 'success'}
                >
                  {otpState === 'requesting' ? 'Requesting...' : 
                   otpState === 'success' ? formatTime(countdown) :
                   otpState === 'failed' ? 'Re-Send OTP' :
                   t('sendotp', 'Send OTP')}
                </button>
                {(() => {
                  const isDisabled = isPopupInactive || !sessionId || otpState !== 'success';
                  return (
                    <input
                      type="text"
                      className="otp-input"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="_ _ _ _"
                      maxLength={4}
                      disabled={isDisabled}
                    />
                  );
                })()}
                <button 
                  type="submit" 
                  className="button-ad"
                  disabled={isPopupInactive || !sessionId || !otp || otp.length !== 4 || otpState !== 'success'}
                >
                  {loading ? 'Verifying...' : t('verifyotp', 'Verify OTP')}
                </button>
              </div>
            </fieldset>
          </form>
        </div>
      </div>
      
      {/* Conditionally render the new popup */}
      {isCountryPopupVisible && (
        <CountryCodePopup
          isOpen={isCountryPopupVisible}
          options={dropdownOptions}
          onClose={() => setIsCountryPopupVisible(false)}
          onSelect={(option) => {
            setCountryCode(option.value);
            setSelectedContactMethod(option.value === '@' ? 'email' : 'phone');
            setContactInfo('');
          }}
        />
      )}
    </>
  );
};

export default RegistrationPopup;
