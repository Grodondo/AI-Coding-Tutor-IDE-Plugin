'use client';
import { AuthContext } from '../../context/AuthContext';
import { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router';
import { FaGoogle, FaGithub } from 'react-icons/fa';

export default function Login() {
    const [formData, setFormData] = useState({
        username: '',
        password: '',
    });
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useContext(AuthContext);
    const navigate = useNavigate();

    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

    const handleSocialLogin = async (provider: 'google' | 'github') => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/auth/${provider}`, {
                method: 'GET',
                credentials: 'include',
            });
            
            const data = await response.json();
            if (data.authUrl) {
                window.location.href = data.authUrl;
            }
        } catch (err) {
            setError(`${provider} login failed`);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
    
        try {
          const response = await fetch(`${API_BASE_URL}/api/v1/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(formData),
          });
    
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Login failed');
    
          login(data.token); // Use context to store token and set user
          navigate('/'); // Use navigate instead of window.location.href
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Login failed');
        } finally {
          setIsLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 dark:text-white">
                        Welcome back
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
                        Sign in to your account
                    </p>
                </div>

                {/* Social Login Buttons */}
                <div className="grid grid-cols-2 gap-4">
                    <button
                        onClick={() => handleSocialLogin('google')}
                        className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                        <FaGoogle className="mr-2 h-5 w-5 text-red-500" />
                        Google
                    </button>
                    <button
                        onClick={() => handleSocialLogin('github')}
                        className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                        <FaGithub className="mr-2 h-5 w-5" />
                        GitHub
                    </button>
                </div>

                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-300"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">
                            Or continue with
                        </span>
                    </div>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="rounded-md shadow-sm -space-y-px">
                        <div className="mb-4">
                            <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Username
                            </label>
                            <input
                                id="username"
                                name="username"
                                type="text"
                                required
                                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                                placeholder="Enter your username"
                                value={formData.username}
                                onChange={handleChange}
                                disabled={isLoading}
                            />
                        </div>
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Password
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                                placeholder="Enter your password"
                                value={formData.password}
                                onChange={handleChange}
                                disabled={isLoading}
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <input
                                id="remember-me"
                                name="remember-me"
                                type="checkbox"
                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900 dark:text-gray-300">
                                Remember me
                            </label>
                        </div>

                        <div className="text-sm">
                            <a href="#" className="font-medium text-blue-600 hover:text-blue-500">
                                Forgot your password?
                            </a>
                        </div>
                    </div>

                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/50 text-red-500 p-3 rounded-md text-sm text-center">
                            {error}
                        </div>
                    )}

                    <div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${
                                isLoading 
                                    ? 'bg-blue-400 cursor-not-allowed' 
                                    : 'bg-blue-600 hover:bg-blue-700'
                            } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                        >
                            {isLoading ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Signing in...
                                </>
                            ) : (
                                'Sign in'
                            )}
                        </button>
                    </div>

                    <div className="text-center text-sm">
                        <span className="text-gray-600 dark:text-gray-400">Don't have an account? </span>
                        <Link 
                            to="/auth/register"
                            className="font-medium text-blue-600 hover:text-blue-500"
                        >
                            Register now
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}




