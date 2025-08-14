import React, { useState, useEffect } from 'react';
import { getFullDeviceInfo } from '../services/DeviceInfoService';
import '../css/layout.css'; // Use layout.css for styling
import '../css/common.css';

// Type definitions
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

interface DeviceInfoPopupProps {
  onClose: () => void;
}

const formatLabel = (key: string): string => {
  return key.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
};

const DeviceInfoPopup: React.FC<DeviceInfoPopupProps> = ({ onClose }) => {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchInfo = async (): Promise<void> => {
      try {
        setLoading(true);
        setError(null);
        const info: DeviceInfo = await getFullDeviceInfo();
        setDeviceInfo(info);
      } catch (err: any) {
        setError('Failed to fetch device information.');
        console.error('Error fetching device info:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchInfo();
  }, []);

  const handleClose = (): void => {
    onClose();
  };

  const renderDeviceInfo = (): JSX.Element | null => {
    if (!deviceInfo) return null;

    return (
      <>
        <div className="device-info-section">
          <div className="info-item">
            <span className="info-label">Device ID:</span>
            <span className="info-value">{deviceInfo.device_id || 'N/A'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Device Type:</span>
            <span className="info-value">{deviceInfo.device_type}</span>
          </div>
        </div>
        
        <div className="device-details-section">
          <h4 style={{ marginTop: 0, marginBottom: '10px' }}>Additional Details</h4>
          {Object.entries(deviceInfo).map(([key, value]) => {
            if (key !== 'device_id' && key !== 'device_type') {
              return (
                <div className="detail-item" key={key}>
                  <span className="detail-label">{formatLabel(key)}</span>
                  <span className="detail-value">{String(value)}</span>
                </div>
              );
            }
            return null;
          })}
        </div>
      </>
    );
  };

  const renderContent = (): JSX.Element => {
    if (loading) {
      return <p>Loading device information...</p>;
    }

    if (error) {
      return <p className="error-message">{error}</p>;
    }

    return renderDeviceInfo() || <p>No device information available.</p>;
  };

  return (
    <div className="language-popup" style={{ display: 'block' }}>
      <div className="popup-wrapper">
        <span className="close-btn" onClick={handleClose}>×</span>
        <div className="popup-content">
          <h3 style={{ 
            marginTop: 0, 
            color: '#333', 
            textAlign: 'center' 
          }}>
            Device Information
          </h3>
          
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default DeviceInfoPopup;
