'use client';
import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { 
    FaUser, 
    FaEnvelope, 
    FaKey, 
    FaEdit, 
    FaCalendarAlt,
    FaCrown,
    FaShieldAlt
} from 'react-icons/fa';

interface UserProfile {
    firstName: string;
    lastName: string;
    email: string;
    username: string;
    role: string;
    createdAt: string;
}

export default function Profile() {    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(true);

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
        };        fetchProfile();
    }, []);

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
    }    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                {/* Header Section */}
                <div className="text-center mb-8">
                    <div className="relative inline-block">
                        <div className="w-24 h-24 mx-auto bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shadow-lg">
                            <span className="text-3xl font-bold text-white">
                                {profile.firstName.charAt(0)}{profile.lastName.charAt(0)}
                            </span>
                        </div>
                        <button className="absolute -bottom-1 -right-1 bg-white dark:bg-gray-800 rounded-full p-2 shadow-lg border-2 border-white dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                            <FaEdit className="text-gray-600 dark:text-gray-400 text-sm" />
                        </button>
                    </div>
                    <h1 className="mt-4 text-3xl font-bold text-gray-900 dark:text-white">
                        {profile.firstName} {profile.lastName}
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 flex items-center justify-center mt-2">
                        {profile.role === 'admin' ? (
                            <>
                                <FaCrown className="mr-2 text-yellow-500" />
                                Administrator
                            </>
                        ) : (
                            <>
                                <FaShieldAlt className="mr-2 text-blue-500" />
                                {profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}
                            </>
                        )}
                    </p>
                </div>                {/* Main Content */}
                <div className="max-w-2xl mx-auto space-y-6">
                    {/* Profile Information Card */}
                    <div className="bg-white dark:bg-gray-800 shadow-xl rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
                        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-4">
                            <h3 className="text-xl font-bold text-white flex items-center">
                                <FaUser className="mr-3" />
                                Profile Information
                            </h3>
                            <p className="text-blue-100 text-sm mt-1">
                                Manage your account details and preferences
                            </p>
                        </div>
                        <div className="p-6">
                            <div className="space-y-6">
                                <div className="flex items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                                    <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-lg">
                                        <FaUser className="text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div className="ml-4 flex-1">
                                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                            Full Name
                                        </dt>
                                        <dd className="text-lg font-semibold text-gray-900 dark:text-white">
                                            {profile.firstName} {profile.lastName}
                                        </dd>
                                    </div>
                                    <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                                        <FaEdit />
                                    </button>
                                </div>

                                <div className="flex items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                                    <div className="bg-green-100 dark:bg-green-900 p-3 rounded-lg">
                                        <FaEnvelope className="text-green-600 dark:text-green-400" />
                                    </div>
                                    <div className="ml-4 flex-1">
                                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                            Email Address
                                        </dt>
                                        <dd className="text-lg font-semibold text-gray-900 dark:text-white">
                                            {profile.email}
                                        </dd>
                                    </div>
                                    <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                                        <FaEdit />
                                    </button>
                                </div>

                                <div className="flex items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                                    <div className="bg-purple-100 dark:bg-purple-900 p-3 rounded-lg">
                                        <FaKey className="text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <div className="ml-4 flex-1">
                                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                            Username
                                        </dt>
                                        <dd className="text-lg font-semibold text-gray-900 dark:text-white">
                                            {profile.username}
                                        </dd>
                                    </div>
                                    <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                                        <FaEdit />
                                    </button>
                                </div>

                                <div className="flex items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-xl">
                                    <div className="bg-orange-100 dark:bg-orange-900 p-3 rounded-lg">
                                        <FaCalendarAlt className="text-orange-600 dark:text-orange-400" />
                                    </div>
                                    <div className="ml-4 flex-1">
                                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                            Member Since
                                        </dt>
                                        <dd className="text-lg font-semibold text-gray-900 dark:text-white">
                                            {new Date(profile.createdAt).toLocaleDateString('en-US', {
                                                year: 'numeric',
                                                month: 'long',
                                                day: 'numeric'
                                            })}
                                        </dd>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Account Stats */}
                    <div className="bg-white dark:bg-gray-800 shadow-xl rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
                        <div className="bg-gradient-to-r from-purple-500 to-pink-600 px-6 py-4">
                            <h3 className="text-xl font-bold text-white">Account Stats</h3>
                            <p className="text-purple-100 text-sm mt-1">
                                Your activity overview
                            </p>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-3 gap-6">
                                <div className="text-center">
                                    <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                                        {Math.floor((Date.now() - new Date(profile.createdAt).getTime()) / (1000 * 60 * 60 * 24))}
                                    </div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Days Active</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">0</div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Chat Sessions</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-3xl font-bold text-green-600 dark:text-green-400">0</div>
                                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Problems Solved</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
} 