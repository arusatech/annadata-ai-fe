import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '../css/content-selection.css';

interface ContentSection {
  id: string;
  type: 'text' | 'image' | 'metadata' | 'form' | 'link' | 'annotation';
  index: number;
  pageNumber?: number;
  content: string;
  preview: string;
  length: number;
  hasSensitiveContent: boolean;
  sensitivePatterns: string[];
  confidence: number;
  boundingBox?: [number, number, number, number];
  metadata?: any;
}

interface DocumentAnalysis {
  documentId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  sections: ContentSection[];
  totalSections: number;
  sensitiveSections: number;
  analysisStatus: 'pending' | 'analyzing' | 'completed' | 'failed';
  metadata?: any;
}

interface ContentSelectionModalProps {
  analysis: DocumentAnalysis;
  onConfirm: (selectedSections: ContentSection[]) => void;
  onCancel: () => void;
  onUpdateSelections?: (selections: { [sectionId: string]: boolean }) => void;
}

const ContentSelectionModal: React.FC<ContentSelectionModalProps> = ({
  analysis,
  onConfirm,
  onCancel,
  onUpdateSelections
}) => {
  const { t } = useTranslation();
  const [selectedSections, setSelectedSections] = useState<{ [sectionId: string]: boolean }>({});
  const [expandedSections, setExpandedSections] = useState<{ [sectionId: string]: boolean }>({});
  const [filterType, setFilterType] = useState<string>('all');
  const [filterSensitive, setFilterSensitive] = useState<boolean | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Initialize selections (default to all selected)
  useEffect(() => {
    const initialSelections: { [sectionId: string]: boolean } = {};
    analysis.sections.forEach(section => {
      initialSelections[section.id] = true;
    });
    setSelectedSections(initialSelections);
  }, [analysis.sections]);

  const getSectionIcon = (type: string): string => {
    switch (type) {
      case 'text': return '📄';
      case 'image': return '🖼️';
      case 'metadata': return '📋';
      case 'form': return '📝';
      case 'link': return '🔗';
      case 'annotation': return '💬';
      default: return '📄';
    }
  };

  const getSectionTypeName = (type: string): string => {
    switch (type) {
      case 'text': return 'Text Content';
      case 'image': return 'Image';
      case 'metadata': return 'Document Metadata';
      case 'form': return 'Form Field';
      case 'link': return 'Link';
      case 'annotation': return 'Annotation';
      default: return 'Unknown';
    }
  };

  const getSensitiveIcon = (hasSensitive: boolean, patterns: string[]): string => {
    if (!hasSensitive) return '✅';
    if (patterns.length > 0) return '⚠️';
    return '🔒';
  };

  const getSensitiveLabel = (hasSensitive: boolean, patterns: string[]): string => {
    if (!hasSensitive) return 'Safe';
    if (patterns.length > 0) return `Sensitive (${patterns.length} patterns)`;
    return 'Potentially Sensitive';
  };

  const filteredSections = analysis.sections.filter(section => {
    // Filter by type
    if (filterType !== 'all' && section.type !== filterType) {
      return false;
    }
    
    // Filter by sensitivity
    if (filterSensitive !== null) {
      if (filterSensitive && !section.hasSensitiveContent) return false;
      if (!filterSensitive && section.hasSensitiveContent) return false;
    }
    
    // Filter by search term
    if (searchTerm && !section.preview.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    
    return true;
  });

  const handleSectionToggle = (sectionId: string, checked: boolean) => {
    const newSelections = {
      ...selectedSections,
      [sectionId]: checked
    };
    setSelectedSections(newSelections);
    
    if (onUpdateSelections) {
      onUpdateSelections(newSelections);
    }
  };

  const handleSelectAll = () => {
    const newSelections: { [sectionId: string]: boolean } = {};
    filteredSections.forEach(section => {
      newSelections[section.id] = true;
    });
    setSelectedSections({ ...selectedSections, ...newSelections });
    
    if (onUpdateSelections) {
      onUpdateSelections({ ...selectedSections, ...newSelections });
    }
  };

  const handleDeselectAll = () => {
    const newSelections: { [sectionId: string]: boolean } = {};
    filteredSections.forEach(section => {
      newSelections[section.id] = false;
    });
    setSelectedSections({ ...selectedSections, ...newSelections });
    
    if (onUpdateSelections) {
      onUpdateSelections({ ...selectedSections, ...newSelections });
    }
  };

  const handleExpandToggle = (sectionId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const handleConfirm = () => {
    const selected = analysis.sections.filter(section => selectedSections[section.id]);
    onConfirm(selected);
  };

  const selectedCount = Object.values(selectedSections).filter(Boolean).length;
  const sensitiveSelectedCount = analysis.sections
    .filter(section => selectedSections[section.id] && section.hasSensitiveContent)
    .length;

  return (
    <div className="content-selection-overlay">
      <div className="content-selection-modal">
        <div className="content-selection-header">
          <div className="header-info">
            <h3>🔍 Content Selection</h3>
            <p className="document-info">
              <strong>{analysis.fileName}</strong> ({analysis.fileType.toUpperCase()})
            </p>
            <p className="analysis-summary">
              {analysis.totalSections} sections found • {analysis.sensitiveSections} with sensitive content
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

        <div className="content-selection-controls">
          <div className="filter-controls">
            <div className="filter-group">
              <label>Type:</label>
              <select 
                value={filterType} 
                onChange={(e) => setFilterType(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Types</option>
                <option value="text">📄 Text</option>
                <option value="image">🖼️ Images</option>
                <option value="metadata">📋 Metadata</option>
                <option value="form">📝 Forms</option>
                <option value="link">🔗 Links</option>
                <option value="annotation">💬 Annotations</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Sensitivity:</label>
              <select 
                value={filterSensitive === null ? 'all' : filterSensitive.toString()} 
                onChange={(e) => {
                  const value = e.target.value;
                  setFilterSensitive(value === 'all' ? null : value === 'true');
                }}
                className="filter-select"
              >
                <option value="all">All Content</option>
                <option value="true">⚠️ Sensitive Only</option>
                <option value="false">✅ Safe Only</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Search:</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search content..."
                className="search-input"
              />
            </div>
          </div>

          <div className="selection-controls">
            <button 
              className="btn btn-secondary"
              onClick={handleSelectAll}
            >
              Select All Visible
            </button>
            <button 
              className="btn btn-secondary"
              onClick={handleDeselectAll}
            >
              Deselect All
            </button>
          </div>
        </div>

        <div className="content-selection-body">
          <div className="selection-summary">
            <span className="selection-count">
              {selectedCount} of {analysis.totalSections} sections selected
            </span>
            {sensitiveSelectedCount > 0 && (
              <span className="sensitive-warning">
                ⚠️ {sensitiveSelectedCount} sensitive sections selected
              </span>
            )}
          </div>

          <div className="sections-list">
            {filteredSections.length === 0 ? (
              <div className="no-sections">
                <p>No sections match the current filters.</p>
                <button 
                  className="btn btn-secondary"
                  onClick={() => {
                    setFilterType('all');
                    setFilterSensitive(null);
                    setSearchTerm('');
                  }}
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              filteredSections.map((section) => (
                <div 
                  key={section.id} 
                  className={`section-item ${section.hasSensitiveContent ? 'sensitive' : 'safe'} ${selectedSections[section.id] ? 'selected' : ''}`}
                >
                  <div className="section-header">
                    <div className="section-checkbox">
                      <input
                        type="checkbox"
                        id={section.id}
                        checked={selectedSections[section.id] || false}
                        onChange={(e) => handleSectionToggle(section.id, e.target.checked)}
                      />
                      <label htmlFor={section.id} className="checkbox-label">
                        <span className="section-icon">{getSectionIcon(section.type)}</span>
                        <span className="section-type">{getSectionTypeName(section.type)}</span>
                        {section.pageNumber !== undefined && (
                          <span className="page-number">Page {section.pageNumber + 1}</span>
                        )}
                      </label>
                    </div>

                    <div className="section-meta">
                      <span className={`sensitivity-indicator ${section.hasSensitiveContent ? 'sensitive' : 'safe'}`}>
                        {getSensitiveIcon(section.hasSensitiveContent, section.sensitivePatterns)}
                        {getSensitiveLabel(section.hasSensitiveContent, section.sensitivePatterns)}
                      </span>
                      <span className="content-length">{section.length} chars</span>
                      <button
                        className="expand-btn"
                        onClick={() => handleExpandToggle(section.id)}
                        title={expandedSections[section.id] ? 'Collapse' : 'Expand'}
                      >
                        {expandedSections[section.id] ? '▼' : '▶'}
                      </button>
                    </div>
                  </div>

                  <div className="section-preview">
                    {section.preview}
                  </div>

                  {expandedSections[section.id] && (
                    <div className="section-details">
                      <div className="section-content">
                        <pre>{section.content}</pre>
                      </div>
                      
                      {section.sensitivePatterns.length > 0 && (
                        <div className="sensitive-patterns">
                          <h5>⚠️ Detected Patterns:</h5>
                          <ul>
                            {section.sensitivePatterns.map((pattern, index) => (
                              <li key={index}>{pattern}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {section.metadata && (
                        <div className="section-metadata">
                          <h5>📋 Metadata:</h5>
                          <pre>{JSON.stringify(section.metadata, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="content-selection-footer">
          <div className="footer-warning">
            {sensitiveSelectedCount > 0 && (
              <div className="warning-message">
                <span className="warning-icon">⚠️</span>
                <span>
                  You have selected {sensitiveSelectedCount} sections with sensitive content. 
                  Only safe content will be sent to AI after redaction.
                </span>
              </div>
            )}
          </div>
          
          <div className="footer-actions">
            <button 
              className="btn btn-secondary"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button 
              className="btn btn-primary"
              onClick={handleConfirm}
              disabled={selectedCount === 0}
            >
              Process {selectedCount} Selected Sections
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContentSelectionModal;
