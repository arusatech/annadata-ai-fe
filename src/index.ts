import './css/style.css';
import './css/layout.css';
import './css/icons.min.css';
import './css/markdown.css'; // Add markdown CSS

// Remove React Native imports
// import { AppRegistry } from 'react-native';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// Type definitions
interface WindowWithKaTeX extends Window {
  katex?: any;
}

declare global {
  interface Window {
    katex?: any;
  }
}

// Load KaTeX dynamically for browser environments
if (typeof window !== 'undefined') {
  // Function to load KaTeX with better Android WebView support
  const loadKaTeX = (): void => {
    try {
      console.log('🚀 [KATEX] Starting KaTeX loading...');
      
      // Check if already loaded
      if ((window as WindowWithKaTeX).katex) {
        console.log('✅ [KATEX] KaTeX already loaded');
        return;
      }

      // Load KaTeX CSS
      const katexCSS: HTMLLinkElement = document.createElement('link');
      katexCSS.rel = 'stylesheet';
      katexCSS.href = '/assets/katex/katex.css';
      katexCSS.onload = (): void => console.log('✅ [KATEX] CSS loaded');
      katexCSS.onerror = (): void => {
        console.warn('⚠️ [KATEX] Local CSS failed, trying CDN');
        const cdnCSS: HTMLLinkElement = document.createElement('link');
        cdnCSS.rel = 'stylesheet';
        cdnCSS.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.css';
        document.head.appendChild(cdnCSS);
      };
      document.head.appendChild(katexCSS);

      // Load KaTeX JavaScript with proper loading order
      const katexScript: HTMLScriptElement = document.createElement('script');
      katexScript.src = '/assets/katex/katex.js';
      katexScript.onload = (): void => {
        console.log('✅ [KATEX] Main script loaded');
        // Load auto-render after main script
        loadAutoRender();
      };
      katexScript.onerror = (): void => {
        console.warn('⚠️ [KATEX] Local script failed, trying CDN');
        const cdnScript: HTMLScriptElement = document.createElement('script');
        cdnScript.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.js';
        cdnScript.onload = (): void => {
          console.log('✅ [KATEX] CDN main script loaded');
          loadAutoRender();
        };
        document.head.appendChild(cdnScript);
      };
      document.head.appendChild(katexScript);

      // Load auto-render extension
      const loadAutoRender = (): void => {
        const autoRenderScript: HTMLScriptElement = document.createElement('script');
        autoRenderScript.src = '/assets/katex/auto-render.js';
        autoRenderScript.onload = (): void => {
          console.log('✅ [KATEX] Auto-render loaded');
          // Load additional scripts
          loadAdditionalScripts();
        };
        autoRenderScript.onerror = (): void => {
          console.warn('⚠️ [KATEX] Local auto-render failed, trying CDN');
          const cdnAutoRender: HTMLScriptElement = document.createElement('script');
          cdnAutoRender.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/contrib/auto-render.min.js';
          cdnAutoRender.onload = (): void => {
            console.log('✅ [KATEX] CDN auto-render loaded');
            loadAdditionalScripts();
          };
          document.head.appendChild(cdnAutoRender);
        };
        document.head.appendChild(autoRenderScript);
      };

      // Load additional scripts
      const loadAdditionalScripts = (): void => {
        // Load copy-tex.js
        const copyTexScript: HTMLScriptElement = document.createElement('script');
        copyTexScript.src = '/assets/katex/copy-tex.js';
        copyTexScript.onerror = (): void => console.warn('⚠️ [KATEX] Failed to load copy-tex');
        document.head.appendChild(copyTexScript);

        // Load mathtex-script-type.js
        const mathtexScript: HTMLScriptElement = document.createElement('script');
        mathtexScript.src = '/assets/katex/mathtex-script-type.js';
        mathtexScript.onerror = (): void => console.warn('⚠️ [KATEX] Failed to load mathtex');
        document.head.appendChild(mathtexScript);

        // Load mhchem.js
        const mhchemScript: HTMLScriptElement = document.createElement('script');
        mhchemScript.src = '/assets/katex/mhchem.js';
        mhchemScript.onerror = (): void => console.warn('⚠️ [KATEX] Failed to load mhchem');
        document.head.appendChild(mhchemScript);

        // Load render-a11y-string.js
        const renderA11yScript: HTMLScriptElement = document.createElement('script');
        renderA11yScript.src = '/assets/katex/render-a11y-string.js';
        renderA11yScript.onerror = (): void => console.warn('⚠️ [KATEX] Failed to load render-a11y');
        document.head.appendChild(renderA11yScript);

        console.log('✅ [KATEX] All scripts loaded successfully');
      };

    } catch (error: any) {
      console.error('❌ [KATEX] Error loading KaTeX:', error);
    }
  };

  // Load KaTeX immediately
  loadKaTeX();
}

// Fix: Use React DOM instead of AppRegistry
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(React.createElement(App));
}
