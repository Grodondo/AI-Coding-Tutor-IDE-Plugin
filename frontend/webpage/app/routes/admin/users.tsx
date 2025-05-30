'use client';
import { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { logger } from '../../utils/logger';
import { AuthContext } from '~/context/AuthContext';

interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  role: string;
  createdAt: string;
  lastLogin?: string;
}

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('all');
  const navigate = useNavigate();
  const { user: currentUser } = useContext(AuthContext);  useEffect(() => {
    logger.info('UserManagement: Checking user role', { user: currentUser });
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'superadmin')) {
      logger.warn('UserManagement: Unauthorized access, redirecting');
      navigate('/auth/login');
    }
  }, [currentUser, navigate]);

  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);
    const token = localStorage.getItem('authToken');
    logger.info('UserManagement: Fetching users', { token: token ? '[present]' : '[missing]' });
    
    if (!token) {
      logger.warn('UserManagement: No token, redirecting to login');
      navigate('/auth/login');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('http://localhost:8080/api/v1/admin/users', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        logger.info('UserManagement: Users fetched', { count: data.length });
        setUsers(data);
      } else {
        logger.warn('UserManagement: Failed to fetch users', {
          status: response.status,
          statusText: response.statusText,
        });
        setError('Failed to load users. Please try again.');
        if (response.status === 401) {
          navigate('/auth/login');
        }
      }
    } catch (error) {
      logger.error('UserManagement: Error fetching users', error);
      setError('An error occurred while loading users.');
    } finally {
      setIsLoading(false);
    }
  };  useEffect(() => {
    if (currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin')) {
      logger.info('UserManagement: Initializing fetchUsers');
      fetchUsers();
    }
  }, [currentUser]);
  const handleRoleChange = async (userId: number, newRole: string, targetUserRole: string) => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      logger.warn('UserManagement: No token for role change, redirecting');
      navigate('/auth/login');
      return;
    }    // Client-side role validation
    if (currentUser?.role === 'admin') {
      if (targetUserRole === 'admin' && newRole !== 'admin') {
        setError('Admin users cannot demote other admin users.');
        return;
      }
      if (targetUserRole === 'superadmin') {
        setError('Admin users cannot modify superadmin users.');
        return;
      }
      if (newRole === 'superadmin') {
        setError('Admin users cannot promote users to superadmin.');
        return;
      }
    }

    try {
      const response = await fetch(`http://localhost:8080/api/v1/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (response.ok) {
        logger.info('UserManagement: User role updated', { userId, newRole });
        await fetchUsers(); // Refresh the list
      } else {
        logger.warn('UserManagement: Failed to update user role', {
          status: response.status,
          statusText: response.statusText,
        });
        setError('Failed to update user role. Please try again.');
      }
    } catch (error) {
      logger.error('UserManagement: Error updating user role', error);
      setError('An error occurred while updating the user role.');
    }
  };  const handleDeleteUser = async (userId: number) => {
    // Check if current user is superadmin
    if (currentUser?.role !== 'superadmin') {
      setError('Only superadmin users can delete users.');
      return;
    }

    // Find the target user to check if it's the current user
    const targetUser = users.find(u => u.id === userId);
    if (targetUser && currentUser?.username === targetUser.username) {
      setError('You cannot delete your own account.');
      return;
    }

    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    const token = localStorage.getItem('authToken');
    if (!token) {
      logger.warn('UserManagement: No token for delete, redirecting');
      navigate('/auth/login');
      return;
    }

    try {
      const response = await fetch(`http://localhost:8080/api/v1/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        logger.info('UserManagement: User deleted', { userId });
        await fetchUsers(); // Refresh the list
      } else {
        logger.warn('UserManagement: Failed to delete user', {
          status: response.status,
          statusText: response.statusText,
        });
        setError('Failed to delete user. Please try again.');
      }
    } catch (error) {
      logger.error('UserManagement: Error deleting user', error);
      setError('An error occurred while deleting the user.');
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.username.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = selectedRole === 'all' || user.role === selectedRole;
    
    return matchesSearch && matchesRole;
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };  // Helper function to determine if role dropdown should be disabled
  const isRoleChangeDisabled = (targetUser: User) => {
    // Users cannot change their own role (compare by username since currentUser doesn't have id)
    if (currentUser?.username === targetUser.username) {
      return true;
    }
    
    if (currentUser?.role === 'superadmin') {
      return false; // Superadmin can change any role (except their own)
    }
    
    if (currentUser?.role === 'admin') {
      // Admin cannot modify superadmin users
      return targetUser.role === 'superadmin';
    }
    
    return true; // Regular users should not have access to this page anyway
  };

  // Helper function to get tooltip message for disabled role changes
  const getRoleChangeTooltip = (targetUser: User) => {
    if (currentUser?.username === targetUser.username) {
      return 'You cannot change your own role';
    }
    
    if (currentUser?.role === 'admin' && targetUser.role === 'superadmin') {
      return 'Admin users cannot modify superadmin users';
    }
    
    return 'You do not have permission to modify this user\'s role';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">User Management</h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Manage user accounts, roles, and permissions across your AI tutoring platform
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl shadow-sm">
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          </div>
        )}

        {/* Search and Filter Controls */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Search Users
              </label>
              <input
                type="text"
                placeholder="Search by name, email, or username..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div className="md:w-48">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Filter by Role
              </label>              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="all">All Roles</option>
                <option value="admin">Admin</option>
                <option value="user">User</option>
              </select>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-300 text-lg">Loading users...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 max-w-md mx-auto">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Users Found</h3>
              <p className="text-gray-600 dark:text-gray-300">
                {searchTerm || selectedRole !== 'all' ? 'No users match your current filters.' : 'No users have been registered yet.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Last Login
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">                  {filteredUsers.map((user) => (
                    <tr 
                      key={user.id} 
                      className={`transition-colors ${
                        currentUser?.username === user.username
                          ? 'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                              {user.firstName[0]}{user.lastName[0]}
                            </div>
                          </div>                          <div className="ml-4">
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {user.firstName} {user.lastName}
                              </div>
                              {currentUser?.username === user.username && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-300">
                              {user.email}
                            </div>
                            <div className="text-xs text-gray-400 dark:text-gray-400">
                              @{user.username}
                            </div>
                          </div>
                        </div>
                      </td>                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <select
                            value={user.role}
                            onChange={(e) => handleRoleChange(user.id, e.target.value, user.role)}
                            className={`text-sm px-3 py-1 rounded-full border-0 focus:ring-2 focus:ring-blue-500 transition-all ${
                              isRoleChangeDisabled(user)
                                ? 'opacity-50 cursor-not-allowed'
                                : 'cursor-pointer hover:shadow-sm'
                            } ${
                              user.role === 'superadmin'
                                ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                : user.role === 'admin' 
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' 
                                : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            }`}                            disabled={isRoleChangeDisabled(user)}
                            title={isRoleChangeDisabled(user) ? getRoleChangeTooltip(user) : 'Change user role'}
                          >
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                          </select>                          {isRoleChangeDisabled(user) && (
                            <div title={getRoleChangeTooltip(user)}>
                              <svg 
                                className="w-4 h-4 text-gray-400 dark:text-gray-500" 
                                fill="currentColor" 
                                viewBox="0 0 20 20"
                              >
                                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}
                        </div>
                      </td><td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        {user.lastLogin ? formatDate(user.lastLogin) : 'Never'}                      </td>                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {currentUser?.role === 'superadmin' && currentUser?.username !== user.username ? (
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                            title="Delete User"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        ) : (
                          <span 
                            className="text-gray-400 dark:text-gray-500" 
                            title={
                              currentUser?.username === user.username 
                                ? "You cannot delete your own account"
                                : "Only superadmin can delete users"
                            }
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}        {/* Summary Stats */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-xl">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Total Users</h3>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{users.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
            <div className="flex items-center">
              <div className="p-3 bg-red-100 dark:bg-red-900 rounded-xl">
                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.031 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Superadmin</h3>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {users.filter(u => u.role === 'superadmin').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-xl">
                <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.031 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Admins</h3>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {users.filter(u => u.role === 'admin').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 dark:bg-green-900 rounded-xl">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Regular Users</h3>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {users.filter(u => u.role === 'user').length}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
