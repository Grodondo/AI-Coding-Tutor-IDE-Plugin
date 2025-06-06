'use client';
import { createContext, useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import { logger } from '../utils/logger';

interface User {
   username: string;
   role: string;
   profileImage?: string;
 }
  interface AuthContextType {
   user: User | null;
   login: (token: string) => void;
   logout: () => void;
   isLoading: boolean;
 }
 
 export const AuthContext = createContext<AuthContextType>({
   user: null,
   login: () => {},
   logout: () => {},
   isLoading: true,
 });
 
 export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
   const [user, setUser] = useState<User | null>(null);
   const [isLoading, setIsLoading] = useState(true);
   const checkAuthStatus = () => {
     const token = localStorage.getItem('authToken');
     logger.info('AuthProvider: Checking auth status', { token: token ? '[present]' : '[missing]' });
     if (!token) {
       logger.warn('AuthProvider: No token found');
       setUser(null);
       setIsLoading(false);
       return;
     }
     try {
       const decoded = jwtDecode<User>(token);
       if (!decoded.username || !decoded.role) {
         logger.warn('AuthProvider: Invalid token payload', { decoded });
         setUser(null);
         localStorage.removeItem('authToken');
         setIsLoading(false);
         return;
       }
       logger.info('AuthProvider: User decoded', {
         username: decoded.username,
         role: decoded.role,
       });
       setUser(decoded);
       setIsLoading(false);
     } catch (error) {
       logger.error('AuthProvider: Error decoding token', error);
       setUser(null);
       localStorage.removeItem('authToken');
       setIsLoading(false);
     }
   };
 
   useEffect(() => {
     logger.info('AuthProvider: Initializing');
     checkAuthStatus();
     window.addEventListener('storage', checkAuthStatus);
     return () => window.removeEventListener('storage', checkAuthStatus);
   }, []);
   const login = (token: string) => {
     logger.info('AuthProvider: Logging in');
     localStorage.setItem('authToken', token);
     try {
       const decoded = jwtDecode<User>(token);
       if (!decoded.username || !decoded.role) {
         logger.warn('AuthProvider: Invalid login token payload', { decoded });
         localStorage.removeItem('authToken');
         setIsLoading(false);
         return;
       }
       logger.info('AuthProvider: Login decoded', {
         username: decoded.username,
         role: decoded.role,
       });
       setUser(decoded);
       setIsLoading(false);
     } catch (error) {
       logger.error('AuthProvider: Login error', error);
       localStorage.removeItem('authToken');
       setUser(null);
       setIsLoading(false);
     }
   };
 
   const logout = () => {
     logger.info('AuthProvider: Logging out');
     localStorage.removeItem('authToken');
     setUser(null);
   };
   return (
     <AuthContext.Provider value={{ user, login, logout, isLoading }}>
       {children}
     </AuthContext.Provider>
   );
 };