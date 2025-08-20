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
  const [draggedElement, setDraggedElement] = useState<HTMLElement | null>(null);

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

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent) => {
    setDraggedElement(e.currentTarget as HTMLElement);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('drag-over');
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('drag-over');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    
    if (draggedElement) {
      const targetContainer = e.currentTarget as HTMLElement;
      const sourceContainer = draggedElement.parentElement;
      
      if (sourceContainer && targetContainer !== sourceContainer) {
        // Move the element from source to target
        targetContainer.appendChild(draggedElement);
        setDraggedElement(null);
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

          {/* Individual Balance Card - 3x3 Grid */}
          {nidhiData && (
            <div style={{ padding: '5px', marginTop: '10px' }}>
              <div className="balance-card">
                <div className="individual-balance-grid">
                  {/* First Row */}
                  <div className="grid-row">
                    <div className="grid-cell account-name">
                      {t('accountHolder', 'Account Holder').substring(0, 10)}
                    </div>
                    <div className="grid-cell">
                      <button className="action-btn provide-btn">
                        {t('provide', 'Provide')}
                      </button>
                    </div>
                    <div className="grid-cell">
                      <button className="action-btn loan-btn">
                        {t('loan', 'Loan')}
                      </button>
                    </div>
                  </div>
                  
                  {/* Second Row */}
                  <div className="grid-row">
                    <div className="grid-cell deposit-cell" style={{ gridColumn: 'span 2', gridRow: 'span 2' }}>
                      <div className="deposit-info">
                        <div className="deposit-label">{t('deposit', 'Deposit')}</div>
                        <div className="deposit-amount">
                          {Array.isArray(countryCodes[countryCode]) ? countryCodes[countryCode][1] : '₹'}{nidhiData.nidhiBalance.toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="grid-cell principal-cell">
                      <div className="metric-info">
                        <div className="metric-label">{t('principal', 'Principal')}</div>
                        <div className="metric-value">
                          {Array.isArray(countryCodes[countryCode]) ? countryCodes[countryCode][1] : '₹'}{nidhiData.nidhiBalance.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Third Row */}
                  <div className="grid-row">
                    <div className="grid-cell roi-cell">
                      <div className="metric-info">
                        <div className="metric-label">ROI</div>
                        <div className="metric-value">{nidhiData.nidhiROI}%</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Project Card - 3x4 Grid */}
          {nidhiData && (
            <div style={{ padding: '5px', marginTop: '10px' }}>
              <div className="balance-card">
                <div className="project-grid">
                  {/* First Row - Headers */}
                  <div className="project-row">
                    <div className="project-cell header-cell">
                      {t('project', 'Project')}
                    </div>
                    <div className="project-cell header-cell">
                      {t('local', 'Local')}
                    </div>
                    <div className="project-cell header-cell">
                      {t('national', 'National')}
                    </div>
                    <div className="project-cell header-cell">
                      {t('international', 'Intl')}
                    </div>
                  </div>
                  
                  {/* Second Row - Investment Types */}
                  <div className="project-row">
                    <div className="project-cell investment-cell" style={{ gridColumn: 'span 2' }}>
                      {t('invest', 'Invest')}
                    </div>
                    <div className="project-cell investment-cell" style={{ gridColumn: 'span 2' }}>
                      {t('proposal', 'Proposal')}
                    </div>
                  </div>
                  
                  {/* Third Row - Project Icons */}
                  <div className="project-row">
                    <div className="project-cell icon-container" style={{ gridColumn: 'span 2' }}>
                      <div className="project-icons invested-icons" 
                           onDrop={handleDrop} 
                           onDragOver={handleDragOver}
                           onDragLeave={handleDragLeave}>
                        <div className="project-icon" draggable onDragStart={handleDragStart}>
                          <span className="icon">🏭</span>
                          <span className="icon-label">Factory</span>
                        </div>
                        <div className="project-icon" draggable onDragStart={handleDragStart}>
                          <span className="icon">🏢</span>
                          <span className="icon-label">Office</span>
                        </div>
                        <div className="project-icon" draggable onDragStart={handleDragStart}>
                          <span className="icon">🏗️</span>
                          <span className="icon-label">Construction</span>
                        </div>
                      </div>
                    </div>
                    <div className="project-cell icon-container" style={{ gridColumn: 'span 2' }}>
                      <div className="project-icons proposal-icons" 
                           onDrop={handleDrop} 
                           onDragOver={handleDragOver}
                           onDragLeave={handleDragLeave}>
                        <div className="project-icon" draggable onDragStart={handleDragStart}>
                          <span className="icon">🌱</span>
                          <span className="icon-label">Agriculture</span>
                        </div>
                        <div className="project-icon" draggable onDragStart={handleDragStart}>
                          <span className="icon">⚡</span>
                          <span className="icon-label">Energy</span>
                        </div>
                        <div className="project-icon" draggable onDragStart={handleDragStart}>
                          <span className="icon">🏥</span>
                          <span className="icon-label">Healthcare</span>
                        </div>
                        <div className="project-icon" draggable onDragStart={handleDragStart}>
                          <span className="icon">🎓</span>
                          <span className="icon-label">Education</span>
                        </div>
                      </div>
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
