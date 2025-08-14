import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { IonDatetime, IonModal } from '@ionic/react';
import '../css/style.css';
import '../css/icons.min.css';
import '../css/common.css';
import '../css/userSettings.css';
import AuthService from '../services/AuthService';

interface UserData {
  username: string;
  user_id: string;
  date_of_birth: Date | null;
  gender: string;
  location: string;
  subscription: string;
  insurance: string;
}

interface SettingsPopupProps {
  onClose: () => void;
  onAuthStateChange?: (isAuthenticated: boolean, userExists: boolean) => void;
}

const SettingsPopup: React.FC<SettingsPopupProps> = ({ onClose, onAuthStateChange }) => {
  const { t, i18n } = useTranslation(); // Add i18n to get current language
  const [userData, setUserData] = useState<UserData>({
    username: '',
    user_id: '',
    date_of_birth: null, // Changed to store Date object
    gender: '',
    location: '',
    subscription: 'trial',
    insurance: 'crop'
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [pass, setPass] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false);
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);

  // Generate year options (current year to 100 years back)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 100 }, (_, i) => currentYear - i);

  useEffect(() => {
    loadUserSettings();
  }, []);

  const loadUserSettings = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      
      const user_id = await AuthService.getUserId();
      if (!user_id) {
        setError('No user ID found');
        return;
      }
      
      const profile = await AuthService.getProfile(user_id);
      if (profile.success && profile.data) {
        const data = profile.data.data || profile.data;
        
        // Parse date of birth if available
        let dateOfBirth: Date | null = null;
        
        if (data.date_of_birth) {
          try {
            dateOfBirth = new Date(data.date_of_birth);
            // Validate if it's a valid date
            if (isNaN(dateOfBirth.getTime())) {
              dateOfBirth = null;
            }
          } catch (e) {
            console.error('Error parsing date of birth:', e);
            dateOfBirth = null;
          }
        }
        
        setUserData({
          username: data.username || '',
          user_id: data.user_id || '',
          date_of_birth: dateOfBirth,
          gender: data.gender || '',
          location: data.location_name || '',
          subscription: data.subscription || 'trial',
          insurance: data.insurance || 'crop'
        });
      }
    } catch (err) {
      setError('Failed to load user settings');
      console.error('Error loading user settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof UserData, value: string | Date | null): void => {
    setUserData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Language to locale mapping
  const getLocaleFromLanguage = (languageCode: string): string => {
    const localeMap: { [key: string]: string } = {
      'en': 'en-US',
      'hi': 'hi-IN',
      'bn': 'bn-IN',
      'ml': 'ml-IN',
      'ta': 'ta-IN',
      'te': 'te-IN',
      'kn': 'kn-IN',
      'gu': 'gu-IN',
      'mr': 'mr-IN',
      'pa': 'pa-IN',
      'or': 'or-IN',
      'as': 'as-IN',
      'ne': 'ne-NP',
      'si': 'si-LK',
      'gom': 'gom-IN',
      'mni': 'mni-IN',
      'ar': 'ar-SA',
      'zh': 'zh-CN',
      'ja': 'ja-JP',
      'ko': 'ko-KR',
      'fr': 'fr-FR',
      'de': 'de-DE',
      'es': 'es-ES',
      'pt': 'pt-BR',
      'it': 'it-IT',
      'ru': 'ru-RU',
      'pl': 'pl-PL',
      'tr': 'tr-TR',
      'uk': 'uk-UA',
      'he': 'he-IL',
      'el': 'el-GR',
      'sd': 'sd-PK'
    };
    
    return localeMap[languageCode] || 'en-US'; // Fallback to en-US
  };

  // Updated function to handle datetime picker using IonDatetime
  const handleDateOfBirthPicker = (): void => {
    setShowDatePicker(true);
  };

  const handleDateChange = (event: CustomEvent): void => {
    const selectedDate = new Date(event.detail.value);
    setUserData(prev => ({
      ...prev,
      date_of_birth: selectedDate
    }));
    setShowDatePicker(false);
  };

  const handleDateCancel = (): void => {
    setShowDatePicker(false);
  };

  const handleSaveSettings = async (): Promise<void> => {
    try {
      setSaving(true);
      setError(null);
      setPass(null);
      
      // Format date of birth
      let dateOfBirth: string | null = null;
      if (userData.date_of_birth) {
        dateOfBirth = userData.date_of_birth.toISOString();
      }
      
      const { getFullDeviceInfo } = await import('../services/DeviceInfoService.js');
      // Update the device location extraction to handle the actual DeviceInfo structure
      const deviceDetails = await getFullDeviceInfo();
      const device_location = {
        latitude: (deviceDetails as any).latitude || 0, // Use type assertion or provide default
        longitude: (deviceDetails as any).longitude || 0
      };
      
      const updateData = {
        username: userData.username,
        user_id: userData.user_id || await AuthService.getSecureItem('user_id'),
        device_id: await AuthService.getSecureItem('device_id'),
        role: 'user',
        date_of_birth: dateOfBirth,
        gender: userData.gender,
        location: device_location,
        location_name: userData.location,
        subscription: userData.subscription,
        insurance: userData.insurance,
        device_details: deviceDetails
      };
      
      const result = await AuthService.updateProfile(updateData);
      
      if (result.success) {
        setPass('User settings updated successfully!');
      } else {
        if (result.error && result.error.includes('No refresh token available')) {
          setError('Your session has expired. Please log in again.');
          setTimeout(() => {
            if (onAuthStateChange) {
              onAuthStateChange(false, false);
            }
            onClose();
          }, 2000);
        } else {
          setError(result.error || 'Failed to update settings');
        }
      }
    } catch (err: any) {
      if (err.message && err.message.includes('No refresh token available')) {
        setError('Your session has expired. Please log in again.');
        setTimeout(() => {
          if (onAuthStateChange) {
            onAuthStateChange(false, false);
          }
          onClose();
        }, 2000);
      } else {
        setError('Failed to save settings. Please try again.');
        console.error('Error saving user settings:', err);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async (): Promise<void> => {
    if (isLoggingOut) return;
    
    setIsLoggingOut(true);
    try {
      await AuthService.logout();
      
      // Notify parent component about auth state change
      if (onAuthStateChange) {
        onAuthStateChange(false, false);
      }
      
      onClose();
    } catch (error) {
      console.error('Error during logout:', error);
      setError('Failed to logout. Please try again.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Format date for display - also make this dynamic
  const formatDateForDisplay = (date: Date | null): string => {
    if (!date) return t('notset', 'Not set');
    
    const currentLanguage = i18n.language || 'en';
    const locale = getLocaleFromLanguage(currentLanguage);
    
    return date.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <>
      <div className="popup-backdrop show" onClick={onClose}></div>
      <div className="language-popup show settings-popup">
        <div className="popup-wrapper">
          <span className="close-btn" onClick={onClose}>×</span>
          
          <div className="user-settings-header">
            <h3 id="settings-title" style={{ textAlign: 'center' }}>{t('settings', 'User Settings')}</h3>
          </div>

          {/* Success Message */}
          {pass && (
            <div className="success-message" style={{ 
              color: '#28a745', 
              marginBottom: '10px', 
              textAlign: 'center',
              fontSize: '14px',
              fontWeight: '500'
            }}>
              {pass}
            </div>
          )}

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

          <div className="user-settings-form">
            {/* Username */}
            <div className="form-group">
              <div className="icon">
                <i className="icon-user"></i>
                <input 
                  type="text" 
                  id="username" 
                  name="username" 
                  placeholder={t('username', 'Username')}
                  className="username-input"
                  value={userData.username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>
            
            {/* User ID (Read-only) */}
            <div className="form-group">
              <div className="icon">
                <i className="icon-agriculture"></i>
                <input 
                  type="text" 
                  id="user-id" 
                  name="user-id" 
                  value={userData.user_id} 
                  readOnly
                  disabled={loading}
                />
              </div>
            </div>
            
            {/* Date of Birth - Updated with IonDatetime */}
            <fieldset>
              <legend id="label-dateofbirth">{t('dateofbirth', 'Date of Birth')}</legend>
              <div className="date-picker-container">
                <button 
                  type="button"
                  className="date-picker-button"
                  onClick={handleDateOfBirthPicker}
                  aria-describedby="label-dateofbirth"
                >
                  <span className="date-display">
                    {formatDateForDisplay(userData.date_of_birth)}
                  </span>
                  <span className="date-picker-icon">📅</span>
                </button>
              </div>
            </fieldset>

            {/* IonDatetime Modal */}
            <IonModal isOpen={showDatePicker} onDidDismiss={handleDateCancel}>
              <IonDatetime
                value={userData.date_of_birth?.toISOString()}
                onIonChange={handleDateChange}
                onIonCancel={handleDateCancel}
                presentation="date-time"
                showDefaultButtons={true}
                doneText={t('ok', 'OK')}
                cancelText={t('cancel', 'Cancel')}
                locale={getLocaleFromLanguage(i18n.language || 'en')}
                max={new Date().toISOString()}
                min={new Date(1900, 0, 1).toISOString()}
              />
            </IonModal>
            
            {/* Gender */}
            <fieldset>
              <legend id="label-gender">{t('gender', 'Gender')}</legend>
              <div className="radio-group">
                <input 
                  name="gender" 
                  type="radio" 
                  value="male" 
                  checked={userData.gender === "male"}
                  onChange={(e) => handleInputChange('gender', e.target.value)}
                />
                <span id="label-male">{t('male', 'Male')}</span>
                <input 
                  name="gender" 
                  type="radio" 
                  value="female" 
                  checked={userData.gender === "female"}
                  onChange={(e) => handleInputChange('gender', e.target.value)}
                />
                <span id="label-female">{t('female', 'Female')}</span>
              </div>
            </fieldset>

            {/* Location */}
            <fieldset>
              <legend id="label-location">{t('location', 'Location')}</legend>
              <div className="form-group">
                <div className="icon">
                  <i className="icon-location"></i>
                  <input 
                    type="text" 
                    id="location" 
                    name="location" 
                    placeholder={t('location', 'Location')}
                    className="location-input"
                    value={userData.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                  />
                </div>
              </div>
            </fieldset>

            {/* Subscription */}
            <fieldset>
              <legend id="label-subscribe">{t('subscribe', 'Subscribe')}</legend>
              <div className="form-group">
                <div className="icon">
                  <i className="icon-bell" style={{ color: '#000000', marginRight: '4px' }}></i>
                  <div className="subscription-selection">
                    <em id="subscription-status" className="subscription-status" style={{ 
                      fontWeight: 'bold', 
                      fontSize: '1.0em', 
                      color: '#0d0e0d', 
                      marginLeft: '10px',
                      marginRight: '10px' 
                    }}>
                      {userData.subscription === 'trial' ? t('annually', 'Pay Annually (₹999 or USD $12)') : userData.subscription}
                    </em>
                  </div>
                </div>
              </div>
            </fieldset>
         
            {/* Insurance */}
            <fieldset>
              <legend id="label-insurance">{t('insurance', 'Insurance')}</legend>
              <div className="form-group">
                <div className="icon">
                  <i className="icon-shield" style={{ color: '#000000' }}></i>
                  <div className="insurance-selection">
                    <em id="label-cropinsurance" style={{ 
                      fontWeight: 'bold', 
                      fontSize: '1.0em', 
                      color: '#0d0e0d', 
                      marginLeft: '10px',
                      marginRight: '10px' 
                    }}>
                      {t('cropinsurance', 'Crop Insurance')}
                    </em>
                  </div>
                </div>
              </div>
            </fieldset>
            
            {/* Form Actions */}
            <div className="form-actions">
              <button 
                type="submit" 
                className="button-ad" 
                id="btn-save" 
                onClick={handleSaveSettings}
                disabled={saving}
              >
                {saving ? 'Saving...' : t('save', 'Save')}
              </button>
              <button 
                type="button" 
                className="button-ad" 
                id="btn-logout" 
                onClick={handleLogout}
                disabled={isLoggingOut}
                style={{ backgroundColor: '#dc3545', borderColor: '#dc3545' }}
              >
                {isLoggingOut ? 'Logging out...' : t('logout', 'Logout')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SettingsPopup;
