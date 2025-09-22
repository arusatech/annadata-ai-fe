// src/services/SQLiteService.ts
import { Sqlite, SQLiteConnection } from '@capawesome-team/capacitor-sqlite';

export interface ChatSession {
  id?: number;
  session_id: string;
  device_id: string;
  title?: string;
  created_at: string;
  updated_at: string;
  is_archived: boolean;
  metadata?: any;
}

export interface ChatMessage {
  id?: number;
  message_id: string;
  session_id: string;
  content: string;
  sender: 'user' | 'bot';
  model_used?: string;
  language?: string;
  created_at: string;
  is_error: boolean;
  metadata?: any;
}

export interface MessageVersion {
  id?: number;
  message_id: string;
  version_number: number;
  content: string;
  edited_at: string;
  edit_reason?: string;
}

export interface ChatHistoryItem {
  session_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  first_user_message: string;
  display_title: string;
  formatted_date: string;
}

class SQLiteService {
  private static instance: SQLiteService;
  private databaseId: string | null = null; // Changed from dbConnection
  private readonly DB_NAME = 'chatbot_history.db';
  private readonly DB_VERSION = 1;
  private isInitialized = false;
  private isInitializing = false;
  private initializationPromise: Promise<void> | null = null;

  private constructor() {}

  public static getInstance(): SQLiteService {
    if (!SQLiteService.instance) {
      SQLiteService.instance = new SQLiteService();
    }
    return SQLiteService.instance;
  }

  async initialize(): Promise<void> {
    // If already initialized, return immediately
    if (this.isInitialized) {
      console.log('✅ SQLite already initialized, skipping...');
      return;
    }

    // If initialization is in progress, wait for it to complete
    if (this.isInitializing && this.initializationPromise) {
      console.log('⏳ SQLite initialization in progress, waiting...');
      return this.initializationPromise;
    }

    // Start initialization
    this.isInitializing = true;
    this.initializationPromise = this._performInitialization();

    try {
      await this.initializationPromise;
      this.isInitialized = true;
      console.log('✅ SQLite database initialization completed successfully');
    } catch (error) {
      console.error('❌ SQLite initialization failed:', error);
      throw error;
    } finally {
      this.isInitializing = false;
      this.initializationPromise = null;
    }
  }

  private async _performInitialization(): Promise<void> {
    try {
      console.log('🔧 [SQLite] Starting database initialization...');
      
      // Initialize the plugin
      await Sqlite.initialize({});
      console.log('🔧 [SQLite] Plugin initialized');
      
      // Open database with schema creation
      const result = await Sqlite.open({
        path: this.DB_NAME,
        version: this.DB_VERSION,
        upgradeStatements: [
          {
            version: 1,
            statements: this.getCreateTableStatements()
          }
        ]
      });

      console.log('🔧 [SQLite] Database opened:', result);

      // Store the database ID from the result
      this.databaseId = result.databaseId;

      // Wait for upgrade statements to complete
      await new Promise(resolve => setTimeout(resolve, 300));

      // Try to verify schema, if it fails, create tables manually
      try {
        await this._verifyDatabaseSchema();
        console.log('✅ [SQLite] Database schema verified');
      } catch (verifyError) {
        console.warn('⚠️ [SQLite] Schema verification failed, attempting manual creation...');
        await this._createTablesManually();
        await this._verifyDatabaseSchema(); // Verify again after manual creation
        console.log('✅ [SQLite] Database schema created and verified manually');
      }
      
    } catch (error) {
      console.error('❌ [SQLite] Failed to initialize database:', error);
      this.isInitialized = false;
      throw error;
    }
  }

  private async _createTablesManually(): Promise<void> {
    console.log('🔧 [SQLite] Creating tables manually...');
    const statements = this.getCreateTableStatements();
    
    for (const statement of statements) {
      try {
        await Sqlite.execute({
          databaseId: this.databaseId!, // Use the stored databaseId instead of DB_NAME
          statement: statement
        });
        console.log('✅ [SQLite] Created table:', statement.match(/CREATE TABLE[^(]*\(([^)]*)\)/i)?.[0]?.substring(0, 50) + '...');
      } catch (error) {
        // Log but don't throw for "already exists" errors
        if ((error as Error).message?.includes('already exists')) {
          console.log('ℹ️ [SQLite] Table already exists, skipping...');
        } else {
          console.error('❌ [SQLite] Failed to create table:', error);
          throw error;
        }
      }
    }
  }

  private async _verifyDatabaseSchema(): Promise<void> {
    try {
      // Test if main tables exist by running a simple query
      const sessionsResult = await Sqlite.query({
        databaseId: this.databaseId!, // Use the stored databaseId instead of DB_NAME
        statement: `SELECT name FROM sqlite_master WHERE type='table' AND name='chat_sessions'`
      });
      
      const messagesResult = await Sqlite.query({
        databaseId: this.databaseId!, // Use the stored databaseId instead of DB_NAME
        statement: `SELECT name FROM sqlite_master WHERE type='table' AND name='messages'`
      });
      
      // Check if the results contain the expected tables
      if (!sessionsResult.rows || sessionsResult.rows.length === 0) {
        throw new Error('chat_sessions table not found');
      }
      
      if (!messagesResult.rows || messagesResult.rows.length === 0) {
        throw new Error('messages table not found');
      }
      
      console.log('✅ [SQLite] Database schema verification passed');
    } catch (error) {
      console.error('❌ [SQLite] Database schema verification failed:', error);
      throw error;
    }
  }

  private async _ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  private getCreateTableStatements(): string[] {
    return [
      `CREATE TABLE IF NOT EXISTS chat_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT UNIQUE NOT NULL,
        device_id TEXT NOT NULL,
        title TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_archived BOOLEAN DEFAULT FALSE,
        metadata TEXT
      )`,
      
      `CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id TEXT UNIQUE NOT NULL,
        session_id TEXT NOT NULL,
        content TEXT NOT NULL,
        sender TEXT NOT NULL CHECK (sender IN ('user', 'bot')),
        model_used TEXT,
        language TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_error BOOLEAN DEFAULT FALSE,
        metadata TEXT,
        FOREIGN KEY (session_id) REFERENCES chat_sessions(session_id)
      )`,
      
      `CREATE TABLE IF NOT EXISTS message_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id TEXT NOT NULL,
        version_number INTEGER NOT NULL,
        content TEXT NOT NULL,
        edited_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        edit_reason TEXT,
        FOREIGN KEY (message_id) REFERENCES messages(message_id),
        UNIQUE(message_id, version_number)
      )`,
      
      `CREATE TABLE IF NOT EXISTS session_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        tag TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES chat_sessions(session_id)
      )`,
      
      // Indexes
      `CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id)`,
      `CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_sessions_device_id ON chat_sessions(device_id)`,
      `CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON chat_sessions(updated_at)`
    ];
  }

  // Session Management
  async createSession(deviceId: string, title?: string): Promise<string> {
    await this._ensureInitialized();
    
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    await Sqlite.execute({
      databaseId: this.databaseId!, // Use the stored databaseId instead of DB_NAME
      statement: `INSERT INTO chat_sessions (session_id, device_id, title) VALUES (?, ?, ?)`,
      values: [sessionId, deviceId, title || 'New Chat']
    });

    return sessionId;
  }

  async getSessions(deviceId: string, limit: number = 50): Promise<ChatSession[]> {
    await this._ensureInitialized();
    
    const result = await Sqlite.query({
      databaseId: this.databaseId!, // Use the stored databaseId instead of DB_NAME
      statement: `SELECT * FROM chat_sessions 
                  WHERE device_id = ? AND is_archived = FALSE 
                  ORDER BY updated_at DESC LIMIT ?`,
      values: [deviceId, limit]
    });

    return result.rows.map(row => ({
      id: row[0] as number,
      session_id: row[1] as string,
      device_id: row[2] as string,
      title: row[3] as string,
      created_at: row[4] as string,
      updated_at: row[5] as string,
      is_archived: Boolean(row[6]),
      metadata: row[7] ? JSON.parse(row[7] as string) : null
    }));
  }

  // Message Management
  async saveMessage(message: Omit<ChatMessage, 'id'>): Promise<void> {
    await this._ensureInitialized();
    
    await Sqlite.beginTransaction({ databaseId: this.databaseId! });
    
    try {
      // Insert message
      await Sqlite.execute({
        databaseId: this.databaseId!,
        statement: `INSERT INTO messages (message_id, session_id, content, sender, model_used, language, is_error, metadata) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        values: [
          message.message_id,
          message.session_id,
          message.content,
          message.sender,
          message.model_used || null,
          message.language || null,
          message.is_error ? 1 : 0,
          message.metadata ? JSON.stringify(message.metadata) : null
        ]
      });

      // Update session timestamp
      await Sqlite.execute({
        databaseId: this.databaseId!,
        statement: `UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE session_id = ?`,
        values: [message.session_id]
      });

      await Sqlite.commitTransaction({ databaseId: this.databaseId! });
    } catch (error) {
      await Sqlite.rollbackTransaction({ databaseId: this.databaseId! });
      throw error;
    }
  }

  async getSessionMessages(sessionId: string): Promise<ChatMessage[]> {
    await this._ensureInitialized();
    
    const result = await Sqlite.query({
      databaseId: this.databaseId!,
      statement: `SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC`,
      values: [sessionId]
    });

    return result.rows.map(row => ({
      id: row[0] as number,
      message_id: row[1] as string,
      session_id: row[2] as string,
      content: row[3] as string,
      sender: row[4] as 'user' | 'bot',
      model_used: row[5] as string,
      language: row[6] as string,
      created_at: row[7] as string,
      is_error: Boolean(row[8]),
      metadata: row[9] ? JSON.parse(row[9] as string) : null
    }));
  }

  // Chat History methods
  async getChatHistory(deviceId: string, limit: number = 50): Promise<ChatHistoryItem[]> {
    await this._ensureInitialized();
    
    try {
      const result = await Sqlite.query({
        databaseId: this.databaseId!,
        statement: `
          SELECT 
            cs.session_id,
            cs.title,
            cs.created_at,
            cs.updated_at,
            (SELECT content FROM messages WHERE session_id = cs.session_id AND sender = 'user' ORDER BY created_at ASC LIMIT 1) as first_user_message
          FROM chat_sessions cs
          WHERE cs.device_id = ? AND cs.is_archived = FALSE
          ORDER BY cs.updated_at DESC 
          LIMIT ?`,
        values: [deviceId, limit]
      });

      return result.rows.map(row => ({
        session_id: row[0] as string,
        title: row[1] as string,
        created_at: row[2] as string,
        updated_at: row[3] as string,
        first_user_message: row[4] as string || 'New Chat',
        display_title: this.formatChatTitle(row[1] as string || row[4] as string || 'New Chat'),
        formatted_date: this.formatDate(row[3] as string)
      }));
    } catch (error) {
      console.error('❌ [SQLite] Error loading chat history:', error);
      // Return empty array instead of throwing error to handle gracefully
      return [];
    }
  }

  private formatChatTitle(title: string): string {
    if (!title || title.trim() === '') {
      return 'New Chat';
    }
    
    // Trim to 40 characters and add ellipsis if needed
    return title.length > 40 ? title.substring(0, 40).trim() + '...' : title;
  }

  private formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffInMs = now.getTime() - date.getTime();
      const diffInHours = diffInMs / (1000 * 60 * 60);
      const diffInDays = diffInMs / (1000 * 60 * 60 * 24);

      // If today
      if (diffInHours < 24 && date.getDate() === now.getDate()) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      
      // If yesterday
      if (diffInDays < 2 && diffInDays >= 1) {
        return `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }
      
      // If within a week
      if (diffInDays < 7) {
        return date.toLocaleDateString([], { weekday: 'short' }) + ' ' + 
               date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      
      // Older than a week
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
             date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Unknown time';
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this._ensureInitialized();
    
    await Sqlite.beginTransaction({ databaseId: this.databaseId! });
    
    try {
      // Delete messages first (due to foreign key constraint)
      await Sqlite.execute({
        databaseId: this.databaseId!,
        statement: `DELETE FROM messages WHERE session_id = ?`,
        values: [sessionId]
      });

      // Delete message versions
      await Sqlite.execute({
        databaseId: this.databaseId!,
        statement: `DELETE FROM message_versions WHERE message_id IN 
                    (SELECT message_id FROM messages WHERE session_id = ?)`,
        values: [sessionId]
      });

      // Delete session tags
      await Sqlite.execute({
        databaseId: this.databaseId!,
        statement: `DELETE FROM session_tags WHERE session_id = ?`,
        values: [sessionId]
      });

      // Delete session
      await Sqlite.execute({
        databaseId: this.databaseId!,
        statement: `DELETE FROM chat_sessions WHERE session_id = ?`,
        values: [sessionId]
      });

      await Sqlite.commitTransaction({ databaseId: this.databaseId! });
    } catch (error) {
      await Sqlite.rollbackTransaction({ databaseId: this.databaseId! });
      throw error;
    }
  }

  async updateSessionTitle(sessionId: string, newTitle: string): Promise<void> {
    await this._ensureInitialized();
    
    await Sqlite.execute({
      databaseId: this.databaseId!,
      statement: `UPDATE chat_sessions SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ?`,
      values: [newTitle, sessionId]
    });
  }

  async close(): Promise<void> {
    if (this.isInitialized && this.databaseId) {
      await Sqlite.close({ databaseId: this.databaseId });
      this.isInitialized = false;
      this.databaseId = null;
    }
  }

  // Additional utility methods for better error handling
  async searchMessages(deviceId: string, query: string, limit: number = 20): Promise<ChatMessage[]> {
    await this._ensureInitialized();
    
    const result = await Sqlite.query({
      databaseId: this.databaseId!,
      statement: `SELECT m.* FROM messages m 
                  JOIN chat_sessions s ON m.session_id = s.session_id 
                  WHERE s.device_id = ? AND m.content LIKE ? 
                  ORDER BY m.created_at DESC LIMIT ?`,
      values: [deviceId, `%${query}%`, limit]
    });

    return result.rows.map(row => ({
      id: row[0] as number,
      message_id: row[1] as string,
      session_id: row[2] as string,
      content: row[3] as string,
      sender: row[4] as 'user' | 'bot',
      model_used: row[5] as string,
      language: row[6] as string,
      created_at: row[7] as string,
      is_error: Boolean(row[8]),
      metadata: row[9] ? JSON.parse(row[9] as string) : null
    }));
  }

  // Message Versioning
  async editMessage(messageId: string, newContent: string, reason?: string): Promise<void> {
    await this._ensureInitialized();
    
    await Sqlite.beginTransaction({ databaseId: this.databaseId! });
    
    try {
      // Get current message to create version
      const currentMessage = await Sqlite.query({
        databaseId: this.databaseId!,
        statement: `SELECT content FROM messages WHERE message_id = ?`,
        values: [messageId]
      });

      if (currentMessage.rows.length === 0) {
        throw new Error('Message not found');
      }

      // Get next version number
      const versionResult = await Sqlite.query({
        databaseId: this.databaseId!,
        statement: `SELECT COALESCE(MAX(version_number), 0) + 1 as next_version FROM message_versions WHERE message_id = ?`,
        values: [messageId]
      });

      const nextVersion = versionResult.rows[0][0] as number;

      // Save current content as version
      await Sqlite.execute({
        databaseId: this.databaseId!,
        statement: `INSERT INTO message_versions (message_id, version_number, content, edit_reason) VALUES (?, ?, ?, ?)`,
        values: [messageId, nextVersion, currentMessage.rows[0][0] as string, reason || null]
      });

      // Update message with new content
      await Sqlite.execute({
        databaseId: this.databaseId!,
        statement: `UPDATE messages SET content = ? WHERE message_id = ?`,
        values: [newContent, messageId]
      });

      await Sqlite.commitTransaction({ databaseId: this.databaseId! });
    } catch (error) {
      await Sqlite.rollbackTransaction({ databaseId: this.databaseId! });
      throw error;
    }
  }

  async getMessageVersions(messageId: string): Promise<MessageVersion[]> {
    await this._ensureInitialized();
    
    const result = await Sqlite.query({
      databaseId: this.databaseId!,
      statement: `SELECT * FROM message_versions WHERE message_id = ? ORDER BY version_number DESC`,
      values: [messageId]
    });

    return result.rows.map(row => ({
      id: row[0] as number,
      message_id: row[1] as string,
      version_number: row[2] as number,
      content: row[3] as string,
      edited_at: row[4] as string,
      edit_reason: row[5] as string
    }));
  }
}

export default SQLiteService;
