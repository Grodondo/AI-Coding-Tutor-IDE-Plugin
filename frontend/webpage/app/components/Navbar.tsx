'use client';
import { useState, useContext } from 'react';
import { Link, useNavigate, useLocation } from 'react-router';
import { AuthContext } from '../context/AuthContext';
import { logger } from '../utils/logger';
import { 
    FaChevronDown, 
    FaUser, 
    FaCog, 
    FaSignOutAlt,
    FaHome,
    FaInfoCircle,
    FaComments,
    FaUsers,
    FaCogs
} from 'react-icons/fa';

export const Navbar = () => {  const { user, logout } = useContext(AuthContext);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const handleSignOut = () => {
    logger.info('Navbar: User signed out', { username: user?.username });
    logout();
    setProfileDropdownOpen(false);
    navigate('/');
  };

  const isActiveRoute = (path: string) => {
    return location.pathname === path;
  };

  const navLinkClass = (path: string) => {
    const baseClass = "flex items-center px-3 py-2 rounded-lg font-medium transition-all duration-200 relative";
    const activeClass = "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30";
    const inactiveClass = "text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700";
    
    return `${baseClass} ${isActiveRoute(path) ? activeClass : inactiveClass}`;
  };

  logger.info('Navbar: Rendering', { user: user ? { username: user.username, role: user.role } : null });
  return (
    <nav className="bg-white dark:bg-gray-900 shadow-lg border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link to="/" className="flex items-center space-x-2 group">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow duration-200">
                <span className="text-white font-bold text-lg">AI</span>
              </div>
              <span className="text-2xl font-bold">
                <span className="text-gray-800 dark:text-white">AI</span>
                <span className="text-blue-600 dark:text-blue-400">Tutor</span>
              </span>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center space-x-2">
            <Link to="/" className={navLinkClass('/')}>
              <FaHome className="mr-2 text-sm" />
              Home
              {isActiveRoute('/') && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full"></div>
              )}
            </Link>
            <Link to="/about" className={navLinkClass('/about')}>
              <FaInfoCircle className="mr-2 text-sm" />
              About
              {isActiveRoute('/about') && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full"></div>
              )}
            </Link>
            {user && (
              <Link to="/chat" className={navLinkClass('/chat')}>
                <FaComments className="mr-2 text-sm" />
                Chat
                {isActiveRoute('/chat') && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full"></div>
                )}
              </Link>
            )}
            {user?.role === 'admin' && (
              <>
                <Link to="/admin/settings" className={navLinkClass('/admin/settings')}>
                  <FaCogs className="mr-2 text-sm" />
                  AI Settings
                  {isActiveRoute('/admin/settings') && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full"></div>
                  )}
                </Link>
                <Link to="/admin/users" className={navLinkClass('/admin/users')}>
                  <FaUsers className="mr-2 text-sm" />
                  Users
                  {isActiveRoute('/admin/users') && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full"></div>
                  )}
                </Link>
              </>
            )}
          </div>          <div className="flex items-center space-x-4">
            {/* User Profile or Auth Button */}
            {user ? (
              <div className="flex items-center space-x-3">
                {/* Profile Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                    className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 group"
                  >
                    <div className="relative">
                      {user.profileImage ? (
                        <img
                          src={user.profileImage}
                          alt="Profile"
                          className="w-10 h-10 rounded-full ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-900"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold shadow-lg">
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white dark:border-gray-900 rounded-full"></div>
                    </div>
                    <div className="hidden sm:block text-left">
                      <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        {user.username}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                        {user.role}
                      </div>
                    </div>
                    <FaChevronDown className={`text-gray-400 text-sm transition-transform duration-200 ${profileDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Dropdown Menu */}
                  {profileDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 py-2 z-50">
                      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg">
                            {user.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-900 dark:text-white">
                              {user.username}
                            </div>                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="py-2">
                        <Link
                          to="/profile"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="flex items-center px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          <FaUser className="mr-3 text-gray-400" />
                          View Profile
                        </Link>
                        <button className="flex items-center w-full px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                          <FaCog className="mr-3 text-gray-400" />
                          Settings
                        </button>
                      </div>
                      
                      <div className="border-t border-gray-200 dark:border-gray-700 py-2">
                        <button
                          onClick={handleSignOut}
                          className="flex items-center w-full px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <FaSignOutAlt className="mr-3" />
                          Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>            ) : (
              <Link
                to="/auth/login"
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-2 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
              >
                Sign In
              </Link>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="md:hidden p-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Toggle menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {menuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="md:hidden bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
            <div className="px-4 pt-2 pb-3 space-y-1">
              <Link
                to="/"
                className={`block px-3 py-3 rounded-lg text-base font-medium transition-colors ${
                  isActiveRoute('/') 
                    ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30' 
                    : 'text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                onClick={() => setMenuOpen(false)}
              >
                <div className="flex items-center">
                  <FaHome className="mr-3 text-sm" />
                  Home
                </div>
              </Link>
              <Link
                to="/about"
                className={`block px-3 py-3 rounded-lg text-base font-medium transition-colors ${
                  isActiveRoute('/about') 
                    ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30' 
                    : 'text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                onClick={() => setMenuOpen(false)}
              >
                <div className="flex items-center">
                  <FaInfoCircle className="mr-3 text-sm" />
                  About
                </div>
              </Link>
              {user && (
                <Link
                  to="/chat"
                  className={`block px-3 py-3 rounded-lg text-base font-medium transition-colors ${
                    isActiveRoute('/chat') 
                      ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30' 
                      : 'text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                  onClick={() => setMenuOpen(false)}
                >
                  <div className="flex items-center">
                    <FaComments className="mr-3 text-sm" />
                    Chat
                  </div>
                </Link>
              )}
              {user?.role === 'admin' && (
                <>
                  <Link
                    to="/admin/settings"
                    className={`block px-3 py-3 rounded-lg text-base font-medium transition-colors ${
                      isActiveRoute('/admin/settings') 
                        ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30' 
                        : 'text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                    onClick={() => setMenuOpen(false)}
                  >
                    <div className="flex items-center">
                      <FaCogs className="mr-3 text-sm" />
                      AI Settings
                    </div>
                  </Link>
                  <Link
                    to="/admin/users"
                    className={`block px-3 py-3 rounded-lg text-base font-medium transition-colors ${
                      isActiveRoute('/admin/users') 
                        ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30' 
                        : 'text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                    onClick={() => setMenuOpen(false)}
                  >
                    <div className="flex items-center">
                      <FaUsers className="mr-3 text-sm" />
                      Users
                    </div>
                  </Link>
                </>
              )}
              
              {/* Mobile User Section */}
              {user && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
                  <Link
                    to="/profile"
                    className="block px-3 py-3 rounded-lg text-base font-medium text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm mr-3">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-medium">{user.username}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">{user.role}</div>
                      </div>
                    </div>
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left block px-3 py-3 rounded-lg text-base font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    <div className="flex items-center">
                      <FaSignOutAlt className="mr-3 text-sm" />
                      Sign Out
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Click outside to close dropdown */}
        {profileDropdownOpen && (
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setProfileDropdownOpen(false)}
          />
        )}
      </div>
    </nav>
  );
};