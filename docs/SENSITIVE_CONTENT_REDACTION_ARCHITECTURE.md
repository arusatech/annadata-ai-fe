# Sensitive Content Redaction Architecture

## Overview

This document outlines the architecture for the sensitive content redaction system that automatically detects and redacts PII and other sensitive information from PDF and image files before sending content to AI services.

## Architecture Components

### 1. DocumentRedactionService

**Location**: `src/services/DocumentRedactionService.ts`

**Purpose**: Core service responsible for processing documents and identifying sensitive content.

**Key Features**:
- PDF and image processing using MuPDF.js
- PII detection using regex patterns
- Confidence-based redaction scoring
- Metadata cleaning
- Structured text extraction

**Main Methods**:
- `processPDF(fileBuffer, options)` - Processes PDF documents
- `processImage(fileBuffer, mimeType, options)` - Processes image files
- `addRedactionPattern(pattern)` - Adds custom detection patterns
- `removeRedactionPattern(patternName)` - Removes detection patterns

### 2. RedactionPreview Component

**Location**: `src/components/RedactionPreview.tsx`

**Purpose**: User interface for reviewing redaction results and confirming processing.

**Features**:
- Summary view with redaction statistics
- Detailed view showing each redacted item
- Text preview of safe content
- Confidence level indicators
- User confirmation workflow

### 3. ChatFooter Integration

**Location**: `src/components/ChatFooter.tsx`

**Purpose**: Integrates redaction processing into the file attachment workflow.

**Integration Points**:
- File picker attachments
- Camera photo capture
- Automatic redaction triggering
- User confirmation handling

## Data Flow

```
1. User attaches file (PDF/Image)
   ↓
2. ChatFooter detects supported file type
   ↓
3. DocumentRedactionService processes file
   ↓
4. PII patterns applied with confidence scoring
   ↓
5. RedactionPreview shows results to user
   ↓
6. User confirms or cancels
   ↓
7. Safe text extracted and added to message
   ↓
8. Content sent to AI service
```

## Redaction Patterns

### PII Patterns
- **Email Address**: `/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g`
- **Phone Number**: `/(\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g`
- **SSN**: `/\b\d{3}-?\d{2}-?\d{4}\b/g`
- **Address**: `/\b\d+\s+[A-Za-z0-9\s,.-]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Way|Place|Pl)\b/gi`
- **Date of Birth**: `/\b(?:0?[1-9]|1[0-2])[\/\-](?:0?[1-9]|[12]\d|3[01])[\/\-](?:19|20)\d{2}\b/g`
- **Driver License**: `/\b[A-Z]\d{7,8}\b/g`
- **Passport**: `/\b[A-Z]{1,2}\d{6,9}\b/g`

### Financial Patterns
- **Credit Card**: `/\b(?:\d{4}[-\s]?){3}\d{4}\b/g`
- **Bank Account**: `/\b\d{8,17}\b/g`

### Medical Patterns
- **Medical Record**: `/\b(?:MRN|Medical Record|Patient ID)[:\s]*\d{6,12}\b/gi`

### Legal Patterns
- **Case Number**: `/\b(?:Case|Docket|File)[\s#:]*[A-Z0-9\-]{6,20}\b/gi`

## Confidence Scoring

The system uses a confidence-based approach to determine whether content should be redacted:

### Base Confidence: 0.5
### Adjustments:
- **High Severity Pattern**: +0.3
- **Medium Severity Pattern**: +0.1
- **Low Severity Pattern**: -0.1
- **Text Length > 5**: +0.1
- **Contains Numbers + Letters**: +0.1

### Thresholds:
- **High Confidence**: ≥0.8
- **Medium Confidence**: 0.6-0.79
- **Low Confidence**: <0.6

## Configuration Options

```typescript
interface DocumentProcessingOptions {
  enablePIIRedaction: boolean;        // Enable PII detection
  enableFinancialRedaction: boolean;  // Enable financial data detection
  enableMedicalRedaction: boolean;    // Enable medical info detection
  enableLegalRedaction: boolean;      // Enable legal info detection
  enableMetadataRedaction: boolean;   // Clean document metadata
  confidenceThreshold: number;        // Minimum confidence for redaction
  preserveFormatting: boolean;        // Maintain text formatting
  userConfirmationRequired: boolean;  // Require user confirmation
}
```

## Error Handling

### File Processing Errors
- Unsupported file types
- Corrupted files
- Password-protected PDFs
- Large file size limits

### Redaction Errors
- Pattern matching failures
- Low confidence detections
- Memory limitations for large documents

### User Experience
- Clear error messages
- Graceful degradation
- Fallback to manual review

## Security Considerations

### Data Protection
- Files processed locally (client-side)
- No sensitive data transmitted to servers
- Redacted content only sent to AI
- Original files remain on device

### Privacy
- No logging of sensitive content
- Temporary file processing only
- User control over redaction settings
- Transparent redaction process

## Performance Optimization

### File Size Limits
- PDF: 10MB maximum
- Images: 10MB maximum
- Processing timeout: 30 seconds

### Caching
- Pattern compilation caching
- Service singleton pattern
- Memory-efficient processing

### Progressive Processing
- Page-by-page PDF processing
- Chunked text analysis
- Background processing where possible

## Usage Examples

### Basic File Processing
```typescript
const redactionService = DocumentRedactionService.getInstance();

// Process PDF
const result = await redactionService.processPDF(fileBuffer, {
  enablePIIRedaction: true,
  confidenceThreshold: 0.7
});

// Process Image
const result = await redactionService.processImage(fileBuffer, 'image/jpeg', {
  enablePIIRedaction: true,
  enableFinancialRedaction: true
});
```

### Custom Pattern Addition
```typescript
redactionService.addRedactionPattern({
  name: 'Custom ID',
  pattern: /\b[A-Z]{2}\d{4}\b/g,
  severity: 'high',
  category: 'pii'
});
```

### Integration with ChatFooter
```typescript
// Automatic redaction on file attachment
const processFileForRedaction = async (file: any, fileName: string) => {
  const result = await redactionService.processPDF(fileBuffer, options);
  setShowRedactionPreview(true);
  setCurrentRedactionResult(result);
};
```

## Testing Strategy

### Unit Tests
- Pattern matching accuracy
- Confidence scoring validation
- Error handling scenarios
- File processing edge cases

### Integration Tests
- End-to-end redaction workflow
- UI component interactions
- File attachment integration
- User confirmation flows

### Security Tests
- Data leakage prevention
- Privacy compliance validation
- Error message security
- File processing isolation

## Future Enhancements

### Advanced Detection
- Machine learning-based PII detection
- Context-aware redaction
- OCR for handwritten content
- Multi-language support

### User Experience
- Batch file processing
- Redaction history
- Custom pattern management
- Advanced settings panel

### Performance
- Web Workers for processing
- Progressive loading
- Streaming processing
- Cloud processing options

## Dependencies

### Core Dependencies
- **mupdf**: ^1.26.4 - PDF and image processing
- **React**: 19.0.0 - UI framework
- **TypeScript**: ^5.1.6 - Type safety

### Integration Dependencies
- **@capacitor/camera**: ^7.0.2 - Camera access
- **@capawesome/capacitor-file-picker**: ^7.2.0 - File selection
- **react-i18next**: ^15.6.0 - Internationalization

## Maintenance

### Regular Updates
- Pattern database updates
- Security vulnerability patches
- Performance optimizations
- User feedback integration

### Monitoring
- Processing success rates
- User confirmation patterns
- Error frequency analysis
- Performance metrics

This architecture provides a robust, secure, and user-friendly solution for protecting sensitive information while enabling AI-powered document processing capabilities.
