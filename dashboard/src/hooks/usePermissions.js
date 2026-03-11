import { useMemo } from 'react';
import { getAccessByRole } from '../pages/Settings';

/**
 * Hook pour les permissions granulaires du dashboard.
 * Utilise le rôle de l'utilisateur et les modules autorisés (Settings > accès par rôle).
 * @param {{ role?: string, allowedModules?: Record<string, boolean> } | null} [user] - Utilisateur courant (optionnel, sinon lu depuis localStorage adminUser)
 * @returns {{ can: (moduleId: string) => boolean, role: string }}
 */
export function usePermissions(user) {
  const resolvedUser = useMemo(() => {
    if (user != null) return user;
    try {
      const stored = localStorage.getItem('adminUser');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }, [user]);

  return useMemo(() => {
    const role = resolvedUser?.role === 'admin' || resolvedUser?.role === 'crew' || resolvedUser?.role === 'passenger'
      ? resolvedUser.role
      : 'admin';
    const accessByRole = getAccessByRole();
    const roleAccess = accessByRole[role] || accessByRole.admin;
    const access = resolvedUser?.allowedModules && typeof resolvedUser.allowedModules === 'object' && Object.keys(resolvedUser.allowedModules).length > 0
      ? resolvedUser.allowedModules
      : roleAccess;

    const can = (moduleId) => !!access[moduleId];
    return { can, role };
  }, [resolvedUser?.role, resolvedUser?.allowedModules]);
}
