// src/services/RedactionDatabaseService.ts
import { Sqlite, SQLiteConnection } from '@capawesome-team/capacitor-sqlite';
import { Capacitor } from '@capacitor/core';

/**
 * Redaction Database Service - Manages redaction analysis and user selections
 * 
 * Features:
 * - Store document analysis results
 * - Track user redaction preferences
 * - Manage content sections (text, images, metadata)
 * - Store redaction patterns and results
 * - Enable selective content processing
 */

export interface RedactionDocument {
  id?: number;
  document_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  session_id?: string;
  message_id?: string;
  created_at: string;
  analysis_status: 'pending' | 'analyzing' | 'completed' | 'failed';
  total_sections: number;
  metadata?: any;
}

export interface RedactionSection {
  id?: number;
  document_id: string;
  section_id: string;
  section_type: 'text' | 'image' | 'metadata' | 'form' | 'link' | 'annotation';
  section_index: number;
  page_number?: number;
  content_preview: string;
  content_length: number;
  has_sensitive_content: boolean;
  sensitive_patterns_found: string; // JSON array of pattern names
  confidence_score: number;
  is_user_selected: boolean;
  created_at: string;
  metadata?: any;
}

// Enhanced interfaces for detailed annotation
export interface ImageAnnotation {
  id?: number;
  document_id: string;
  section_id: string;
  page_number: number;
  image_index: number;
  
  // Dimensions in multiple units
  width_px: number;
  height_px: number;
  width_cm?: number;
  height_cm?: number;
  width_inches?: number;
  height_inches?: number;
  
  // Position on page (bounding box)
  bbox_x1: number;
  bbox_y1: number;
  bbox_x2: number;
  bbox_y2: number;
  
  // Caption/Label information
  caption_text?: string;
  caption_position?: 'top' | 'bottom' | 'left' | 'right' | 'none';
  caption_bbox?: string; // JSON array [x1, y1, x2, y2]
  
  // Image properties
  format?: string; // jpeg, png, etc.
  color_space?: string;
  dpi?: number;
  
  // Metadata
  is_inline: boolean;
  has_transparency: boolean;
  created_at: string;
  metadata?: any;
}

export interface TextSectionAnnotation {
  id?: number;
  document_id: string;
  section_id: string;
  page_number: number;
  section_index: number;
  
  // Hierarchical structure
  parent_section_id?: string;
  section_level: number; // 0=page, 1=main section, 2=subsection, etc.
  section_title?: string;
  
  // Content
  content_text: string;
  content_type: 'paragraph' | 'heading' | 'list' | 'table' | 'caption' | 'other';
  word_count: number;
  char_count: number;
  
  // Position
  bbox_x1?: number;
  bbox_y1?: number;
  bbox_x2?: number;
  bbox_y2?: number;
  
  // Text properties
  font_name?: string;
  font_size?: number;
  is_bold: boolean;
  is_italic: boolean;
  text_color?: string;
  
  // Semantic information
  contains_numbers: boolean;
  contains_urls: boolean;
  language?: string;
  
  created_at: string;
  metadata?: any;
}

export interface RedactionPattern {
  id?: number;
  pattern_name: string;
  pattern_regex: string;
  pattern_category: 'pii' | 'financial' | 'medical' | 'legal' | 'other';
  severity: 'high' | 'medium' | 'low';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RedactionResult {
  id?: number;
  document_id: string;
  section_id: string;
  pattern_id: number;
  original_content: string;
  redacted_content: string;
  confidence_score: number;
  bounding_box?: string; // JSON array for coordinates
  page_number?: number;
  created_at: string;
}

export interface UserRedactionPreferences {
  id?: number;
  user_id?: string;
  device_id?: string;
  category: 'pii' | 'financial' | 'medical' | 'legal' | 'other';
  auto_redact: boolean;
  require_confirmation: boolean;
  created_at: string;
  updated_at: string;
}

class RedactionDatabaseService {
  private static instance: RedactionDatabaseService;
  private databaseId: string | null = null;
  private readonly DB_NAME = 'redaction_management.db';
  private readonly DB_VERSION = 2; // Incremented for new tables
  private isInitialized = false;
  private isInitializing = false;
  private initializationPromise: Promise<void> | null = null;
  private isFallbackMode = false; // In-memory fallback for web when OPFS unavailable

  private constructor() {}

  public static getInstance(): RedactionDatabaseService {
    if (!RedactionDatabaseService.instance) {
      RedactionDatabaseService.instance = new RedactionDatabaseService();
    }
    return RedactionDatabaseService.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('✅ [RedactionDB] Already initialized, skipping...');
      return;
    }

    if (this.isInitializing && this.initializationPromise) {
      console.log('⏳ [RedactionDB] Initialization in progress, waiting...');
      return this.initializationPromise;
    }

    this.isInitializing = true;
    this.initializationPromise = this._performInitialization();

    try {
      await this.initializationPromise;
      this.isInitialized = true;
      console.log('✅ [RedactionDB] Database initialization completed successfully');
    } catch (error: any) {
      console.error('❌ [RedactionDB] Initialization failed:', error);
      
      // On web platform with OPFS errors, enable fallback mode instead of crashing
      const platform = Capacitor.getPlatform();
      if (platform === 'web' && error?.result?.message?.includes('no such vfs: opfs')) {
        console.warn('⚠️ [RedactionDB] Enabling fallback mode (in-memory storage only)');
        console.warn('⚠️ [RedactionDB] Document analysis will work but data will not persist');
        this.isFallbackMode = true;
        this.isInitialized = true; // Mark as initialized in fallback mode
      } else {
        // For native platforms or other errors, throw
        throw error;
      }
    } finally {
      this.isInitializing = false;
      this.initializationPromise = null;
    }
  }

  private async _performInitialization(): Promise<void> {
    try {
      const platform = Capacitor.getPlatform();
      const isWeb = platform === 'web';
      
      console.log('🔧 [RedactionDB] Starting database initialization...');
      console.log('🔧 [RedactionDB] Platform:', platform);
      
      // For web platform, check if running on localhost or HTTPS
      if (isWeb) {
        const isSecureContext = window.isSecureContext;
        const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        console.log('🔧 [RedactionDB] Web environment detected');
        console.log('🔧 [RedactionDB] Secure context:', isSecureContext);
        console.log('🔧 [RedactionDB] Localhost:', isLocalhost);
        
        if (!isSecureContext && !isLocalhost) {
          console.warn('⚠️ [RedactionDB] OPFS requires HTTPS or localhost. Database functionality may be limited.');
        }
      }
      
      await Sqlite.initialize({});
      
      // Open database with migration support
      const result = await Sqlite.open({
        path: this.DB_NAME,
        version: this.DB_VERSION,
        upgradeStatements: [
          {
            version: 1,
            statements: this.getCreateTableStatementsV1()
          },
          {
            version: 2,
            statements: this.getMigrationStatementsV2()
          }
        ]
      });

      console.log('🔧 [RedactionDB] Database opened:', result);

      // Store the database ID from the result
      this.databaseId = result.databaseId;

      // Wait for upgrade statements to complete
      await new Promise(resolve => setTimeout(resolve, 300));

      // Try to verify schema, if it fails, create tables manually
      try {
        await this._verifyDatabaseSchema();
        console.log('✅ [RedactionDB] Database schema verified');
      } catch (verifyError) {
        console.warn('⚠️ [RedactionDB] Schema verification failed, attempting manual creation...');
        await this._createTablesManually();
        await this._verifyDatabaseSchema();
        console.log('✅ [RedactionDB] Database schema created and verified manually');
      }
      
      // Initialize default redaction patterns
      await this._initializeDefaultPatterns();
      
    } catch (error: any) {
      console.error('❌ [RedactionDB] Database initialization failed:', error);
      
      // Provide more helpful error messages for common issues
      if (error?.result?.message?.includes('no such vfs: opfs')) {
        const platform = Capacitor.getPlatform();
        if (platform === 'web') {
          console.error('❌ [RedactionDB] OPFS VFS not available. This usually means:');
          console.error('  1. Your browser does not support OPFS (Origin Private File System)');
          console.error('  2. You need to use HTTPS or localhost');
          console.error('  3. Your browser requires certain flags to be enabled');
          console.error('  Solution: Try using Chrome/Edge on HTTPS or enable chrome://flags/#enable-experimental-web-platform-features');
        }
      }
      
      throw error;
    }
  }

  private getCreateTableStatementsV1(): string[] {
    // Version 1: Original tables without enhanced annotations
    return [
      // Documents table
      `CREATE TABLE IF NOT EXISTS redaction_documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id TEXT UNIQUE NOT NULL,
        file_name TEXT NOT NULL,
        file_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        session_id TEXT,
        message_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        analysis_status TEXT DEFAULT 'pending' CHECK (analysis_status IN ('pending', 'analyzing', 'completed', 'failed')),
        total_sections INTEGER DEFAULT 0,
        metadata TEXT
      )`,

      // Sections table
      `CREATE TABLE IF NOT EXISTS redaction_sections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id TEXT NOT NULL,
        section_id TEXT NOT NULL,
        section_type TEXT NOT NULL CHECK (section_type IN ('text', 'image', 'metadata', 'form', 'link', 'annotation')),
        section_index INTEGER NOT NULL,
        page_number INTEGER,
        content_preview TEXT NOT NULL,
        content_length INTEGER NOT NULL,
        has_sensitive_content BOOLEAN DEFAULT FALSE,
        sensitive_patterns_found TEXT DEFAULT '[]',
        confidence_score REAL DEFAULT 0.0,
        is_user_selected BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT,
        FOREIGN KEY (document_id) REFERENCES redaction_documents(document_id),
        UNIQUE(document_id, section_id)
      )`,

      // Redaction patterns table
      `CREATE TABLE IF NOT EXISTS redaction_patterns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pattern_name TEXT UNIQUE NOT NULL,
        pattern_regex TEXT NOT NULL,
        pattern_category TEXT NOT NULL CHECK (pattern_category IN ('pii', 'financial', 'medical', 'legal', 'other')),
        severity TEXT NOT NULL CHECK (severity IN ('high', 'medium', 'low')),
        is_active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Redaction results table
      `CREATE TABLE IF NOT EXISTS redaction_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id TEXT NOT NULL,
        section_id TEXT NOT NULL,
        pattern_id INTEGER NOT NULL,
        original_content TEXT NOT NULL,
        redacted_content TEXT NOT NULL,
        confidence_score REAL NOT NULL,
        bounding_box TEXT,
        page_number INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (document_id) REFERENCES redaction_documents(document_id),
        FOREIGN KEY (section_id) REFERENCES redaction_sections(section_id),
        FOREIGN KEY (pattern_id) REFERENCES redaction_patterns(id)
      )`,

      // User preferences table
      `CREATE TABLE IF NOT EXISTS user_redaction_preferences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT,
        device_id TEXT,
        category TEXT NOT NULL CHECK (category IN ('pii', 'financial', 'medical', 'legal', 'other')),
        auto_redact BOOLEAN DEFAULT TRUE,
        require_confirmation BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(device_id, category)
      )`,

      // Indexes
      `CREATE INDEX IF NOT EXISTS idx_redaction_documents_session_id ON redaction_documents(session_id)`,
      `CREATE INDEX IF NOT EXISTS idx_redaction_documents_created_at ON redaction_documents(created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_redaction_sections_document_id ON redaction_sections(document_id)`,
      `CREATE INDEX IF NOT EXISTS idx_redaction_sections_type ON redaction_sections(section_type)`,
      `CREATE INDEX IF NOT EXISTS idx_redaction_sections_sensitive ON redaction_sections(has_sensitive_content)`,
      `CREATE INDEX IF NOT EXISTS idx_redaction_results_document_id ON redaction_results(document_id)`,
      `CREATE INDEX IF NOT EXISTS idx_redaction_patterns_category ON redaction_patterns(pattern_category)`,
      `CREATE INDEX IF NOT EXISTS idx_redaction_patterns_active ON redaction_patterns(is_active)`
    ];
  }

  private getMigrationStatementsV2(): string[] {
    // Version 2: Add enhanced annotation tables
    return [
      // Image annotations table (detailed image metadata)
      `CREATE TABLE IF NOT EXISTS image_annotations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id TEXT NOT NULL,
        section_id TEXT NOT NULL,
        page_number INTEGER NOT NULL,
        image_index INTEGER NOT NULL,
        width_px REAL NOT NULL,
        height_px REAL NOT NULL,
        width_cm REAL,
        height_cm REAL,
        width_inches REAL,
        height_inches REAL,
        bbox_x1 REAL NOT NULL,
        bbox_y1 REAL NOT NULL,
        bbox_x2 REAL NOT NULL,
        bbox_y2 REAL NOT NULL,
        caption_text TEXT,
        caption_position TEXT CHECK (caption_position IN ('top', 'bottom', 'left', 'right', 'none')),
        caption_bbox TEXT,
        format TEXT,
        color_space TEXT,
        dpi REAL,
        is_inline BOOLEAN DEFAULT FALSE,
        has_transparency BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT,
        FOREIGN KEY (document_id) REFERENCES redaction_documents(document_id),
        FOREIGN KEY (section_id) REFERENCES redaction_sections(section_id),
        UNIQUE(document_id, section_id)
      )`,

      // Text section annotations table (detailed text metadata)
      `CREATE TABLE IF NOT EXISTS text_section_annotations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id TEXT NOT NULL,
        section_id TEXT NOT NULL,
        page_number INTEGER NOT NULL,
        section_index INTEGER NOT NULL,
        parent_section_id TEXT,
        section_level INTEGER NOT NULL DEFAULT 1,
        section_title TEXT,
        content_text TEXT NOT NULL,
        content_type TEXT NOT NULL CHECK (content_type IN ('paragraph', 'heading', 'list', 'table', 'caption', 'other')),
        word_count INTEGER NOT NULL,
        char_count INTEGER NOT NULL,
        bbox_x1 REAL,
        bbox_y1 REAL,
        bbox_x2 REAL,
        bbox_y2 REAL,
        font_name TEXT,
        font_size REAL,
        is_bold BOOLEAN DEFAULT FALSE,
        is_italic BOOLEAN DEFAULT FALSE,
        text_color TEXT,
        contains_numbers BOOLEAN DEFAULT FALSE,
        contains_urls BOOLEAN DEFAULT FALSE,
        language TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT,
        FOREIGN KEY (document_id) REFERENCES redaction_documents(document_id),
        FOREIGN KEY (section_id) REFERENCES redaction_sections(section_id),
        FOREIGN KEY (parent_section_id) REFERENCES text_section_annotations(section_id),
        UNIQUE(document_id, section_id)
      )`,

      // Indexes for new annotation tables
      `CREATE INDEX IF NOT EXISTS idx_image_annotations_document_id ON image_annotations(document_id)`,
      `CREATE INDEX IF NOT EXISTS idx_image_annotations_page_number ON image_annotations(page_number)`,
      `CREATE INDEX IF NOT EXISTS idx_text_annotations_document_id ON text_section_annotations(document_id)`,
      `CREATE INDEX IF NOT EXISTS idx_text_annotations_page_number ON text_section_annotations(page_number)`,
      `CREATE INDEX IF NOT EXISTS idx_text_annotations_parent ON text_section_annotations(parent_section_id)`,
      `CREATE INDEX IF NOT EXISTS idx_text_annotations_type ON text_section_annotations(content_type)`
    ];
  }

  private getCreateTableStatements(): string[] {
    // Combined: All tables for manual creation
    return [
      ...this.getCreateTableStatementsV1(),
      ...this.getMigrationStatementsV2()
    ];
  }

  private async _createTablesManually(): Promise<void> {
    console.log('🔧 [RedactionDB] Creating tables manually...');
    const statements = this.getCreateTableStatements();
    
    for (const statement of statements) {
      try {
        await Sqlite.execute({
          databaseId: this.databaseId!,
          statement: statement
        });
        console.log('✅ [RedactionDB] Created table:', statement.match(/CREATE TABLE[^(]*\(([^)]*)\)/i)?.[0]?.substring(0, 50) + '...');
      } catch (error) {
        if ((error as Error).message?.includes('already exists')) {
          console.log('ℹ️ [RedactionDB] Table already exists, skipping...');
        } else {
          console.error('❌ [RedactionDB] Failed to create table:', error);
          throw error;
        }
      }
    }
  }

  private async _verifyDatabaseSchema(): Promise<void> {
    try {
      // Test if main tables exist by running a simple query
      const documentsResult = await Sqlite.query({
        databaseId: this.databaseId!,
        statement: `SELECT name FROM sqlite_master WHERE type='table' AND name='redaction_documents'`
      });
      
      const sectionsResult = await Sqlite.query({
        databaseId: this.databaseId!,
        statement: `SELECT name FROM sqlite_master WHERE type='table' AND name='redaction_sections'`
      });
      
      // Check if the results contain the expected tables
      if (!documentsResult.rows || documentsResult.rows.length === 0) {
        throw new Error('redaction_documents table not found');
      }
      
      if (!sectionsResult.rows || sectionsResult.rows.length === 0) {
        throw new Error('redaction_sections table not found');
      }
      
    } catch (error) {
      console.error('❌ [RedactionDB] Schema verification failed:', error);
      throw error;
    }
  }

  private async _initializeDefaultPatterns(): Promise<void> {
    const defaultPatterns = [
      {
        pattern_name: 'Email Address',
        pattern_regex: '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b',
        pattern_category: 'pii',
        severity: 'high'
      },
      {
        pattern_name: 'Phone Number',
        pattern_regex: '(\\+?1[-.\\s]?)?\\(?[0-9]{3}\\)?[-.\\s]?[0-9]{3}[-.\\s]?[0-9]{4}',
        pattern_category: 'pii',
        severity: 'high'
      },
      {
        pattern_name: 'SSN',
        pattern_regex: '\\b\\d{3}-?\\d{2}-?\\d{4}\\b',
        pattern_category: 'pii',
        severity: 'high'
      },
      {
        pattern_name: 'Credit Card',
        pattern_regex: '\\b(?:\\d{4}[-\\s]?){3}\\d{4}\\b',
        pattern_category: 'financial',
        severity: 'high'
      },
      {
        pattern_name: 'Bank Account',
        pattern_regex: '\\b\\d{8,17}\\b',
        pattern_category: 'financial',
        severity: 'high'
      },
      {
        pattern_name: 'Address',
        pattern_regex: '\\b\\d+\\s+[A-Za-z0-9\\s,.-]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Way|Place|Pl)\\b',
        pattern_category: 'pii',
        severity: 'medium'
      },
      {
        pattern_name: 'Date of Birth',
        pattern_regex: '\\b(?:0?[1-9]|1[0-2])[\\/\\-](?:0?[1-9]|[12]\\d|3[01])[\\/\\-](?:19|20)\\d{2}\\b',
        pattern_category: 'pii',
        severity: 'high'
      },
      {
        pattern_name: 'Driver License',
        pattern_regex: '\\b[A-Z]\\d{7,8}\\b',
        pattern_category: 'pii',
        severity: 'high'
      },
      {
        pattern_name: 'Passport',
        pattern_regex: '\\b[A-Z]{1,2}\\d{6,9}\\b',
        pattern_category: 'pii',
        severity: 'high'
      },
      {
        pattern_name: 'Medical Record',
        pattern_regex: '\\b(?:MRN|Medical Record|Patient ID)[:\\s]*\\d{6,12}\\b',
        pattern_category: 'medical',
        severity: 'high'
      },
      {
        pattern_name: 'Case Number',
        pattern_regex: '\\b(?:Case|Docket|File)[\\s#:]*[A-Z0-9\\-]{6,20}\\b',
        pattern_category: 'legal',
        severity: 'medium'
      }
    ];

    for (const pattern of defaultPatterns) {
      try {
        await Sqlite.execute({
          databaseId: this.databaseId!,
          statement: `
            INSERT OR IGNORE INTO redaction_patterns 
            (pattern_name, pattern_regex, pattern_category, severity, is_active)
            VALUES (?, ?, ?, ?, ?)
          `,
          values: [pattern.pattern_name, pattern.pattern_regex, pattern.pattern_category, pattern.severity, 1]
        });
      } catch (error) {
        console.warn('⚠️ [RedactionDB] Failed to insert pattern:', pattern.pattern_name, error);
      }
    }
    
    console.log('✅ [RedactionDB] Default patterns initialized');
  }

  // Document Management
  async createDocument(document: Omit<RedactionDocument, 'id'>): Promise<string> {
    if (this.isFallbackMode) {
      console.log('⚠️ [RedactionDB] Fallback mode - document not persisted:', document.document_id);
      return document.document_id;
    }
    
    try {
      await Sqlite.execute({
        databaseId: this.databaseId!,
        statement: `
          INSERT INTO redaction_documents 
          (document_id, file_name, file_type, file_size, session_id, message_id, analysis_status, total_sections, metadata)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        values: [
          document.document_id,
          document.file_name,
          document.file_type,
          document.file_size,
          document.session_id || null,
          document.message_id || null,
          document.analysis_status,
          document.total_sections,
          document.metadata ? JSON.stringify(document.metadata) : null
        ]
      });
      
      console.log('✅ [RedactionDB] Document created:', document.document_id);
      return document.document_id;
    } catch (error) {
      console.error('❌ [RedactionDB] Failed to create document:', error);
      throw error;
    }
  }

  async updateDocumentStatus(documentId: string, status: RedactionDocument['analysis_status'], totalSections?: number): Promise<void> {
    if (this.isFallbackMode) {
      console.log('⚠️ [RedactionDB] Fallback mode - status update not persisted:', documentId, status);
      return;
    }
    
    try {
      let statement = 'UPDATE redaction_documents SET analysis_status = ?';
      const values: any[] = [status];
      
      if (totalSections !== undefined) {
        statement += ', total_sections = ?';
        values.push(totalSections);
      }
      
      statement += ' WHERE document_id = ?';
      values.push(documentId);
      
      await Sqlite.execute({
        databaseId: this.databaseId!,
        statement,
        values
      });
      
      console.log('✅ [RedactionDB] Document status updated:', documentId, status);
    } catch (error) {
      console.error('❌ [RedactionDB] Failed to update document status:', error);
      throw error;
    }
  }

  async getDocument(documentId: string): Promise<RedactionDocument | null> {
    if (this.isFallbackMode) {
      console.log('⚠️ [RedactionDB] Fallback mode - returning null for document:', documentId);
      return null;
    }
    
    try {
      const result = await Sqlite.query({
        databaseId: this.databaseId!,
        statement: 'SELECT * FROM redaction_documents WHERE document_id = ?',
        values: [documentId]
      });
      
      if (result.rows && result.rows.length > 0) {
        const doc = result.rows[0] as any;
        return {
          id: doc[0],
          document_id: doc[1],
          file_name: doc[2],
          file_type: doc[3],
          file_size: doc[4],
          session_id: doc[5],
          message_id: doc[6],
          created_at: doc[7],
          analysis_status: doc[8],
          total_sections: doc[9],
          metadata: doc[10] ? JSON.parse(doc[10]) : null
        };
      }
      
      return null;
    } catch (error) {
      console.error('❌ [RedactionDB] Failed to get document:', error);
      throw error;
    }
  }

  // Section Management
  async createSection(section: Omit<RedactionSection, 'id'>): Promise<number> {
    if (this.isFallbackMode) {
      console.log('⚠️ [RedactionDB] Fallback mode - section not persisted:', section.section_id);
      return 0; // Return a dummy ID
    }
    
    try {
      const result = await Sqlite.execute({
        databaseId: this.databaseId!,
        statement: `
          INSERT INTO redaction_sections 
          (document_id, section_id, section_type, section_index, page_number, content_preview, 
           content_length, has_sensitive_content, sensitive_patterns_found, confidence_score, 
           is_user_selected, metadata)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        values: [
          section.document_id,
          section.section_id,
          section.section_type,
          section.section_index,
          section.page_number || null,
          section.content_preview,
          section.content_length,
          section.has_sensitive_content ? 1 : 0,
          JSON.stringify(section.sensitive_patterns_found),
          section.confidence_score,
          section.is_user_selected ? 1 : 0,
          section.metadata ? JSON.stringify(section.metadata) : null
        ]
      });
      
      console.log('✅ [RedactionDB] Section created:', section.section_id);
      return result.changes || 0;
    } catch (error) {
      console.error('❌ [RedactionDB] Failed to create section:', error);
      throw error;
    }
  }

  async getDocumentSections(documentId: string): Promise<RedactionSection[]> {
    try {
      const result = await Sqlite.query({
        databaseId: this.databaseId!,
        statement: `
          SELECT * FROM redaction_sections 
          WHERE document_id = ? 
          ORDER BY section_index ASC
        `,
        values: [documentId]
      });
      
      if (result.rows) {
        return result.rows.map((row: any) => ({
          id: row[0],
          document_id: row[1],
          section_id: row[2],
          section_type: row[3],
          section_index: row[4],
          page_number: row[5],
          content_preview: row[6],
          content_length: row[7],
          has_sensitive_content: row[8],
          sensitive_patterns_found: JSON.parse(row[9]),
          confidence_score: row[10],
          is_user_selected: row[11],
          created_at: row[12],
          metadata: row[13] ? JSON.parse(row[13]) : null
        }));
      }
      
      return [];
    } catch (error) {
      console.error('❌ [RedactionDB] Failed to get document sections:', error);
      throw error;
    }
  }

  async updateSectionSelection(sectionId: string, isSelected: boolean): Promise<void> {
    try {
      await Sqlite.execute({
        databaseId: this.databaseId!,
        statement: `
          UPDATE redaction_sections 
          SET is_user_selected = ? 
          WHERE section_id = ?
        `,
        values: [isSelected ? 1 : 0, sectionId]
      });
      
      console.log('✅ [RedactionDB] Section selection updated:', sectionId, isSelected);
    } catch (error) {
      console.error('❌ [RedactionDB] Failed to update section selection:', error);
      throw error;
    }
  }

  async updateSectionSelectionBulk(documentId: string, selections: { [sectionId: string]: boolean }): Promise<void> {
    try {
      await Sqlite.beginTransaction({ databaseId: this.databaseId! });
      
      for (const [sectionId, isSelected] of Object.entries(selections)) {
        await Sqlite.execute({
          databaseId: this.databaseId!,
          statement: `
            UPDATE redaction_sections 
            SET is_user_selected = ? 
            WHERE document_id = ? AND section_id = ?
          `,
          values: [isSelected ? 1 : 0, documentId, sectionId]
        });
      }
      
      await Sqlite.commitTransaction({ databaseId: this.databaseId! });
      
      console.log('✅ [RedactionDB] Bulk section selection updated:', Object.keys(selections).length, 'sections');
    } catch (error) {
      await Sqlite.rollbackTransaction({ databaseId: this.databaseId! });
      console.error('❌ [RedactionDB] Failed to update bulk section selection:', error);
      throw error;
    }
  }

  // Redaction Results
  async createRedactionResult(result: Omit<RedactionResult, 'id'>): Promise<number> {
    try {
      const dbResult = await Sqlite.execute({
        databaseId: this.databaseId!,
        statement: `
          INSERT INTO redaction_results 
          (document_id, section_id, pattern_id, original_content, redacted_content, 
           confidence_score, bounding_box, page_number)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        values: [
          result.document_id,
          result.section_id,
          result.pattern_id,
          result.original_content,
          result.redacted_content,
          result.confidence_score,
          result.bounding_box ? JSON.stringify(result.bounding_box) : null,
          result.page_number || null
        ]
      });
      
      return dbResult.changes || 0;
    } catch (error) {
      console.error('❌ [RedactionDB] Failed to create redaction result:', error);
      throw error;
    }
  }

  async getSelectedContent(documentId: string): Promise<RedactionSection[]> {
    try {
      const result = await Sqlite.query({
        databaseId: this.databaseId!,
        statement: `
          SELECT * FROM redaction_sections 
          WHERE document_id = ? AND is_user_selected = TRUE
          ORDER BY section_index ASC
        `,
        values: [documentId]
      });
      
      if (result.rows) {
        return result.rows.map((row: any) => ({
          id: row[0],
          document_id: row[1],
          section_id: row[2],
          section_type: row[3],
          section_index: row[4],
          page_number: row[5],
          content_preview: row[6],
          content_length: row[7],
          has_sensitive_content: row[8],
          sensitive_patterns_found: JSON.parse(row[9]),
          confidence_score: row[10],
          is_user_selected: row[11],
          created_at: row[12],
          metadata: row[13] ? JSON.parse(row[13]) : null
        }));
      }
      
      return [];
    } catch (error) {
      console.error('❌ [RedactionDB] Failed to get selected content:', error);
      throw error;
    }
  }

  // User Preferences
  async getUserPreferences(deviceId: string): Promise<UserRedactionPreferences[]> {
    try {
      const result = await Sqlite.query({
        databaseId: this.databaseId!,
        statement: `
          SELECT * FROM user_redaction_preferences 
          WHERE device_id = ? OR device_id IS NULL
          ORDER BY category ASC
        `,
        values: [deviceId]
      });
      
      if (result.rows) {
        return result.rows.map((row: any) => ({
          id: row[0],
          user_id: row[1],
          device_id: row[2],
          category: row[3],
          auto_redact: row[4],
          require_confirmation: row[5],
          created_at: row[6],
          updated_at: row[7]
        }));
      }
      
      return [];
    } catch (error) {
      console.error('❌ [RedactionDB] Failed to get user preferences:', error);
      throw error;
    }
  }

  async updateUserPreferences(deviceId: string, preferences: Partial<UserRedactionPreferences>[]): Promise<void> {
    try {
      await Sqlite.beginTransaction({ databaseId: this.databaseId! });
      
      for (const pref of preferences) {
        await Sqlite.execute({
          databaseId: this.databaseId!,
          statement: `
            INSERT OR REPLACE INTO user_redaction_preferences 
            (device_id, category, auto_redact, require_confirmation, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
          `,
          values: [
            deviceId,
            pref.category || 'other',
            (pref.auto_redact ?? true) ? 1 : 0,
            (pref.require_confirmation ?? true) ? 1 : 0
          ]
        });
      }
      
      await Sqlite.commitTransaction({ databaseId: this.databaseId! });
      
      console.log('✅ [RedactionDB] User preferences updated');
    } catch (error) {
      await Sqlite.rollbackTransaction({ databaseId: this.databaseId! });
      console.error('❌ [RedactionDB] Failed to update user preferences:', error);
      throw error;
    }
  }

  // Enhanced Annotation Methods
  
  /**
   * Create image annotation with dimensions and caption
   */
  async createImageAnnotation(annotation: Omit<ImageAnnotation, 'id'>): Promise<number> {
    if (this.isFallbackMode) {
      return 0; // Return dummy ID in fallback mode
    }
    
    try {
      const result = await Sqlite.execute({
        databaseId: this.databaseId!,
        statement: `
          INSERT INTO image_annotations 
          (document_id, section_id, page_number, image_index, 
           width_px, height_px, width_cm, height_cm, width_inches, height_inches,
           bbox_x1, bbox_y1, bbox_x2, bbox_y2,
           caption_text, caption_position, caption_bbox,
           format, color_space, dpi, is_inline, has_transparency, metadata)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        values: [
          annotation.document_id,
          annotation.section_id,
          annotation.page_number,
          annotation.image_index,
          annotation.width_px,
          annotation.height_px,
          annotation.width_cm || null,
          annotation.height_cm || null,
          annotation.width_inches || null,
          annotation.height_inches || null,
          annotation.bbox_x1,
          annotation.bbox_y1,
          annotation.bbox_x2,
          annotation.bbox_y2,
          annotation.caption_text || null,
          annotation.caption_position || null,
          annotation.caption_bbox || null,
          annotation.format || null,
          annotation.color_space || null,
          annotation.dpi || null,
          annotation.is_inline ? 1 : 0,
          annotation.has_transparency ? 1 : 0,
          annotation.metadata ? JSON.stringify(annotation.metadata) : null
        ]
      });
      
      console.log('✅ [RedactionDB] Image annotation created:', annotation.section_id);
      return result.changes || 0;
    } catch (error) {
      console.error('❌ [RedactionDB] Failed to create image annotation:', error);
      throw error;
    }
  }

  /**
   * Get image annotations for a document
   */
  async getImageAnnotations(documentId: string, pageNumber?: number): Promise<ImageAnnotation[]> {
    if (this.isFallbackMode) {
      return []; // Return empty array in fallback mode
    }
    
    try {
      let statement = `SELECT * FROM image_annotations WHERE document_id = ?`;
      const values: any[] = [documentId];
      
      if (pageNumber !== undefined) {
        statement += ' AND page_number = ?';
        values.push(pageNumber);
      }
      
      statement += ' ORDER BY page_number, image_index';
      
      const result = await Sqlite.query({
        databaseId: this.databaseId!,
        statement,
        values
      });
      
      if (result.rows) {
        return result.rows.map((row: any) => ({
          id: row[0],
          document_id: row[1],
          section_id: row[2],
          page_number: row[3],
          image_index: row[4],
          width_px: row[5],
          height_px: row[6],
          width_cm: row[7],
          height_cm: row[8],
          width_inches: row[9],
          height_inches: row[10],
          bbox_x1: row[11],
          bbox_y1: row[12],
          bbox_x2: row[13],
          bbox_y2: row[14],
          caption_text: row[15],
          caption_position: row[16],
          caption_bbox: row[17],
          format: row[18],
          color_space: row[19],
          dpi: row[20],
          is_inline: row[21],
          has_transparency: row[22],
          created_at: row[23],
          metadata: row[24] ? JSON.parse(row[24]) : null
        }));
      }
      
      return [];
    } catch (error) {
      console.error('❌ [RedactionDB] Failed to get image annotations:', error);
      throw error;
    }
  }

  /**
   * Create text section annotation with hierarchical structure
   */
  async createTextAnnotation(annotation: Omit<TextSectionAnnotation, 'id'>): Promise<number> {
    if (this.isFallbackMode) {
      return 0; // Return dummy ID in fallback mode
    }
    
    try {
      const result = await Sqlite.execute({
        databaseId: this.databaseId!,
        statement: `
          INSERT INTO text_section_annotations 
          (document_id, section_id, page_number, section_index,
           parent_section_id, section_level, section_title,
           content_text, content_type, word_count, char_count,
           bbox_x1, bbox_y1, bbox_x2, bbox_y2,
           font_name, font_size, is_bold, is_italic, text_color,
           contains_numbers, contains_urls, language, metadata)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        values: [
          annotation.document_id,
          annotation.section_id,
          annotation.page_number,
          annotation.section_index,
          annotation.parent_section_id || null,
          annotation.section_level,
          annotation.section_title || null,
          annotation.content_text,
          annotation.content_type,
          annotation.word_count,
          annotation.char_count,
          annotation.bbox_x1 || null,
          annotation.bbox_y1 || null,
          annotation.bbox_x2 || null,
          annotation.bbox_y2 || null,
          annotation.font_name || null,
          annotation.font_size || null,
          annotation.is_bold ? 1 : 0,
          annotation.is_italic ? 1 : 0,
          annotation.text_color || null,
          annotation.contains_numbers ? 1 : 0,
          annotation.contains_urls ? 1 : 0,
          annotation.language || null,
          annotation.metadata ? JSON.stringify(annotation.metadata) : null
        ]
      });
      
      console.log('✅ [RedactionDB] Text annotation created:', annotation.section_id);
      return result.changes || 0;
    } catch (error) {
      console.error('❌ [RedactionDB] Failed to create text annotation:', error);
      throw error;
    }
  }

  /**
   * Get text section annotations for a document
   */
  async getTextAnnotations(documentId: string, pageNumber?: number): Promise<TextSectionAnnotation[]> {
    if (this.isFallbackMode) {
      return []; // Return empty array in fallback mode
    }
    
    try {
      let statement = `SELECT * FROM text_section_annotations WHERE document_id = ?`;
      const values: any[] = [documentId];
      
      if (pageNumber !== undefined) {
        statement += ' AND page_number = ?';
        values.push(pageNumber);
      }
      
      statement += ' ORDER BY page_number, section_index';
      
      const result = await Sqlite.query({
        databaseId: this.databaseId!,
        statement,
        values
      });
      
      if (result.rows) {
        return result.rows.map((row: any) => ({
          id: row[0],
          document_id: row[1],
          section_id: row[2],
          page_number: row[3],
          section_index: row[4],
          parent_section_id: row[5],
          section_level: row[6],
          section_title: row[7],
          content_text: row[8],
          content_type: row[9],
          word_count: row[10],
          char_count: row[11],
          bbox_x1: row[12],
          bbox_y1: row[13],
          bbox_x2: row[14],
          bbox_y2: row[15],
          font_name: row[16],
          font_size: row[17],
          is_bold: row[18],
          is_italic: row[19],
          text_color: row[20],
          contains_numbers: row[21],
          contains_urls: row[22],
          language: row[23],
          created_at: row[24],
          metadata: row[25] ? JSON.parse(row[25]) : null
        }));
      }
      
      return [];
    } catch (error) {
      console.error('❌ [RedactionDB] Failed to get text annotations:', error);
      throw error;
    }
  }

  /**
   * Get hierarchical text structure for a page
   */
  async getTextHierarchy(documentId: string, pageNumber: number): Promise<TextSectionAnnotation[]> {
    if (this.isFallbackMode) {
      return []; // Return empty array in fallback mode
    }
    
    try {
      const result = await Sqlite.query({
        databaseId: this.databaseId!,
        statement: `
          WITH RECURSIVE section_tree AS (
            -- Base case: top-level sections
            SELECT *, 0 as depth
            FROM text_section_annotations
            WHERE document_id = ? AND page_number = ? AND parent_section_id IS NULL
            
            UNION ALL
            
            -- Recursive case: child sections
            SELECT t.*, st.depth + 1
            FROM text_section_annotations t
            INNER JOIN section_tree st ON t.parent_section_id = st.section_id
            WHERE t.document_id = ? AND t.page_number = ?
          )
          SELECT * FROM section_tree
          ORDER BY depth, section_index
        `,
        values: [documentId, pageNumber, documentId, pageNumber]
      });
      
      if (result.rows) {
        return result.rows.map((row: any) => ({
          id: row[0],
          document_id: row[1],
          section_id: row[2],
          page_number: row[3],
          section_index: row[4],
          parent_section_id: row[5],
          section_level: row[6],
          section_title: row[7],
          content_text: row[8],
          content_type: row[9],
          word_count: row[10],
          char_count: row[11],
          bbox_x1: row[12],
          bbox_y1: row[13],
          bbox_x2: row[14],
          bbox_y2: row[15],
          font_name: row[16],
          font_size: row[17],
          is_bold: row[18],
          is_italic: row[19],
          text_color: row[20],
          contains_numbers: row[21],
          contains_urls: row[22],
          language: row[23],
          created_at: row[24],
          metadata: row[25] ? JSON.parse(row[25]) : null
        }));
      }
      
      return [];
    } catch (error) {
      console.error('❌ [RedactionDB] Failed to get text hierarchy:', error);
      throw error;
    }
  }

  // Utility Methods
  async isServiceInitialized(): Promise<boolean> {
    return this.isInitialized;
  }

  async close(): Promise<void> {
    if (this.databaseId) {
      await Sqlite.close({ databaseId: this.databaseId });
      this.databaseId = null;
      this.isInitialized = false;
      console.log('✅ [RedactionDB] Database closed');
    }
  }
}

export default RedactionDatabaseService;