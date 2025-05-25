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
 }
 
 export const AuthContext = createContext<AuthContextType>({
   user: null,
   login: () => {},
   logout: () => {},
 });
 
 export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
   const [user, setUser] = useState<User | null>(null);
 
   const checkAuthStatus = () => {
     const token = localStorage.getItem('authToken');
     logger.info('AuthProvider: Checking auth status', { token: token ? '[present]' : '[missing]' });
     if (!token) {
       logger.warn('AuthProvider: No token found');
       setUser(null);
       return;
     }
     try {
       const decoded = jwtDecode<User>(token);
       if (!decoded.username || !decoded.role) {
         logger.warn('AuthProvider: Invalid token payload', { decoded });
         setUser(null);
         localStorage.removeItem('authToken');
         return;
       }
       logger.info('AuthProvider: User decoded', {
         username: decoded.username,
         role: decoded.role,
       });
       setUser(decoded);
     } catch (error) {
       logger.error('AuthProvider: Error decoding token', error);
       setUser(null);
       localStorage.removeItem('authToken');
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
         return;
       }
       logger.info('AuthProvider: Login decoded', {
         username: decoded.username,
         role: decoded.role,
       });
       setUser(decoded);
     } catch (error) {
       logger.error('AuthProvider: Login error', error);
       localStorage.removeItem('authToken');
       setUser(null);
     }
   };
 
   const logout = () => {
     logger.info('AuthProvider: Logging out');
     localStorage.removeItem('authToken');
     setUser(null);
   };
 
   return (
     <AuthContext.Provider value={{ user, login, logout }}>
       {children}
     </AuthContext.Provider>
   );
 };