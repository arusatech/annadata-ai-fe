/**
 * MarkdownService - Simplified markdown rendering with KaTeX math support
 * Uses KaTeX's auto-render functionality for reliable math rendering
 */

// Type definitions
interface ServiceState {
  katexAvailable: boolean;
  initialized: boolean;
}

interface KaTeXConfig {
  throwOnError: boolean;
  errorColor: string;
  macros: {
    [key: string]: string;
  };
}

interface ServiceConfig {
  katex: KaTeXConfig;
}

interface ServiceStatus {
  initialized: boolean;
  katexAvailable: boolean;
  config: ServiceConfig;
}

interface MathDelimiter {
  left: string;
  right: string;
  display: boolean;
}

interface RenderMathOptions {
  delimiters: MathDelimiter[];
  throwOnError?: boolean;
  errorColor?: string;
  macros?: {
    [key: string]: string;
  };
}

// Extend Window interface for KaTeX
declare global {
  interface Window {
    katex?: any;
    renderMathInElement?: (element: HTMLElement, options: RenderMathOptions) => void;
  }
}

class MarkdownService {
  private state: ServiceState;
  private config: ServiceConfig;

  constructor() {
    this.state = {
      katexAvailable: false,
      initialized: false
    };
    
    this.config = {
      katex: {
        throwOnError: false,
        errorColor: '#cc0000',
        macros: {
          "\\RR": "\\mathbb{R}",
          "\\NN": "\\mathbb{N}",
          "\\ZZ": "\\mathbb{Z}",
          "\\QQ": "\\mathbb{Q}",
          "\\CC": "\\mathbb{C}"
        }
      }
    };
    
    this.init();
  }

  /**
   * Initialize the service
   */
  private async init(): Promise<void> {
    try {
      await this.waitForKaTeX();
      this.state.initialized = true;
      console.log('✅ [MARKDOWN SERVICE] Initialized successfully');
    } catch (error) {
      console.error('❌ [MARKDOWN SERVICE] Initialization failed:', error);
    }
  }

  /**
   * Wait for KaTeX to be available
   */
  private waitForKaTeX(): Promise<void> {
    return new Promise((resolve, reject) => {
      const maxAttempts: number = 50;
      let attempts: number = 0;

      const checkKaTeX = (): void => {
        attempts++;
        
        if (typeof window.katex !== 'undefined' && typeof window.renderMathInElement !== 'undefined') {
          this.state.katexAvailable = true;
          console.log('✅ [MARKDOWN SERVICE] KaTeX loaded successfully');
          resolve();
        } else if (attempts >= maxAttempts) {
          console.warn('⚠️ [MARKDOWN SERVICE] KaTeX not available after maximum attempts');
          reject(new Error('KaTeX not available'));
        } else {
          setTimeout(checkKaTeX, 100);
        }
      };

      checkKaTeX();
    });
  }

  /**
   * Main render method - converts markdown to HTML and renders math
   * @param markdown - Markdown content
   * @returns Rendered HTML
   */
  public async render(markdown: string): Promise<string> {
    if (!this.validateInput(markdown)) {
      return '';
    }

    try {
      // Convert markdown to HTML
      const html: string = this.parseMarkdown(markdown);
      
      // Create temporary container for math rendering
      const tempContainer: HTMLDivElement = document.createElement('div');
      tempContainer.innerHTML = html;
      
      // Render math if KaTeX is available
      if (this.state.katexAvailable && window.renderMathInElement) {
        window.renderMathInElement(tempContainer, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\(', right: '\\)', display: false },
            { left: '\\[', right: '\\]', display: true }
          ],
          ...this.config.katex
        });
      }
      
      return tempContainer.innerHTML;
    } catch (error) {
      console.error('❌ [MARKDOWN SERVICE] Render failed:', error);
      return this.escapeHtml(markdown);
    }
  }

  /**
   * Synchronous render method for immediate display
   * @param markdown - Markdown content
   * @returns HTML content (math will be rendered later)
   */
  public renderSync(markdown: string): string {
    if (!this.validateInput(markdown)) {
      return '';
    }

    try {
      // Convert markdown to HTML with math placeholders
      const html: string = this.parseMarkdown(markdown);
      
      // Add data attributes for math rendering
      const withMathAttributes: string = this.addMathAttributes(html);
      
      return withMathAttributes;
    } catch (error) {
      console.error('❌ [MARKDOWN SERVICE] Sync render failed:', error);
      return this.escapeHtml(markdown);
    }
  }

  /**
   * Render math in an existing DOM element
   * @param element - DOM element to render math in
   */
  public renderMathInElement(element: HTMLElement): void {
    if (!this.state.katexAvailable || !element || !window.renderMathInElement) {
      return;
    }

    try {
      window.renderMathInElement(element, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false },
          { left: '\\[', right: '\\]', display: true },
          { left: '\\[', right: '\\]', display: true }
        ],
        ...this.config.katex
      });
      
      console.log('✅ [MARKDOWN SERVICE] Math rendered in element');
    } catch (error) {
      console.error('❌ [MARKDOWN SERVICE] Math rendering failed:', error);
    }
  }

  /**
   * Parse markdown to HTML
   * @param markdown - Markdown content
   * @returns HTML content
   */
  private parseMarkdown(markdown: string): string {
    let html: string = markdown
      // Headers
      .replace(/^#### (.*$)/gim, '<h4>$1</h4>')
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      
      // Bold and italic
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      
      // Blockquotes
      .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
      
      // Lists
      .replace(/^\- (.*$)/gim, '<li>$1</li>')
      .replace(/^(\d+)\. (.*$)/gim, '<li>$2</li>')
      
      // Code blocks
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
      
      // Line breaks
      .replace(/\n/g, '<br>');

    // Wrap lists
    html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
    
    // Clean up multiple line breaks
    html = html.replace(/<br><br>/g, '<br>');
    
    return html;
  }

  /**
   * Add math attributes for KaTeX rendering
   * @param html - HTML content
   * @returns HTML with math attributes
   */
  private addMathAttributes(html: string): string {
    // This method is kept simple - KaTeX will handle the math rendering
    // We just need to ensure the HTML is properly formatted
    return html;
  }

  /**
   * Check if content contains markdown
   * @param text - Text to check
   * @returns True if contains markdown
   */
  public containsMarkdown(text: string): boolean {
    if (!this.validateInput(text)) {
      return false;
    }

    const patterns: RegExp[] = [
      /\*\*.*?\*\*/,           // Bold
      /\*.*?\*/,               // Italic
      /`[^`\n]+`/,             // Inline code
      /```[\s\S]*?```/,        // Code blocks
      /\$\$[\s\S]*?\$\$/,      // Display math
      /\$[^\$\n]+\$/,          // Inline math
      /\\\([\s\S]*?\\\)/,      // LaTeX inline math
      /\\\[[\s\S]*?\\\]/,      // LaTeX display math
      /^#{1,6}\s/m,            // Headers
      /^>\s/m,                 // Blockquotes
      /^\s*[-*+\d]+[\.\)]\s/m, // Lists
      /\[.*?\]\(.*?\)/,        // Links
    ];
    
    return patterns.some((pattern: RegExp) => pattern.test(text));
  }

  /**
   * Validate input
   * @param input - Input to validate
   * @returns True if valid
   */
  private validateInput(input: any): input is string {
    return input && typeof input === 'string' && input.trim().length > 0;
  }

  /**
   * Escape HTML
   * @param text - Text to escape
   * @returns Escaped text
   */
  private escapeHtml(text: string): string {
    const div: HTMLDivElement = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Get service status
   * @returns Service status
   */
  public getStatus(): ServiceStatus {
    return {
      initialized: this.state.initialized,
      katexAvailable: this.state.katexAvailable,
      config: this.config
    };
  }
}

// Export singleton instance
export default new MarkdownService();
