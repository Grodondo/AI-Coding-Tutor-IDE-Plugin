import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import { useEffect, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router';
import type { Route } from "./+types/root";
import "./app.css";
import { Navbar } from "./components/Navbar";
import { AuthProvider, AuthContext } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Router } from 'react-router';

// Keep the links function unchanged
export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
  { rel: "stylesheet", href: "/app.css" },
];

// Keep the Layout component unchanged
export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useContext(AuthContext);

  useEffect(() => {
    console.log('AppContent: Checking admin route', {
      pathname: location.pathname,
      user,
      isAdmin: user?.role === 'admin',
    });
    if (location.pathname.startsWith('/admin') && user?.role !== 'admin') {
      console.log('AppContent: Redirecting to /auth/login');
      navigate('/auth/login');
    }
  }, [location, user, navigate]);

  // Determine if navbar should be shown
  const shouldShowNavbar = () => {
    // Always show navbar if user is authenticated
    if (user) return true;
    
    // Hide navbar for non-authenticated users on home and about pages
    const currentPath = location.pathname;
    if (currentPath === '/' || currentPath === '/about') {
      return false;
    }
    
    // Show navbar for all other pages (like auth pages)
    return true;
  };

  return (
    <Layout>
      {shouldShowNavbar() && <Navbar />}
      <Outlet />
    </Layout>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

// Keep the ErrorBoundary unchanged
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}