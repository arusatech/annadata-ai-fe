import React from 'react';
import '../css/language.css'; // Re-using styles for consistency

// Type definitions
interface CountryOption {
  value: string;
  label: string;
  code?: string;
  flag?: string;
}

interface CountryCodePopupProps {
  options: CountryOption[];
  onSelect: (option: CountryOption) => void;
  onClose: () => void;
}

const CountryCodePopup: React.FC<CountryCodePopupProps> = ({ 
  options, 
  onSelect, 
  onClose 
}) => {
  const handleSelect = (option: CountryOption): void => {
    onSelect(option); // Pass the selected option back to the parent
    onClose(); // Close the popup after selection
  };

  return (
    <>
      <div className="popup-backdrop show" onClick={onClose}></div>
      {/* Make the popup scrollable for the long list of countries */}
      <div className="language-popup show" style={{ height: '70vh', overflowY: 'auto', width: '100%', maxWidth: '100px' }}>
        <div className="popup-wrapper">
          <span className="close-btn" onClick={onClose}>×</span>
          <div className="country-list">
            {options.map((option: CountryOption) => (
              <div
                key={option.value}
                className="lang-option" // Re-use style from language popup
                onClick={() => handleSelect(option)}
              >
                {option.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default CountryCodePopup;
