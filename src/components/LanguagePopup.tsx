import React from 'react';
import { langOptions } from '../data/langData';
import '../css/language.css';
import '../css/common.css'; // Import common styles
import AuthService from '../services/AuthService';

// Type definitions
interface LanguageOption {
  code: string;
  name: string;
  nativeName?: string;
  flag?: string;
}

interface LanguagePopupProps {
  onSelectLanguage: (selectedLang: LanguageOption) => void;
  onClose: () => void;
}

interface LangOptionsType {
  [key: string]: {
    name: string;
    nativeName?: string;
    flag?: string;
  };
}

const LanguagePopup: React.FC<LanguagePopupProps> = ({ onSelectLanguage, onClose }) => {
  const handleSelect = async (langCode: string): Promise<void> => {
    try {
      const selectedLang: LanguageOption = { 
        code: langCode, 
        ...(langOptions as LangOptionsType)[langCode] 
      };
      
      onSelectLanguage(selectedLang); // This will be used later to update the app state
      await AuthService.setSecureItem('language', selectedLang.code);
      console.log('Selected Language:', selectedLang.name);
      onClose();
    } catch (error) {
      console.error('Error selecting language:', error);
    }
  };

  const handleClose = (): void => {
    onClose();
  };

  const languageCodes: string[] = Object.keys(langOptions);
  const itemsPerColumn: number = Math.ceil(languageCodes.length / 3);
  const columns: string[][] = [
    languageCodes.slice(0, itemsPerColumn),
    languageCodes.slice(itemsPerColumn, itemsPerColumn * 2),
    languageCodes.slice(itemsPerColumn * 2),
  ];

  const renderLanguageOption = (code: string): React.ReactElement => {
    const langData = (langOptions as LangOptionsType)[code];
    return (
      <div
        key={code}
        className="lang-option"
        onClick={() => handleSelect(code)}
        role="button"
        tabIndex={0}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleSelect(code);
          }
        }}
      >
        {langData?.name || code}
      </div>
    );
  };

  const renderColumn = (column: string[], colIndex: number): React.ReactElement => {
    return (
      <td key={colIndex}>
        {column.map((code: string) => renderLanguageOption(code))}
      </td>
    );
  };

  return (
    <div className="language-popup show">
      <div className="popup-wrapper">
        <span 
          className="close-btn" 
          onClick={handleClose}
          role="button"
          tabIndex={0}
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleClose();
            }
          }}
        >
          ×
        </span>
        <table className="language-table">
          <tbody>
            <tr>
              {columns.map((column: string[], colIndex: number) => 
                renderColumn(column, colIndex)
              )}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LanguagePopup;
