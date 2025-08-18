import React, { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { countryCodes } from '../data/langData';
import '../css/language.css';
import '../css/newUserSettings.css';
import '../css/common.css';
import CountryCodePopup from './CountryCodePopup';

interface NidhiData {
  nidhiBalance: number;
  nidhiNPA: number;
  nidhiROI: number;
  nidhiLastUpdated: string;
}

interface NidhiPopupProps {
  onClose: () => void;
  onCurrencyChange?: (currencySymbol: string) => void;
}

const getFlagEmoji = (countryCode: string): string => {
  if (!countryCode || countryCode.length !== 2) return '';
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
};

const NidhiPopup: React.FC<NidhiPopupProps> = ({ onClose, onCurrencyChange }) => {
  const { t } = useTranslation();
  const [nidhiData, setNidhiData] = useState<NidhiData | null>(null);
  const [countryCode, setCountryCode] = useState<string>('+91');
  const [isCountryPopupVisible, setIsCountryPopupVisible] = useState<boolean>(false);

  const dropdownOptions = useMemo(() => {
    const options = Object.entries(countryCodes)
      .filter(([code]) => code !== 'email') // Remove email option
      .map(([code, country]) => {
        // Extract country code from array: ['us', '$'] -> 'us'
        const countryCode = Array.isArray(country) ? country[0] : country;
        const flag = getFlagEmoji(countryCode);
        return { value: code, label: `${code} ${flag}` };
      });
    
    // Sort with India first, then rest alphabetically
    const india = options.find(o => o.value === '+91');
    const rest = options.filter(o => o.value !== '+91').sort((a, b) => a.value.localeCompare(b.value));
    return [india, ...rest].filter(Boolean) as { value: string; label: string; }[];
  }, []);

  useEffect(() => {
    setNidhiData({
      nidhiBalance: 1000,
      nidhiNPA: 50,
      nidhiROI: 5.2,
      nidhiLastUpdated: new Date().toLocaleDateString(),
    });
  }, []);

  const handleCountrySelect = (option: { value: string; label: string }) => {
    setCountryCode(option.value);
    
    // Get the currency symbol for the selected country
    const countryData = countryCodes[option.value];
    if (countryData && Array.isArray(countryData) && countryData[1]) {
      const currencySymbol = countryData[1];
      // Notify parent component about currency change
      if (onCurrencyChange) {
        onCurrencyChange(currencySymbol);
      }
    }
  };

  return (
    <>
      <div className="popup-backdrop show" onClick={onClose}></div>
      <div className="language-popup show">
        <div className="popup-wrapper">
          <span className="close-btn" onClick={onClose}>×</span>
          
          {/* Header with Nidhi title and country selector */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: '10px',
            marginBottom: '20px'
          }}>
            <div
              className="country-code-select"
              onClick={() => setIsCountryPopupVisible(true)}
              style={{ 
                cursor: 'pointer',
                opacity: 1
              }}
            >
              <span>{getFlagEmoji(Array.isArray(countryCodes[countryCode]) ? countryCodes[countryCode][0] : countryCodes[countryCode])}</span>
            </div>
            <h3 style={{ margin: 0 }}>{t('nidhi', 'Nidhi')}</h3>
          </div>

          {/* Nidhi Data Display */}
          {nidhiData && (
            <div style={{ padding: '5px' }}>
              {/* Single Balance Card with all metrics */}
              <div className="balance-card">
                {/* Metrics Layout - Two Columns */}
                <div className="metrics-layout">
                  {/* First Column - Company Balance spanning two rows */}
                  <div className="balance-column">
                    <div className="balance-display">
                      <div className="balance-label-small">{t('deposit', 'Deposit')}</div>
                      <div className="balance-amount-small">
                        {Array.isArray(countryCodes[countryCode]) ? countryCodes[countryCode][1] : '₹'}{nidhiData.nidhiBalance.toLocaleString()}
                      </div>
                    </div>
                  </div>
                  
                  {/* Second Column - NPA and ROI in two rows */}
                  <div className="metrics-column">
                    <div className="metric-row">
                      <div className="metric-label">NPA</div>
                      <div className="metric-value">{nidhiData.nidhiNPA}%</div>
                    </div>
                    
                    <div className="metric-row">
                      <div className="metric-label">ROI</div>
                      <div className="metric-value">{nidhiData.nidhiROI}%</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Country Code Popup */}
      {isCountryPopupVisible && (
        <CountryCodePopup
          options={dropdownOptions}
          onClose={() => setIsCountryPopupVisible(false)}
          onSelect={handleCountrySelect}
        />
      )}
    </>
  );
};

export default NidhiPopup;
