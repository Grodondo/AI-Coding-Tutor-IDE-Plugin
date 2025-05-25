'use client';
import { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import ReCAPTCHA from 'react-google-recaptcha';
import { FcGoogle } from 'react-icons/fc';
import { AiOutlineEye, AiOutlineEyeInvisible } from 'react-icons/ai';
import { BsCheckCircle, BsXCircle } from 'react-icons/bs';

interface PasswordRequirement {
    regex: RegExp;
    message: string;
}

const passwordRequirements: PasswordRequirement[] = [
    { regex: /.{8,}/, message: 'At least 8 characters long' },
    { regex: /[0-9]/, message: 'Contains a number' },
    { regex: /[a-z]/, message: 'Contains a lowercase letter' },
    { regex: /[A-Z]/, message: 'Contains an uppercase letter' },
    { regex: /[^A-Za-z0-9]/, message: 'Contains a special character' },
];

export default function Register() {
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        username: '',
        password: '',
        confirmPassword: '',
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [step, setStep] = useState(1);
    const navigate = useNavigate();

    const validateEmail = (email: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const checkPasswordStrength = (password: string) => {
        return passwordRequirements.map(req => ({
            ...req,
            isValid: req.regex.test(password)
        }));
    };

    const handleNext = () => {
        if (step === 1) {
            if (!formData.firstName || !formData.lastName || !formData.username) {
                setError('Please fill in all fields');
                return;
            }
            if (!validateEmail(formData.email)) {
                setError('Please enter a valid email address');
                return;
            }
            if (formData.username.length < 3) {
                setError('Username must be at least 3 characters long');
                return;
            }
            setError('');
            setStep(2);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const response = await fetch('http://localhost:8080/api/v1/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Registration failed');
            }

            navigate('/auth/login?registered=true');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Registration failed');
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

    const passwordRequirementsList = checkPasswordStrength(formData.password);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg">
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">Create Account</h1>
                    <p className="text-gray-600 dark:text-gray-400">to continue to AI Coding Tutor</p>
                </div>

                {error && (
                    <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-md p-4">
                        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                    </div>
                )}

                <button 
                    className="w-full flex items-center justify-center gap-3 py-2.5 px-4 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors duration-200"
                >
                    <FcGoogle className="h-5 w-5" />
                    Sign up with Google
                </button>

                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-300 dark:border-gray-600" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                            Or continue with email
                        </span>
                    </div>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    {step === 1 ? (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                        First name
                                    </label>
                                    <input
                                        id="firstName"
                                        name="firstName"
                                        type="text"
                                        required
                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                                        value={formData.firstName}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Last name
                                    </label>
                                    <input
                                        id="lastName"
                                        name="lastName"
                                        type="text"
                                        required
                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                                        value={formData.lastName}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Email address
                                </label>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    required
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                                    value={formData.email}
                                    onChange={handleChange}
                                />
                            </div>
                            <div>
                                <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Username
                                </label>
                                <input
                                    id="username"
                                    name="username"
                                    type="text"
                                    required
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                                    value={formData.username}
                                    onChange={handleChange}
                                />
                            </div>
                            <button
                                type="button"
                                onClick={handleNext}
                                disabled={isLoading}
                                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                            >
                                Next
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="space-y-4">
                                <div className="relative">
                                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Password
                                    </label>
                                    <div className="mt-1 relative">
                                        <input
                                            id="password"
                                            name="password"
                                            type={showPassword ? "text" : "password"}
                                            required
                                            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                                            value={formData.password}
                                            onChange={handleChange}
                                        />
                                        <button
                                            type="button"
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                            onClick={() => setShowPassword(!showPassword)}
                                        >
                                            {showPassword ? (
                                                <AiOutlineEyeInvisible className="h-5 w-5 text-gray-400" />
                                            ) : (
                                                <AiOutlineEye className="h-5 w-5 text-gray-400" />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <div className="relative">
                                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Confirm Password
                                    </label>
                                    <div className="mt-1 relative">
                                        <input
                                            id="confirmPassword"
                                            name="confirmPassword"
                                            type={showConfirmPassword ? "text" : "password"}
                                            required
                                            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                                            value={formData.confirmPassword}
                                            onChange={handleChange}
                                        />
                                        <button
                                            type="button"
                                            className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        >
                                            {showConfirmPassword ? (
                                                <AiOutlineEyeInvisible className="h-5 w-5 text-gray-400" />
                                            ) : (
                                                <AiOutlineEye className="h-5 w-5 text-gray-400" />
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    {passwordRequirementsList.map((req, index) => (
                                        <div key={index} className="flex items-center space-x-2">
                                            {req.isValid ? (
                                                <BsCheckCircle className="h-4 w-4 text-green-500" />
                                            ) : (
                                                <BsXCircle className="h-4 w-4 text-red-500" />
                                            )}
                                            <span className={`text-sm ${req.isValid ? 'text-green-500' : 'text-red-500'}`}>
                                                {req.message}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex items-center justify-between space-x-4">
                                    <button
                                        type="button"
                                        onClick={() => setStep(1)}
                                        className="flex-1 py-2.5 px-4 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
                                    >
                                        Back
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        className="flex-1 py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                                    >
                                        {isLoading ? 'Creating account...' : 'Create account'}
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </form>

                <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                    Already have an account?{' '}
                    <Link to="/auth/login" className="font-medium text-blue-600 hover:text-blue-500">
                        Sign in
                    </Link>
                </p>
            </div>
        </div>
    );
}



