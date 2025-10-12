import { useEffect, useState } from "react";
import axios from "axios";

type PermissionsData = {
  permissions: string[];
  groups: string[];
  isAdmin: boolean;
};

export function usePermissions() {
  const [permissions, setPermissions] = useState<string[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    try {
      const res = await axios.get<PermissionsData>("/api/auth/permissions");
      setPermissions(res.data.permissions);
      setGroups(res.data.groups || []);
      setIsAdmin(res.data.isAdmin);
    } catch (error) {
      console.error("権限取得エラー:", error);
      setPermissions([]);
      setGroups([]);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (permission: string): boolean => {
    if (isAdmin) return true;
    return permissions.includes(permission);
  };

  const hasAnyPermission = (permissionList: string[]): boolean => {
    if (isAdmin) return true;
    return permissionList.some((p) => permissions.includes(p));
  };

  const hasAllPermissions = (permissionList: string[]): boolean => {
    if (isAdmin) return true;
    return permissionList.every((p) => permissions.includes(p));
  };

  return {
    permissions,
    groups,
    isAdmin,
    loading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
  };
}
