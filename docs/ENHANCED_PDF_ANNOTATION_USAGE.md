# Enhanced PDF Annotation System - Usage Guide

## Overview

The Enhanced PDF Annotation System provides comprehensive parsing and annotation of PDF documents with detailed metadata storage for images and text sections.

## Architecture

### Core Components

1. **EnhancedPDFParser** - Advanced PDF parsing with multi-unit dimension extraction
2. **PDFAnnotationService** - Integration layer for parsing and database storage
3. **RedactionDatabaseService** - SQLite database with enhanced annotation tables
4. **PDFAnnotationTester** - Testing and visualization utilities

## Features

### Image Annotations
- **Multi-unit dimensions**: Pixels, centimeters, and inches
- **Caption detection**: Automatic detection of figure captions (e.g., "Fig 1.1")
- **Position tracking**: Bounding box coordinates on page
- **Image properties**: Format, color space, DPI, transparency
- **Caption position**: Top, bottom, left, or right relative to image

### Text Annotations
- **Hierarchical structure**: Parent-child relationships between sections
- **Content types**: Paragraphs, headings, lists, tables, captions
- **Typography**: Font name, size, bold, italic
- **Semantic analysis**: Number detection, URL detection
- **Position tracking**: Bounding box coordinates

## Usage Examples

### Basic PDF Parsing and Annotation

```typescript
import PDFAnnotationService from './services/PDFAnnotationService';

// Get service instance
const annotationService = PDFAnnotationService.getInstance();

// Parse and annotate PDF
const result = await annotationService.parseAndAnnotatePDF(
  pdfBuffer,
  'document.pdf',
  'session-123',
  'message-456'
);

console.log('Document ID:', result.documentId);
console.log('Total Images:', result.report.totalImages);
console.log('Total Text Sections:', result.report.totalTextSections);
console.log('Images with Captions:', result.report.imagesWithCaptions);
```

### Retrieving Annotations

```typescript
// Get all annotations for a document
const annotations = await annotationService.getDocumentAnnotations(documentId);

// Access image annotations
for (const image of annotations.images) {
  console.log(`Image ${image.image_index}:`);
  console.log(`  Size: ${image.width_cm}cm × ${image.height_cm}cm`);
  console.log(`  Position: (${image.bbox_x1}, ${image.bbox_y1}) to (${image.bbox_x2}, ${image.bbox_y2})`);
  
  if (image.caption_text) {
    console.log(`  Caption: ${image.caption_text}`);
    console.log(`  Caption Position: ${image.caption_position}`);
  }
}

// Access text annotations
for (const text of annotations.textSections) {
  console.log(`Text Section ${text.section_index}:`);
  console.log(`  Type: ${text.content_type}`);
  console.log(`  Level: ${text.section_level}`);
  console.log(`  Content: ${text.content_text.substring(0, 100)}...`);
  console.log(`  Word Count: ${text.word_count}`);
}
```

### Page-Specific Queries

```typescript
// Get annotations for a specific page
const pageAnnotations = await annotationService.getDocumentAnnotations(documentId, 0); // Page 0

// Get hierarchical text structure for a page
const textHierarchy = await annotationService.getPageTextHierarchy(documentId, 0);

for (const section of textHierarchy) {
  const indent = '  '.repeat(section.section_level);
  console.log(`${indent}${section.content_type}: ${section.content_text.substring(0, 50)}`);
}
```

### Generating Reports

```typescript
// Get comprehensive annotation report
const report = await annotationService.getAnnotationReport(documentId);

console.log('Annotation Report:');
console.log('  File:', report.fileName);
console.log('  Pages:', report.pageCount);
console.log('  Images:', report.totalImages);
console.log('  Text Sections:', report.totalTextSections);
console.log('  Images with Captions:', report.imagesWithCaptions);
console.log('  Average Image Size:', 
  `${report.averageImageSize.widthCm}cm × ${report.averageImageSize.heightCm}cm`);

// Images per page
for (const [page, count] of Object.entries(report.imagesByPage)) {
  console.log(`  Page ${parseInt(page) + 1}: ${count} images`);
}
```

### Exporting Annotations

```typescript
// Export annotations as JSON
const jsonExport = await annotationService.exportAnnotationsAsJSON(documentId);

// Save to file or send to API
console.log(jsonExport);
```

## Testing

### Running Tests

```typescript
import PDFAnnotationTester from './services/PDFAnnotationTester';

const tester = PDFAnnotationTester.getInstance();

// Test PDF annotation workflow
const testResult = await tester.testPDFAnnotation(pdfBuffer, 'test-document.pdf');

console.log('Test Success:', testResult.success);
console.log('Errors:', testResult.errors);
console.log('Warnings:', testResult.warnings);
console.log('Metrics:', testResult.metrics);
```

### Visualization

```typescript
// Generate visualization data
const visualization = await tester.generateVisualization(documentId);

// Print to console
await tester.printVisualization(documentId);

// Export test results
const exportData = await tester.exportTestResults(documentId, testResult);
```

## Database Schema

### Image Annotations Table

```sql
CREATE TABLE image_annotations (
  id INTEGER PRIMARY KEY,
  document_id TEXT NOT NULL,
  section_id TEXT NOT NULL,
  page_number INTEGER NOT NULL,
  image_index INTEGER NOT NULL,
  
  -- Dimensions
  width_px REAL NOT NULL,
  height_px REAL NOT NULL,
  width_cm REAL,
  height_cm REAL,
  width_inches REAL,
  height_inches REAL,
  
  -- Position
  bbox_x1 REAL NOT NULL,
  bbox_y1 REAL NOT NULL,
  bbox_x2 REAL NOT NULL,
  bbox_y2 REAL NOT NULL,
  
  -- Caption
  caption_text TEXT,
  caption_position TEXT,
  caption_bbox TEXT,
  
  -- Properties
  format TEXT,
  color_space TEXT,
  dpi REAL,
  is_inline BOOLEAN,
  has_transparency BOOLEAN,
  
  created_at DATETIME,
  metadata TEXT
);
```

### Text Section Annotations Table

```sql
CREATE TABLE text_section_annotations (
  id INTEGER PRIMARY KEY,
  document_id TEXT NOT NULL,
  section_id TEXT NOT NULL,
  page_number INTEGER NOT NULL,
  section_index INTEGER NOT NULL,
  
  -- Hierarchy
  parent_section_id TEXT,
  section_level INTEGER NOT NULL,
  section_title TEXT,
  
  -- Content
  content_text TEXT NOT NULL,
  content_type TEXT NOT NULL,
  word_count INTEGER NOT NULL,
  char_count INTEGER NOT NULL,
  
  -- Position
  bbox_x1 REAL,
  bbox_y1 REAL,
  bbox_x2 REAL,
  bbox_y2 REAL,
  
  -- Typography
  font_name TEXT,
  font_size REAL,
  is_bold BOOLEAN,
  is_italic BOOLEAN,
  text_color TEXT,
  
  -- Semantic
  contains_numbers BOOLEAN,
  contains_urls BOOLEAN,
  language TEXT,
  
  created_at DATETIME,
  metadata TEXT
);
```

## Example Output

### Sample Annotation Report

```json
{
  "documentId": "doc_1234567890_abc123",
  "fileName": "research-paper.pdf",
  "pageCount": 10,
  "totalImages": 5,
  "totalTextSections": 120,
  "imagesWithCaptions": 4,
  "imagesByPage": {
    "0": 1,
    "2": 2,
    "5": 1,
    "8": 1
  },
  "textSectionsByPage": {
    "0": 15,
    "1": 12,
    "2": 18,
    ...
  },
  "averageImageSize": {
    "widthCm": 8.5,
    "heightCm": 6.3,
    "widthInches": 3.35,
    "heightInches": 2.48
  },
  "metadata": {
    "title": "Research Paper Title",
    "author": "John Doe",
    "subject": "Computer Science"
  }
}
```

### Sample Image Annotation

```json
{
  "pageNumber": 2,
  "index": 1,
  "dimensions": {
    "widthCm": 8.5,
    "heightCm": 6.0,
    "widthInches": 3.35,
    "heightInches": 2.36,
    "widthPx": 243,
    "heightPx": 170
  },
  "position": {
    "x1": 72,
    "y1": 200,
    "x2": 315,
    "y2": 370
  },
  "caption": {
    "text": "Figure 1.1: System Architecture Diagram",
    "position": "bottom"
  },
  "properties": {
    "format": "jpeg",
    "colorSpace": "DeviceRGB",
    "dpi": 72,
    "hasTransparency": false
  }
}
```

### Sample Text Annotation

```json
{
  "pageNumber": 0,
  "index": 5,
  "level": 1,
  "type": "heading",
  "title": "Introduction",
  "content": "Introduction",
  "wordCount": 1,
  "charCount": 12,
  "formatting": {
    "fontName": "Arial-Bold",
    "fontSize": 18,
    "isBold": true,
    "isItalic": false
  }
}
```

## Advanced Configuration

### Custom Parser Options

```typescript
const result = await annotationService.parseAndAnnotatePDF(
  pdfBuffer,
  'document.pdf',
  undefined,
  undefined,
  {
    extractImages: true,
    extractText: true,
    detectCaptions: true,
    analyzeHierarchy: true,
    maxImageDistance: 50  // Max distance in points for caption association
  }
);
```

### Direct Database Access

```typescript
import RedactionDatabaseService from './services/RedactionDatabaseService';

const db = RedactionDatabaseService.getInstance();
await db.initialize();

// Query image annotations directly
const images = await db.getImageAnnotations(documentId);

// Query text annotations with hierarchy
const hierarchy = await db.getTextHierarchy(documentId, pageNumber);
```

## Performance Considerations

- **Large PDFs**: Processing time scales with document size and complexity
- **Image Count**: More images = longer processing time
- **Caption Detection**: Can be disabled for performance if not needed
- **Hierarchy Analysis**: Can be disabled for simple documents

## Best Practices

1. **Always initialize services** before use
2. **Handle errors gracefully** - PDF parsing can fail for various reasons
3. **Use page-specific queries** for large documents to reduce memory usage
4. **Export annotations** for backup and integration with other systems
5. **Validate data** using the tester utility before production use

## Troubleshooting

### Common Issues

1. **"Password-protected PDFs are not supported"**
   - Solution: Decrypt PDF before processing

2. **Missing captions**
   - Solution: Adjust `maxImageDistance` parameter

3. **Incorrect hierarchy**
   - Solution: Review font size thresholds in parser configuration

4. **Performance issues**
   - Solution: Process pages individually or disable unnecessary features

## Future Enhancements

- OCR support for scanned documents
- Table structure extraction
- Advanced layout analysis
- Multi-language support
- Cloud storage integration
- Real-time annotation updates
