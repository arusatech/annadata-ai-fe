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
import NidhiPopup from './NidhiPopup';

interface MenuContainerProps {
  isUserLoggedIn: boolean;
  isOffline: boolean;
  onAuthStateChange: (isLoggedIn: boolean, isOfflineMode: boolean) => void;
}

const MenuContainer: React.FC<MenuContainerProps> = ({ isUserLoggedIn, isOffline, onAuthStateChange }) => {
  const { t, i18n } = useTranslation();
  const [isLangPopupVisible, setIsLangPopupVisible] = useState(false);
  const [isDeviceInfoPopupVisible, setIsDeviceInfoPopupVisible] = useState(false);
  const [isNidhiPopupVisible, setIsNidhiPopupVisible] = useState(false);
  const [isRegistrationPopupVisible, setIsRegistrationPopupVisible] = useState(false);
  const [isSettingsPopupVisible, setIsSettingsPopupVisible] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<string>('+91'); // Default to India
  const [selectedCurrencySymbol, setSelectedCurrencySymbol] = useState<string>('₹'); // Default to Rupee

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

  // Function to get title with conditional AI styling
  const getTitleWithConditionalAI = () => {
    const baseTitle = t('title', 'AnnaData<sup>ai</sup>');
    
    if (isRetrying) {
      // Show AI in gray when retrying
      return baseTitle.replace('<sup>ai</sup>', '<sup class="ai-retrying" title="Retrying connection...">ai</sup>');
    } else if (isOffline) {
      // Show AI in red and clickable when offline
      return baseTitle.replace('<sup>ai</sup>', '<sup class="ai-offline" title="Click to retry server connection">ai</sup>');
    } else {
      // Show AI in black when online
      return baseTitle.replace('<sup>ai</sup>', '<sup class="ai-online" title="AI Online">ai</sup>');
    }
  };

  // Handle AI click for retry connection
  const handleAIRetryClick = () => {
    if (!isOffline || isRetrying) return;
    handleRetryConnection();
  };

  const toggleNidhiPopup = () => {
    setIsNidhiPopupVisible(!isNidhiPopupVisible);
  };

  const handleCurrencyChange = (currencySymbol: string) => {
    setSelectedCurrencySymbol(currencySymbol);
  };

  return (
    <div className="menu-container">
      <div className="menu-bar">
        <div className="menu-icon" id="tractor-icon" onClick={toggleDeviceInfoPopup}>
          <img src={tractorIcon} alt="Tractor icon" style={{ width: '32px', height: '32px', marginRight: '2px' }} />
        </div>
        <div 
          className="menu-title" 
          id="title" 
          data-default-message="AnnaData (ai)™" 
          style={{ textAlign: 'center', marginRight: '2px' }}
          onClick={(e) => {
            // Check if the clicked element is the AI superscript
            if (e.target instanceof HTMLElement && e.target.classList.contains('ai-offline')) {
              handleAIRetryClick();
            }
          }}
        >
          <span dangerouslySetInnerHTML={{ __html: getTitleWithConditionalAI() }} />
        </div>
        <div className="menu-icons">
          <div className="icon">
            <div 
              className={`nidhi-currency-button ${isOffline ? 'offline' : ''}`}
              onClick={toggleNidhiPopup}
              title={`Currency: ${selectedCurrencySymbol}`}
            >
              <span className="currency-symbol">{selectedCurrencySymbol}</span>
            </div>
          </div>
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

      {isNidhiPopupVisible && (
        <>
          <div className="popup-backdrop show" onClick={toggleNidhiPopup}></div>
          <NidhiPopup 
            onClose={toggleNidhiPopup} 
            onCurrencyChange={handleCurrencyChange}
          />
        </>
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
