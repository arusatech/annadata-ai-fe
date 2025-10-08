import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '../css/redaction-preview.css';

interface RedactedArea {
  id: string;
  type: 'text' | 'image' | 'metadata';
  originalContent: string;
  redactedContent: string;
  boundingBox?: [number, number, number, number];
  pageNumber?: number;
  confidence: number;
  category: string;
}

interface RedactionSummary {
  totalRedactions: number;
  piiRedactions: number;
  financialRedactions: number;
  medicalRedactions: number;
  legalRedactions: number;
  otherRedactions: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
}

interface RedactionResult {
  originalText: string;
  redactedText: string;
  redactedAreas: RedactedArea[];
  extractedText: string;
  confidence: number;
  redactionSummary: RedactionSummary;
}

interface RedactionPreviewProps {
  redactionResult: RedactionResult;
  fileName: string;
  fileType: string;
  onConfirm: (result: RedactionResult) => void;
  onCancel: () => void;
  onModifySettings?: () => void;
}

const RedactionPreview: React.FC<RedactionPreviewProps> = ({
  redactionResult,
  fileName,
  fileType,
  onConfirm,
  onCancel,
  onModifySettings
}) => {
  const { t } = useTranslation();
  const [selectedTab, setSelectedTab] = useState<'summary' | 'details' | 'text'>('summary');
  const [showConfirmation, setShowConfirmation] = useState(false);

  const getCategoryIcon = (category: string): string => {
    switch (category) {
      case 'pii':
        return '👤';
      case 'financial':
        return '💰';
      case 'medical':
        return '🏥';
      case 'legal':
        return '⚖️';
      default:
        return '🔒';
    }
  };

  const getCategoryName = (category: string): string => {
    switch (category) {
      case 'pii':
        return 'Personal Information';
      case 'financial':
        return 'Financial Data';
      case 'medical':
        return 'Medical Information';
      case 'legal':
        return 'Legal Information';
      default:
        return 'Other';
    }
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return 'high-confidence';
    if (confidence >= 0.6) return 'medium-confidence';
    return 'low-confidence';
  };

  const getConfidenceLabel = (confidence: number): string => {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.6) return 'Medium';
    return 'Low';
  };

  const handleConfirm = () => {
    setShowConfirmation(true);
  };

  const handleFinalConfirm = () => {
    onConfirm(redactionResult);
  };

  const handleFinalCancel = () => {
    setShowConfirmation(false);
  };

  return (
    <div className="redaction-preview-overlay">
      <div className="redaction-preview-modal">
        <div className="redaction-preview-header">
          <div className="file-info">
            <h3>🔒 Sensitive Content Review</h3>
            <p className="file-details">
              <strong>{fileName}</strong> ({fileType.toUpperCase()})
            </p>
          </div>
          <button 
            className="close-btn"
            onClick={onCancel}
            title="Close"
          >
            ×
          </button>
        </div>

        {!showConfirmation ? (
          <>
            <div className="redaction-preview-tabs">
              <button 
                className={`tab ${selectedTab === 'summary' ? 'active' : ''}`}
                onClick={() => setSelectedTab('summary')}
              >
                📊 Summary
              </button>
              <button 
                className={`tab ${selectedTab === 'details' ? 'active' : ''}`}
                onClick={() => setSelectedTab('details')}
              >
                🔍 Details ({redactionResult.redactedAreas.length})
              </button>
              <button 
                className={`tab ${selectedTab === 'text' ? 'active' : ''}`}
                onClick={() => setSelectedTab('text')}
              >
                📄 Text Preview
              </button>
            </div>

            <div className="redaction-preview-content">
              {selectedTab === 'summary' && (
                <div className="summary-tab">
                  <div className="redaction-stats">
                    <div className="stat-card">
                      <div className="stat-number">{redactionResult.redactionSummary.totalRedactions}</div>
                      <div className="stat-label">Total Redactions</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-number">{Math.round(redactionResult.confidence * 100)}%</div>
                      <div className="stat-label">Confidence</div>
                    </div>
                  </div>

                  <div className="category-breakdown">
                    <h4>Redaction Categories</h4>
                    <div className="category-list">
                      {redactionResult.redactionSummary.piiRedactions > 0 && (
                        <div className="category-item">
                          <span className="category-icon">👤</span>
                          <span className="category-name">Personal Information</span>
                          <span className="category-count">{redactionResult.redactionSummary.piiRedactions}</span>
                        </div>
                      )}
                      {redactionResult.redactionSummary.financialRedactions > 0 && (
                        <div className="category-item">
                          <span className="category-icon">💰</span>
                          <span className="category-name">Financial Data</span>
                          <span className="category-count">{redactionResult.redactionSummary.financialRedactions}</span>
                        </div>
                      )}
                      {redactionResult.redactionSummary.medicalRedactions > 0 && (
                        <div className="category-item">
                          <span className="category-icon">🏥</span>
                          <span className="category-name">Medical Information</span>
                          <span className="category-count">{redactionResult.redactionSummary.medicalRedactions}</span>
                        </div>
                      )}
                      {redactionResult.redactionSummary.legalRedactions > 0 && (
                        <div className="category-item">
                          <span className="category-icon">⚖️</span>
                          <span className="category-name">Legal Information</span>
                          <span className="category-count">{redactionResult.redactionSummary.legalRedactions}</span>
                        </div>
                      )}
                      {redactionResult.redactionSummary.otherRedactions > 0 && (
                        <div className="category-item">
                          <span className="category-icon">🔒</span>
                          <span className="category-name">Other</span>
                          <span className="category-count">{redactionResult.redactionSummary.otherRedactions}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="confidence-breakdown">
                    <h4>Confidence Levels</h4>
                    <div className="confidence-list">
                      <div className="confidence-item high-confidence">
                        <span className="confidence-label">High Confidence</span>
                        <span className="confidence-count">{redactionResult.redactionSummary.highConfidence}</span>
                      </div>
                      <div className="confidence-item medium-confidence">
                        <span className="confidence-label">Medium Confidence</span>
                        <span className="confidence-count">{redactionResult.redactionSummary.mediumConfidence}</span>
                      </div>
                      <div className="confidence-item low-confidence">
                        <span className="confidence-label">Low Confidence</span>
                        <span className="confidence-count">{redactionResult.redactionSummary.lowConfidence}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {selectedTab === 'details' && (
                <div className="details-tab">
                  {redactionResult.redactedAreas.length === 0 ? (
                    <div className="no-redactions">
                      <div className="no-redactions-icon">✅</div>
                      <h4>No Sensitive Content Detected</h4>
                      <p>This document appears to be safe for AI processing.</p>
                    </div>
                  ) : (
                    <div className="redaction-details">
                      {redactionResult.redactedAreas.map((area) => (
                        <div key={area.id} className="redaction-detail-item">
                          <div className="redaction-header">
                            <span className="category-icon">{getCategoryIcon(area.category)}</span>
                            <span className="category-name">{getCategoryName(area.category)}</span>
                            <span className={`confidence-badge ${getConfidenceColor(area.confidence)}`}>
                              {getConfidenceLabel(area.confidence)} ({Math.round(area.confidence * 100)}%)
                            </span>
                          </div>
                          <div className="redaction-content">
                            <div className="original-content">
                              <strong>Original:</strong> {area.originalContent}
                            </div>
                            <div className="redacted-content">
                              <strong>Redacted:</strong> {area.redactedContent}
                            </div>
                            {area.pageNumber && (
                              <div className="page-info">
                                <strong>Page:</strong> {area.pageNumber + 1}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {selectedTab === 'text' && (
                <div className="text-tab">
                  <div className="text-preview-container">
                    <div className="text-section">
                      <h4>Extracted Text (Safe for AI)</h4>
                      <div className="text-preview safe-text">
                        {redactionResult.extractedText || 'No text content extracted.'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="redaction-preview-footer">
              <div className="warning-message">
                <span className="warning-icon">⚠️</span>
                <span>
                  Only the redacted content will be sent to AI. Original sensitive information will be protected.
                </span>
              </div>
              
              <div className="action-buttons">
                {onModifySettings && (
                  <button 
                    className="btn btn-secondary"
                    onClick={onModifySettings}
                  >
                    ⚙️ Modify Settings
                  </button>
                )}
                <button 
                  className="btn btn-secondary"
                  onClick={onCancel}
                >
                  Cancel
                </button>
                <button 
                  className="btn btn-primary"
                  onClick={handleConfirm}
                  disabled={redactionResult.redactedAreas.length === 0}
                >
                  {redactionResult.redactedAreas.length > 0 ? '🔒 Process with Redaction' : '✅ Process Document'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="confirmation-dialog">
            <div className="confirmation-icon">🔒</div>
            <h3>Confirm Redaction</h3>
            <p>
              You are about to process this document with {redactionResult.redactedAreas.length} redactions applied.
              The original sensitive content will be protected and only safe text will be sent to AI.
            </p>
            <div className="confirmation-buttons">
              <button 
                className="btn btn-secondary"
                onClick={handleFinalCancel}
              >
                Go Back
              </button>
              <button 
                className="btn btn-primary"
                onClick={handleFinalConfirm}
              >
                Confirm & Process
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RedactionPreview;
