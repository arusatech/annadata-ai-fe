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
  console.log('[Env] Debug - VITE_APP_ENV:', import.meta.env.VITE_APP_ENV);
  console.log('[Env] Debug - MODE:', import.meta.env.MODE);
  console.log('[Env] Debug - DEV:', import.meta.env.DEV);
  console.log('[Env] Debug - PROD:', import.meta.env.PROD);
  console.log('[Env] Debug - BASE_URL:', import.meta.env.BASE_URL);
  
  // Priority order for environment detection
  if (import.meta.env.VITE_APP_ENV) {
    console.log('[Env] Using VITE_APP_ENV:', import.meta.env.VITE_APP_ENV);
    return import.meta.env.VITE_APP_ENV as string;
  }
  
  if (import.meta.env.DEV) {
    console.log('[Env] Using Vite DEV mode (development)');
    return 'development';
  }
  
  if (import.meta.env.MODE) {
    console.log('[Env] Using MODE:', import.meta.env.MODE);
    return import.meta.env.MODE;
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
