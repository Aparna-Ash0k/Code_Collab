import React from 'react';
import { usePermissions } from '../contexts/PermissionsContext';

/**
 * PermissionGate - Component that conditionally renders children based on user permissions
 * 
 * @param {Object} props
 * @param {string|string[]} props.permission - Single permission or array of permissions
 * @param {boolean} props.requireAll - If true, user must have ALL permissions. If false, user needs ANY permission (default: false)
 * @param {React.ReactNode} props.children - Content to render if user has permission
 * @param {React.ReactNode} props.fallback - Content to render if user lacks permission (optional)
 * @param {string} props.userId - Check permissions for specific user (defaults to current user)
 */
const PermissionGate = ({ 
  permission, 
  requireAll = false, 
  children, 
  fallback = null, 
  userId = null 
}) => {
  const { hasPermission, hasPermissions, hasAnyPermission, userHasPermission } = usePermissions();

  // If checking for a specific user
  if (userId) {
    if (Array.isArray(permission)) {
      const hasAccess = requireAll 
        ? permission.every(perm => userHasPermission(userId, perm))
        : permission.some(perm => userHasPermission(userId, perm));
      return hasAccess ? children : fallback;
    } else {
      return userHasPermission(userId, permission) ? children : fallback;
    }
  }

  // Check permissions for current user
  if (Array.isArray(permission)) {
    const hasAccess = requireAll 
      ? hasPermissions(permission)
      : hasAnyPermission(permission);
    return hasAccess ? children : fallback;
  } else {
    return hasPermission(permission) ? children : fallback;
  }
};

/**
 * usePermissionCheck - Hook to check permissions in components
 * @param {string|string[]} permission
 * @param {boolean} requireAll
 * @param {string} userId
 * @returns {boolean}
 */
export const usePermissionCheck = (permission, requireAll = false, userId = null) => {
  const { hasPermission, hasPermissions, hasAnyPermission, userHasPermission } = usePermissions();

  if (userId) {
    if (Array.isArray(permission)) {
      return requireAll 
        ? permission.every(perm => userHasPermission(userId, perm))
        : permission.some(perm => userHasPermission(userId, perm));
    } else {
      return userHasPermission(userId, permission);
    }
  }

  if (Array.isArray(permission)) {
    return requireAll ? hasPermissions(permission) : hasAnyPermission(permission);
  } else {
    return hasPermission(permission);
  }
};

/**
 * DisabledWrapper - Wrapper that disables content based on permissions
 */
export const DisabledWrapper = ({ 
  permission, 
  requireAll = false, 
  children, 
  disabled = false,
  title = "You don't have permission to perform this action"
}) => {
  const hasAccess = usePermissionCheck(permission, requireAll);
  const isDisabled = disabled || !hasAccess;

  return (
    <div 
      style={{ 
        opacity: isDisabled ? 0.5 : 1,
        pointerEvents: isDisabled ? 'none' : 'auto',
        cursor: isDisabled ? 'not-allowed' : 'auto'
      }}
      title={isDisabled ? title : undefined}
    >
      {children}
    </div>
  );
};

export default PermissionGate;
