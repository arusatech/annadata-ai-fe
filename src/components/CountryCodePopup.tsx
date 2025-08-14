import React from 'react';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonButton,
  IonIcon,
  IonSearchbar
} from '@ionic/react';
import { closeOutline, searchOutline } from 'ionicons/icons';
import '../css/language.css'; // Re-using styles for consistency

interface CountryOption {
  value: string;
  label: string;
  code?: string;
  flag?: string;
}

interface CountryCodePopupProps {
  isOpen: boolean;
  options: CountryOption[];
  onSelect: (option: CountryOption) => void;
  onClose: () => void;
  title?: string;
}

const CountryCodePopup: React.FC<CountryCodePopupProps> = ({ 
  isOpen, 
  options, 
  onSelect, 
  onClose, 
  title = "Select Country Code" 
}) => {
  const [searchTerm, setSearchTerm] = React.useState<string>('');

  const handleSelect = (option: CountryOption): void => {
    onSelect(option); // Pass the selected option back to the parent
    onClose(); // Close the popup after selection
  };

  const filteredOptions = React.useMemo(() => {
    if (!searchTerm) return options;
    return options.filter(option => 
      option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      option.value.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (option.code && option.code.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [options, searchTerm]);

  const handleSearchChange = (event: CustomEvent): void => {
    setSearchTerm(event.detail.value || '');
  };

  const handleClose = (): void => {
    setSearchTerm(''); // Clear search when closing
    onClose();
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={handleClose}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{title}</IonTitle>
          <IonButton slot="end" fill="clear" onClick={handleClose}>
            <IonIcon icon={closeOutline} />
          </IonButton>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        {/* Search Bar */}
        <IonSearchbar
          value={searchTerm}
          onIonInput={handleSearchChange}
          placeholder="Search countries..."
          showClearButton="focus"
          debounce={300}
        />

        {/* Country List */}
        <IonList>
          {filteredOptions.map((option) => (
            <IonItem
              key={option.value}
              button
              onClick={() => handleSelect(option)}
              className="country-option"
            >
              {option.flag && (
                <span style={{ marginRight: '12px', fontSize: '1.2em' }}>
                  {option.flag}
                </span>
              )}
              <IonLabel>
                <h2>{option.label}</h2>
                {option.code && (
                  <p style={{ color: 'var(--ion-color-medium)' }}>
                    {option.code}
                  </p>
                )}
              </IonLabel>
            </IonItem>
          ))}
        </IonList>

        {/* No results message */}
        {filteredOptions.length === 0 && searchTerm && (
          <div style={{ 
            textAlign: 'center', 
            padding: '20px',
            color: 'var(--ion-color-medium)'
          }}>
            No countries found matching "{searchTerm}"
          </div>
        )}
      </IonContent>
    </IonModal>
  );
};

export default CountryCodePopup;
