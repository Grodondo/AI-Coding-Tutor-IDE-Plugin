'use client';
import { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router';
import { AuthContext } from '../../context/AuthContext';
import { FaUser, FaEnvelope, FaKey, FaSignOutAlt } from 'react-icons/fa';

interface UserProfile {
    firstName: string;
    lastName: string;
    email: string;
    username: string;
    role: string;
    createdAt: string;
}

export default function Profile() {
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const { logout } = useContext(AuthContext);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const response = await fetch('http://localhost:8080/api/v1/profile', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                    },
                });

                if (!response.ok) {
                    throw new Error('Failed to fetch profile');
                }

                const data = await response.json();
                setProfile(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load profile');
            } finally {
                setIsLoading(false);
            }
        };

        fetchProfile();
    }, []);

    const handleLogout = () => {
        logout();
        navigate('/auth/login');
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
                <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 rounded-md p-4">
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
            </div>
        );
    }

    if (!profile) {
        return null;
    }

    return (
        <div className="min-h-screen bg-white dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto">
                <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
                    <div className="px-4 py-5 sm:px-6">
                        <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                            Profile Information
                        </h3>
                        <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
                            Your personal account details
                        </p>
                    </div>
                    <div className="border-t border-gray-200 dark:border-gray-700">
                        <dl>
                            <div className="bg-gray-50 dark:bg-gray-700 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center">
                                    <FaUser className="mr-2" />
                                    Name
                                </dt>
                                <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
                                    {profile.firstName} {profile.lastName}
                                </dd>
                            </div>
                            <div className="bg-white dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center">
                                    <FaEnvelope className="mr-2" />
                                    Email
                                </dt>
                                <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
                                    {profile.email}
                                </dd>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-700 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center">
                                    <FaUser className="mr-2" />
                                    Username
                                </dt>
                                <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
                                    {profile.username}
                                </dd>
                            </div>
                            <div className="bg-white dark:bg-gray-800 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center">
                                    <FaKey className="mr-2" />
                                    Role
                                </dt>
                                <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
                                    {profile.role}
                                </dd>
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-700 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                    Member Since
                                </dt>
                                <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">
                                    {new Date(profile.createdAt).toLocaleDateString()}
                                </dd>
                            </div>
                        </dl>
                    </div>
                    <div className="px-4 py-5 sm:px-6">
                        <button
                            onClick={handleLogout}
                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        >
                            <FaSignOutAlt className="mr-2" />
                            Logout
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
} 