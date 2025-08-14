// Environment configuration
interface EnvironmentConfig {
  apiBaseUrl: string;
  useSSL: boolean;
  port: number;
}

const ENV: Record<string, EnvironmentConfig> = {
  development: {
    apiBaseUrl: process.env.NODE_ENV === 'development' ? '' : 'http://127.0.0.1:8000', // Use proxy in development
    useSSL: false,
    port: 8000
  },
  staging: {
    apiBaseUrl: 'https://staging.annadata.ai',
    useSSL: true,
    port: 443
  },
  production: {
    apiBaseUrl: 'https://annadata.ai',
    useSSL: true,
    port: 443
  }
};

// Detect environment ONCE at module load
const detectedEnv = ((): string => {
  console.log('[Env] Debug - REACT_APP_ENV:', process.env.REACT_APP_ENV);
  console.log('[Env] Debug - NODE_ENV:', process.env.NODE_ENV);
  console.log('[Env] Debug - All env vars:', Object.keys(process.env).filter(key => key.includes('ENV')));
  
  // Prioritize REACT_APP_ENV over NODE_ENV
  if (process.env.REACT_APP_ENV === 'staging') {
    console.log('[Env] Detected environment: staging');
    return 'staging';
  } else if (process.env.REACT_APP_ENV === 'production') {
    console.log('[Env] Detected environment: production');
    return 'production';
  } else if (process.env.NODE_ENV === 'production') {
    console.log('[Env] Detected environment: production (from NODE_ENV)');
    return 'production';
  } else {
    console.log('[Env] Detected environment: development');
    return 'development';
  }
})();

const config: EnvironmentConfig = ENV[detectedEnv] || ENV.development;
console.log('[Env] Selected config:', config);
console.log('[Env] Final API Base URL:', config.apiBaseUrl);

export const isDevelopment: boolean = detectedEnv === 'development';
export const isProduction: boolean = detectedEnv === 'production';
export const isStaging: boolean = detectedEnv === 'staging';
export { config, ENV };
export default config;
