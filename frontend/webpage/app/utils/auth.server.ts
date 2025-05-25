import { redirect } from 'react-router';
import { logger } from './logger'; // Adjust path

export async function requireAuth(request: Request) {
  const authHeader = request.headers.get('Authorization');
  logger.info('requireAuth: Checking Authorization header', { authHeader: authHeader ? '[present]' : '[missing]' });
  if (!authHeader) {
    logger.warn('requireAuth: No Authorization header found');
    throw redirect('/auth/login');
  }
  const token = authHeader.replace('Bearer ', '');
  logger.info('requireAuth: Token extracted');
  return token;
}

export async function requireAdmin(request: Request) {
  const token = await requireAuth(request);
  logger.info('requireAdmin: Verifying admin token');
  try {
    const response = await fetch('http://localhost:8080/api/v1/verify-token', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      logger.warn('requireAdmin: Token verification failed', { status: response.status });
      throw redirect('/auth/login');
    }
    logger.info('requireAdmin: User is admin');
    return token;
  } catch (error) {
    logger.error('requireAdmin: Error verifying token', error);
    throw redirect('/auth/login');
  }
}