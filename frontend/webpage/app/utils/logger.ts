export const logger = {
   info: (message: string, data?: Record<string, any>) => {
     console.log(`[INFO] ${new Date().toISOString()} ${message}`, data || '');
   },
   warn: (message: string, data?: Record<string, any>) => {
     console.warn(`[WARN] ${new Date().toISOString()} ${message}`, data || '');
   },
   error: (message: string, error?: any) => {
     console.error(`[ERROR] ${new Date().toISOString()} ${message}`, error);
   },
 };