# Sensitive Content Redaction - Usage Examples

## Overview

This document provides practical examples of how to use the sensitive content redaction system in the Annadata AI Frontend application.

## Basic Usage

### 1. Automatic File Processing

When users attach PDF or image files through the ChatFooter component, redaction processing is automatically triggered:

```typescript
// File attachment automatically triggers redaction
const handleAttachClick = async () => {
  const result = await fileService.pickFiles({
    types: ['application/pdf', 'image/*'],
    limit: 5
  });
  
  // Files are automatically processed for redaction
  // RedactionPreview modal will appear if sensitive content is detected
};
```

### 2. Camera Photo Processing

Photos captured through the camera are also automatically processed:

```typescript
// Camera capture automatically triggers redaction
const handleCameraClick = async () => {
  const photo = await CameraService.capturePhotoDirectly({
    quality: 85,
    width: 1200,
    height: 1200
  });
  
  // Photo is automatically processed for redaction
  // RedactionPreview modal will appear if sensitive content is detected
};
```

## Advanced Configuration

### 1. Custom Redaction Options

```typescript
import DocumentRedactionService, { DocumentProcessingOptions } from '../services/DocumentRedactionService';

const redactionService = DocumentRedactionService.getInstance();

// Custom configuration for sensitive documents
const sensitiveDocumentOptions: Partial<DocumentProcessingOptions> = {
  enablePIIRedaction: true,
  enableFinancialRedaction: true,
  enableMedicalRedaction: true,
  enableLegalRedaction: false, // Disable for non-legal documents
  confidenceThreshold: 0.9,    // Higher threshold for sensitive docs
  userConfirmationRequired: true
};

// Process with custom options
const result = await redactionService.processPDF(fileBuffer, sensitiveDocumentOptions);
```

### 2. Adding Custom Detection Patterns

```typescript
// Add custom pattern for employee IDs
redactionService.addRedactionPattern({
  name: 'Employee ID',
  pattern: /\bEMP\d{6}\b/g,
  severity: 'high',
  category: 'pii'
});

// Add custom pattern for project codes
redactionService.addRedactionPattern({
  name: 'Project Code',
  pattern: /\bPRJ-[A-Z0-9]{4,8}\b/g,
  severity: 'medium',
  category: 'other'
});
```

### 3. Processing Different File Types

```typescript
// Process PDF document
const pdfResult = await redactionService.processPDF(pdfBuffer, {
  enablePIIRedaction: true,
  enableMetadataRedaction: true
});

// Process JPEG image
const imageResult = await redactionService.processImage(jpegBuffer, 'image/jpeg', {
  enablePIIRedaction: true,
  confidenceThreshold: 0.8
});

// Process PNG image
const pngResult = await redactionService.processImage(pngBuffer, 'image/png', {
  enablePIIRedaction: true,
  enableFinancialRedaction: true
});
```

## User Interface Examples

### 1. Redaction Preview Modal

The RedactionPreview component provides a comprehensive review interface:

```typescript
import RedactionPreview from '../components/RedactionPreview';

// Show redaction preview
<RedactionPreview
  redactionResult={redactionResult}
  fileName="document.pdf"
  fileType="application/pdf"
  onConfirm={handleRedactionConfirm}
  onCancel={handleRedactionCancel}
  onModifySettings={handleSettingsModify}
/>
```

### 2. Custom Redaction Settings

```typescript
// Custom settings component
const RedactionSettings = () => {
  const [settings, setSettings] = useState({
    enablePIIRedaction: true,
    enableFinancialRedaction: true,
    confidenceThreshold: 0.7
  });

  const handleSaveSettings = () => {
    // Save settings to local storage or user preferences
    localStorage.setItem('redactionSettings', JSON.stringify(settings));
  };

  return (
    <div className="redaction-settings">
      <h3>Redaction Settings</h3>
      
      <label>
        <input
          type="checkbox"
          checked={settings.enablePIIRedaction}
          onChange={(e) => setSettings({
            ...settings,
            enablePIIRedaction: e.target.checked
          })}
        />
        Enable PII Redaction
      </label>
      
      <label>
        <input
          type="checkbox"
          checked={settings.enableFinancialRedaction}
          onChange={(e) => setSettings({
            ...settings,
            enableFinancialRedaction: e.target.checked
          })}
        />
        Enable Financial Data Redaction
      </label>
      
      <label>
        Confidence Threshold: {settings.confidenceThreshold}
        <input
          type="range"
          min="0.5"
          max="1.0"
          step="0.1"
          value={settings.confidenceThreshold}
          onChange={(e) => setSettings({
            ...settings,
            confidenceThreshold: parseFloat(e.target.value)
          })}
        />
      </label>
      
      <button onClick={handleSaveSettings}>Save Settings</button>
    </div>
  );
};
```

## Integration Examples

### 1. Chat Message with Redacted Content

```typescript
// After redaction confirmation, add content to chat
const handleRedactionConfirm = (result: RedactionResult) => {
  if (result.extractedText.trim()) {
    const redactedMessage = `📄 Document Content (Redacted):\n\n${result.extractedText}`;
    setMessage(prev => prev ? `${prev}\n\n${redactedMessage}` : redactedMessage);
  }
};
```

### 2. Batch File Processing

```typescript
// Process multiple files
const processMultipleFiles = async (files: File[]) => {
  const results = await Promise.all(
    files.map(async (file) => {
      const buffer = await file.arrayBuffer();
      const mimeType = file.type;
      
      if (mimeType === 'application/pdf') {
        return await redactionService.processPDF(buffer);
      } else if (mimeType.startsWith('image/')) {
        return await redactionService.processImage(buffer, mimeType);
      }
      return null;
    })
  );
  
  return results.filter(result => result !== null);
};
```

### 3. Error Handling

```typescript
// Comprehensive error handling
const processFileSafely = async (file: File) => {
  try {
    const buffer = await file.arrayBuffer();
    
    // Check file size
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      throw new Error('File size exceeds 10MB limit');
    }
    
    // Check file type
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) {
      throw new Error(`Unsupported file type: ${file.type}`);
    }
    
    const result = await redactionService.processPDF(buffer);
    return result;
    
  } catch (error) {
    console.error('File processing error:', error);
    
    if (error.message.includes('encrypted')) {
      throw new Error('Password-protected PDFs are not supported');
    }
    
    if (error.message.includes('corrupted')) {
      throw new Error('File appears to be corrupted');
    }
    
    throw new Error(`Processing failed: ${error.message}`);
  }
};
```

## Testing Examples

### 1. Unit Test for Pattern Matching

```typescript
// Test redaction patterns
describe('DocumentRedactionService', () => {
  it('should detect email addresses', () => {
    const service = DocumentRedactionService.getInstance();
    const testText = 'Contact us at john.doe@example.com for more info';
    
    const result = service.processImage(
      new TextEncoder().encode(testText),
      'text/plain'
    );
    
    expect(result.redactedAreas).toHaveLength(1);
    expect(result.redactedAreas[0].originalContent).toBe('john.doe@example.com');
    expect(result.redactedAreas[0].category).toBe('pii');
  });
});
```

### 2. Integration Test for ChatFooter

```typescript
// Test file attachment with redaction
describe('ChatFooter Integration', () => {
  it('should trigger redaction for PDF files', async () => {
    const mockFile = new File(['test content'], 'test.pdf', {
      type: 'application/pdf'
    });
    
    // Mock the redaction service
    const mockRedactionResult = {
      extractedText: 'Safe content',
      redactedAreas: [],
      confidence: 1.0
    };
    
    jest.spyOn(DocumentRedactionService.prototype, 'processPDF')
      .mockResolvedValue(mockRedactionResult);
    
    // Test file attachment
    await handleAttachClick();
    
    expect(setShowRedactionPreview).toHaveBeenCalledWith(true);
  });
});
```

## Performance Optimization Examples

### 1. Lazy Loading

```typescript
// Lazy load redaction service
const DocumentRedactionService = lazy(() => 
  import('../services/DocumentRedactionService')
);

// Use in component
const RedactionComponent = () => {
  const [service, setService] = useState(null);
  
  useEffect(() => {
    DocumentRedactionService().then(module => {
      setService(module.default.getInstance());
    });
  }, []);
  
  if (!service) return <div>Loading...</div>;
  
  return <div>Redaction service ready</div>;
};
```

### 2. Web Worker Processing

```typescript
// Web worker for heavy processing
const redactionWorker = new Worker('/workers/redaction.worker.js');

const processFileInWorker = (fileBuffer: ArrayBuffer) => {
  return new Promise((resolve, reject) => {
    redactionWorker.postMessage({ fileBuffer });
    
    redactionWorker.onmessage = (event) => {
      resolve(event.data);
    };
    
    redactionWorker.onerror = (error) => {
      reject(error);
    };
  });
};
```

## Best Practices

### 1. User Experience

- Always show processing status
- Provide clear error messages
- Allow users to review redactions
- Offer settings customization

### 2. Security

- Process files locally when possible
- Never log sensitive content
- Validate file types and sizes
- Handle errors gracefully

### 3. Performance

- Set reasonable file size limits
- Use progressive processing for large files
- Cache frequently used patterns
- Optimize for mobile devices

### 4. Accessibility

- Provide keyboard navigation
- Include screen reader support
- Use high contrast colors
- Offer text alternatives for icons

This comprehensive guide should help developers effectively implement and use the sensitive content redaction system in their applications.
