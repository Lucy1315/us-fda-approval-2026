import { useState } from "react";

const ADMIN_PASSWORD = "fda2025";
const STORAGE_KEY = "adminMode";

export function useAdminMode() {
  const [isAdmin, setIsAdmin] = useState(
    () => sessionStorage.getItem(STORAGE_KEY) === "true"
  );

  const login = (password: string): boolean => {
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem(STORAGE_KEY, "true");
      setIsAdmin(true);
      return true;
    }
    return false;
  };

  const logout = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setIsAdmin(false);
  };

  return { isAdmin, login, logout };
}
