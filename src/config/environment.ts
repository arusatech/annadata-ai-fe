// Environment configuration
interface EnvironmentConfig {
  apiBaseUrl: string;
  useSSL: boolean;
  port: number;
}

const ENV: Record<string, EnvironmentConfig> = {
  development: {
    apiBaseUrl: 'https://staging.annadata.ai', // Use staging server directly in development
    useSSL: true,
    port: 443
  },
  staging: {
    apiBaseUrl: 'https://staging.annadata.ai',
    useSSL: true,
    port: 443
  },
  production: {
    apiBaseUrl: 'https://staging.annadata.ai',
    useSSL: true,
    port: 443
  }
};

// Detect environment ONCE at module load
const detectedEnv = ((): string => {
  console.log('[Env] Debug - REACT_APP_ENV:', process.env.REACT_APP_ENV);
  console.log('[Env] Debug - NODE_ENV:', process.env.NODE_ENV);
  console.log('[Env] Debug - Vite DEV:', import.meta.env?.DEV);
  console.log('[Env] Debug - Vite MODE:', import.meta.env?.MODE);
  console.log('[Env] Debug - Vite BASE_URL:', import.meta.env?.BASE_URL);
  console.log('[Env] Debug - All env vars:', Object.keys(process.env).filter(key => key.includes('ENV') || key.includes('MODE')));
  
  // Priority order for environment detection
  if (process.env.REACT_APP_ENV) {
    console.log('[Env] Using REACT_APP_ENV:', process.env.REACT_APP_ENV);
    return process.env.REACT_APP_ENV;
  }
  
  if (import.meta.env?.DEV) {
    console.log('[Env] Using Vite DEV mode (development)');
    return 'development';
  }
  
  if (process.env.NODE_ENV) {
    console.log('[Env] Using NODE_ENV:', process.env.NODE_ENV);
    return process.env.NODE_ENV;
  }
  
  // Default to development if we can't determine
  console.log('[Env] Defaulting to development');
  return 'development';
})();

console.log('[Env] Final detected environment:', detectedEnv);
console.log('[Env] Final config:', ENV[detectedEnv]);

const config: EnvironmentConfig = ENV[detectedEnv];

export { config, ENV };
export default config;
