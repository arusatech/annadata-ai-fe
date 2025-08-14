import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../css/menu.css';
import '../css/icons.css'; // Add this
import '../css/utilities.css'; // Add this
import '../css/style.css';
import '../css/icons.min.css';
import '../css/common.css';
import tractorIcon from '../assets/img/tractor.png';
import LanguagePopup from './LanguagePopup';
import DeviceInfoPopup from './DeviceInfoPopup';
import RegistrationPopup from './RegistrationPopup';
import SettingsPopup from './SettingsPopup';
import AuthService from '../services/AuthService';

interface MenuContainerProps {
  isUserLoggedIn: boolean;
  isOffline: boolean;
  onAuthStateChange: (isLoggedIn: boolean, isOfflineMode: boolean) => void;
}

const MenuContainer: React.FC<MenuContainerProps> = ({ isUserLoggedIn, isOffline, onAuthStateChange }) => {
  const { t, i18n } = useTranslation();
  const [isLangPopupVisible, setIsLangPopupVisible] = useState(false);
  const [isDeviceInfoPopupVisible, setIsDeviceInfoPopupVisible] = useState(false);
  const [isRegistrationPopupVisible, setIsRegistrationPopupVisible] = useState(false);
  const [isSettingsPopupVisible, setIsSettingsPopupVisible] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const toggleLanguageDropdown = () => {
    setIsLangPopupVisible(!isLangPopupVisible);
  };

  const toggleDeviceInfoPopup = () => {
    setIsDeviceInfoPopupVisible(!isDeviceInfoPopupVisible);
  };

  const handleSelectLanguage = (language: { code: string }) => {
    i18n.changeLanguage(language.code);
  };
  
  const toggleNewUserDropdown = () => {
    setIsRegistrationPopupVisible(true);
  };

  const toggleUserDropdown = () => {
    setIsSettingsPopupVisible(true);
  };

  const handleSettingsAuthStateChange = (isLoggedIn: boolean, isOfflineMode: boolean) => {
    if (onAuthStateChange) {
      onAuthStateChange(isLoggedIn, isOfflineMode);
    }
  };

  const handleRetryConnection = async () => {
    if (isRetrying) return; // Prevent multiple retries
    
    setIsRetrying(true);
    console.log('🔄 User triggered server connection retry...');
    
    try {
      const result = await AuthService.retryServerConnection() as any;
      console.log('🔄 Retry result:', result);
      
      if (result.success && !result.offline) {
        // Notify parent component about auth state change
        if (onAuthStateChange) {
          const isLoggedIn = result.userExists && !!result.token;
          onAuthStateChange(isLoggedIn, false); // isLoggedIn: based on token, isOffline: false
        }
      } else if (result.offline) {
        // Still offline - notify with correct user state
        if (onAuthStateChange) {
          const isLoggedIn = result.userExists && !!result.token;
          onAuthStateChange(isLoggedIn, true); // isLoggedIn: based on token, isOffline: true
        }
      }
    } catch (error) {
      console.error('❌ Error during retry:', error);
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="menu-container">
      <div className="menu-bar">
        <div className="menu-icon" id="tractor-icon" onClick={toggleDeviceInfoPopup}>
          <img src={tractorIcon} alt="Tractor icon" style={{ width: '32px', height: '32px', marginRight: '2px' }} />
        </div>
        <div className="menu-title" id="title" data-default-message="AnnaData (ai)™" style={{ textAlign: 'left', marginRight: '2px' }}>
          {t('title', 'AnnaData (ai)℠')}
          {isOffline && (
            <span 
              onClick={handleRetryConnection}
              style={{ 
                fontSize: '12px', 
                color: isRetrying ? '#ccc' : '#ff6b35', 
                marginLeft: '8px',
                fontWeight: 'normal',
                cursor: isRetrying ? 'not-allowed' : 'pointer',
                textDecoration: isRetrying ? 'none' : 'underline',
                userSelect: 'none'
              }}
              title={isRetrying ? 'Retrying connection...' : 'Click to retry server connection'}
            >
              {isRetrying ? '(Retrying...)' : '(Offline)'}
            </span>
          )}
        </div>
        <div className="menu-icons">
          <div id="user-status-icon" className="icon">
            {isUserLoggedIn ? (
              <i 
                id="settings-icon" 
                className="icon-account-cog" 
                onClick={toggleUserDropdown} 
                style={{ display: 'block', color: isOffline ? '#ff6b35' : '#007bff' }}
                title={isOffline ? 'Settings (Offline)' : 'Settings'}
              ></i>
            ) : (
              <i 
                id="join-icon" 
                className="icon-user-plus-red" 
                onClick={toggleNewUserDropdown} 
                style={{ display: 'block', color: '#ff0000' }}
                title={isOffline ? 'Join (Offline)' : 'Join'}
              ></i>
            )}
          </div>
          <div className="icon"><i className="icon-history"></i></div>
          <div className="icon" onClick={toggleLanguageDropdown}>
            <i className="" id="langIcon">{t('initial', 'E')}</i>
          </div>
        </div>
      </div>
      {isLangPopupVisible && <LanguagePopup onSelectLanguage={handleSelectLanguage} onClose={() => setIsLangPopupVisible(false)} />}
      
      {isRegistrationPopupVisible && (
        <RegistrationPopup 
          onClose={() => setIsRegistrationPopupVisible(false)} 
          onAuthStateChange={handleSettingsAuthStateChange}
        />
      )}

      {isSettingsPopupVisible && (
        <SettingsPopup 
          onClose={() => setIsSettingsPopupVisible(false)} 
          onAuthStateChange={handleSettingsAuthStateChange}
        />
      )}

      {isDeviceInfoPopupVisible && (
        <>
          <div className="popup-backdrop show" onClick={toggleDeviceInfoPopup}></div>
          <DeviceInfoPopup onClose={toggleDeviceInfoPopup} />
        </>
      )}
    </div>
  );
};

export default MenuContainer;
