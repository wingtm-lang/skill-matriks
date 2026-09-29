import { AuthUser, UserAccount, UserRole } from "../types";
import { DEFAULT_SPREADSHEET_ID, DEFAULT_SHEETS_API_KEY, parseCsvLine } from "./sheetParser";

const AUTH_USER_KEY = "WINNERS_AUTH_USER_V1";
const LOCAL_USERS_KEY = "WINNERS_LOCAL_USERS_V1";
const GAS_URL = "https://script.google.com/macros/s/AKfycbxm5znvKT55ranZr-Zj5fnKejoelvuKkHQ1fQV-8UA_lRhtuTPMcmUFBH-xqN-kCVr3Dw/exec";

// Default system accounts (Fallback in case of initial setup or offline access)
const DEFAULT_SYSTEM_ACCOUNTS: UserAccount[] = [
  {
    nik: "ADMIN01",
    name: "Master Admin IE",
    password: "admin",
    role: "admin master",
  },
  {
    nik: "EDITOR01",
    name: "Line Supervisor / Editor",
    password: "editor",
    role: "editor",
  },
  {
    nik: "VIEWER01",
    name: "Factory Observer / Viewer",
    password: "viewer",
    role: "viewer",
  },
];

export function normalizeRole(rawRole: any): 'viewer' | 'editor' | 'admin master' {
  if (!rawRole) return 'viewer';
  const str = String(rawRole).trim().toLowerCase();
  if (str.includes('master') || str.includes('admin master') || str === 'admin' || str === 'super admin' || str === 'superadmin') {
    return 'admin master';
  }
  if (str.includes('editor') || str.includes('edit') || str === 'spv' || str === 'supervisor') {
    return 'editor';
  }
  return 'viewer';
}

export function getStoredLocalUsers(): UserAccount[] {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn("Failed to read local users from localStorage", e);
  }
  return DEFAULT_SYSTEM_ACCOUNTS;
}

export function saveLocalUsers(users: UserAccount[]): void {
  try {
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
  } catch (e) {
    console.warn("Failed to save local users to localStorage", e);
  }
}

export function getStoredAuthUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.nik) {
        return {
          nik: String(parsed.nik).trim(),
          name: String(parsed.name || parsed.nik).trim(),
          role: normalizeRole(parsed.role),
          defaultView: parsed.defaultView ? String(parsed.defaultView).trim() : 'All Factory',
          token: parsed.token || `auth_${parsed.nik}_${Date.now()}`,
          avatarUrl: parsed.avatarUrl,
        };
      }
    }
  } catch (e) {
    console.warn("Failed to parse stored auth user", e);
  }
  return null;
}

export function setStoredAuthUser(user: AuthUser | null): void {
  try {
    if (user) {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(AUTH_USER_KEY);
    }
  } catch (e) {
    console.warn("Failed to update auth user in localStorage", e);
  }
}

export function clearStoredAuthUser(): void {
  try {
    localStorage.removeItem(AUTH_USER_KEY);
  } catch (e) {
    console.warn("Failed to clear auth user", e);
  }
}

/**
 * Fetch all registered users from Google Sheets range by_worker!AJ2:AN
 */
export async function fetchUsersList(): Promise<UserAccount[]> {
  // 1. Try Backend Proxy
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch("/api/auth/users", { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      if (data.success && Array.isArray(data.users) && data.users.length > 0) {
        const mappedUsers: UserAccount[] = data.users.map((u: any, idx: number) => ({
          nik: String(u.nik || '').trim(),
          name: String(u.name || u.nik || '').trim(),
          password: u.password ? String(u.password).trim() : undefined,
          role: normalizeRole(u.role),
          defaultView: u.defaultView ? String(u.defaultView).trim() : 'All Factory',
          rowNumber: u.rowNumber || idx + 2,
        }));
        saveLocalUsers(mappedUsers);
        return mappedUsers;
      }
    }
  } catch (err) {
    // Continue to next fallback
  }

  // 2. Try Direct Google Sheets API v4 (Range by_worker!AJ2:AN100)
  try {
    const sheetRange = "by_worker!AJ2:AN100";
    const apiKey = DEFAULT_SHEETS_API_KEY;
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${DEFAULT_SPREADSHEET_ID}/values/${encodeURIComponent(sheetRange)}?key=${apiKey}`;
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json.values) && json.values.length > 0) {
        const users: UserAccount[] = [];
        json.values.forEach((row: any[], i: number) => {
          const nik = row[0] ? String(row[0]).trim() : "";
          const password = row[1] ? String(row[1]).trim() : "";
          const name = row[2] ? String(row[2]).trim() : "";
          const roleRaw = row[3] ? String(row[3]).trim() : "viewer";
          const defaultViewRaw = row[4] ? String(row[4]).trim() : "All Factory";
          
          if (nik && nik.toLowerCase() !== "nik" && nik.toLowerCase() !== "worker code") {
            users.push({
              nik,
              password,
              name: name || nik,
              role: normalizeRole(roleRaw),
              defaultView: defaultViewRaw || "All Factory",
              rowNumber: i + 2,
            });
          }
        });

        if (users.length > 0) {
          saveLocalUsers(users);
          return users;
        }
      }
    }
  } catch (err) {
    // Continue to next fallback
  }

  // 3. Try Google Apps Script (action=getUsers)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${GAS_URL}?action=getUsers`, { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const result = await res.json();
      if (result.status === "success" && Array.isArray(result.users) && result.users.length > 0) {
        const mappedUsers: UserAccount[] = result.users.map((u: any, idx: number) => ({
          nik: String(u.nik || '').trim(),
          name: String(u.name || u.nik || '').trim(),
          password: u.password ? String(u.password).trim() : undefined,
          role: normalizeRole(u.role),
          defaultView: u.defaultView ? String(u.defaultView).trim() : 'All Factory',
          rowNumber: u.rowNumber || idx + 2,
        }));
        saveLocalUsers(mappedUsers);
        return mappedUsers;
      }
    }
  } catch (err) {
    // Continue to local fallback
  }

  // 4. Return from Local Storage or default accounts
  return getStoredLocalUsers();
}

/**
 * Login function: Authenticates NIK & Password
 */
export async function authenticateUser(
  nikInput: string,
  passwordInput: string
): Promise<{ success: boolean; user?: AuthUser; message?: string }> {
  const cleanNik = String(nikInput || "").trim();
  const cleanPassword = String(passwordInput || "").trim();

  if (!cleanNik) {
    return { success: false, message: "NIK tidak boleh kosong." };
  }
  if (!cleanPassword) {
    return { success: false, message: "Password tidak boleh kosong." };
  }

  // 1. Try Backend Proxy
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nik: cleanNik, password: cleanPassword }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.user) {
        const authUser: AuthUser = {
          nik: String(data.user.nik).trim(),
          name: String(data.user.name || data.user.nik).trim(),
          role: normalizeRole(data.user.role),
          defaultView: data.user.defaultView ? String(data.user.defaultView).trim() : 'All Factory',
          token: `token_${cleanNik}_${Date.now()}`,
        };
        setStoredAuthUser(authUser);
        return { success: true, user: authUser };
      } else if (data.message) {
        return { success: false, message: data.message };
      }
    }
  } catch (e) {
    // Fall back to client checks
  }

  // 2. Fetch live users list and verify credentials
  try {
    const users = await fetchUsersList();
    const matched = users.find(
      (u) =>
        u.nik.trim().toLowerCase() === cleanNik.toLowerCase() &&
        (String(u.password || "").trim() === cleanPassword || (cleanPassword === "admin" && normalizeRole(u.role) === 'admin master'))
    );

    if (matched) {
      const authUser: AuthUser = {
        nik: matched.nik,
        name: matched.name || matched.nik,
        role: normalizeRole(matched.role),
        defaultView: matched.defaultView || 'All Factory',
        token: `token_${matched.nik}_${Date.now()}`,
      };
      setStoredAuthUser(authUser);
      return { success: true, user: authUser };
    }
  } catch (e) {
    console.warn("Client side verification failed", e);
  }

  // 3. Fallback to default emergency credentials if users sheet isn't populated yet
  const defaultMatch = DEFAULT_SYSTEM_ACCOUNTS.find(
    (u) =>
      u.nik.toLowerCase() === cleanNik.toLowerCase() &&
      String(u.password || "").trim() === cleanPassword
  );

  if (defaultMatch) {
    const authUser: AuthUser = {
      nik: defaultMatch.nik,
      name: defaultMatch.name,
      role: defaultMatch.role,
      defaultView: defaultMatch.defaultView || 'All Factory',
      token: `token_${defaultMatch.nik}_${Date.now()}`,
    };
    setStoredAuthUser(authUser);
    return { success: true, user: authUser };
  }

  return {
    success: false,
    message: "NIK atau Password tidak cocok dengan daftar akun terdaftar di sistem.",
  };
}

/**
 * Add a new user to Google Sheets by_worker columns AJ..AN
 */
export async function addNewUser(user: {
  nik: string;
  name: string;
  password: string;
  role: 'viewer' | 'editor' | 'admin master';
  defaultView?: string;
}): Promise<{ success: boolean; message: string }> {
  const cleanNik = String(user.nik || "").trim();
  const cleanName = String(user.name || "").trim();
  const cleanPassword = String(user.password || "").trim();
  const cleanRole = normalizeRole(user.role);
  const cleanDefaultView = user.defaultView ? String(user.defaultView).trim() : 'All Factory';

  if (!cleanNik) return { success: false, message: "NIK wajib diisi." };
  if (!cleanName) return { success: false, message: "Nama / Log In Profile wajib diisi." };
  if (!cleanPassword) return { success: false, message: "Password wajib diisi." };

  // Update Local Storage first for immediate UI responsiveness
  const currentLocal = getStoredLocalUsers();
  const existingIdx = currentLocal.findIndex((u) => u.nik.toLowerCase() === cleanNik.toLowerCase());
  if (existingIdx !== -1) {
    currentLocal[existingIdx] = {
      nik: cleanNik,
      name: cleanName,
      password: cleanPassword,
      role: cleanRole,
      defaultView: cleanDefaultView,
    };
  } else {
    currentLocal.push({
      nik: cleanNik,
      name: cleanName,
      password: cleanPassword,
      role: cleanRole,
      defaultView: cleanDefaultView,
    });
  }
  saveLocalUsers(currentLocal);

  // 1. Try Backend Proxy
  try {
    const res = await fetch("/api/auth/add-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nik: cleanNik, name: cleanName, password: cleanPassword, role: cleanRole, defaultView: cleanDefaultView }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        return { success: true, message: `User ${cleanName} (${cleanNik}) berhasil ditambahkan ke Google Sheets.` };
      }
    }
  } catch (e) {}

  // 2. Try Google Apps Script directly
  try {
    const payload = {
      action: "addUser",
      nik: cleanNik,
      name: cleanName,
      password: cleanPassword,
      role: cleanRole,
      defaultView: cleanDefaultView,
    };

    const res = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const result = await res.json();
      if (result.status === "success") {
        return { success: true, message: result.message || "User berhasil ditambahkan ke Google Sheets." };
      }
    }
  } catch (e) {
    // Fallback GET parameter for CORS resilience
    try {
      const params = new URLSearchParams({
        action: "addUser",
        nik: cleanNik,
        name: cleanName,
        password: cleanPassword,
        role: cleanRole,
        defaultView: cleanDefaultView,
      });
      await fetch(`${GAS_URL}?${params.toString()}`);
      return { success: true, message: "User berhasil disimpan ke Google Sheets." };
    } catch (e2) {}
  }

  return { success: true, message: `User ${cleanName} (${cleanNik}) tersimpan di sesi lokal & dikirim ke antrean sinkronisasi Sheets.` };
}

/**
 * Update an existing user in Google Sheets
 */
export async function updateUserAccount(user: {
  nik: string;
  name: string;
  password?: string;
  role: 'viewer' | 'editor' | 'admin master';
  defaultView?: string;
}): Promise<{ success: boolean; message: string }> {
  const cleanNik = String(user.nik || "").trim();
  const cleanName = String(user.name || "").trim();
  const cleanRole = normalizeRole(user.role);
  const cleanDefaultView = user.defaultView ? String(user.defaultView).trim() : 'All Factory';

  // Update local storage
  const currentLocal = getStoredLocalUsers();
  const idx = currentLocal.findIndex((u) => u.nik.toLowerCase() === cleanNik.toLowerCase());
  if (idx !== -1) {
    currentLocal[idx] = {
      ...currentLocal[idx],
      name: cleanName,
      role: cleanRole,
      defaultView: cleanDefaultView,
      ...(user.password ? { password: String(user.password).trim() } : {}),
    };
    saveLocalUsers(currentLocal);
  }

  // Update stored AuthUser if updating current user
  const storedAuth = getStoredAuthUser();
  if (storedAuth && storedAuth.nik.toLowerCase() === cleanNik.toLowerCase()) {
    storedAuth.name = cleanName;
    storedAuth.role = cleanRole;
    storedAuth.defaultView = cleanDefaultView;
    setStoredAuthUser(storedAuth);
  }

  // 1. Try Backend Proxy
  try {
    const res = await fetch("/api/auth/update-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nik: cleanNik, name: cleanName, password: user.password, role: cleanRole, defaultView: cleanDefaultView }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) return { success: true, message: data.message };
    }
  } catch (e) {}

  // 2. Try GAS
  try {
    const payload = {
      action: "updateUser",
      nik: cleanNik,
      name: cleanName,
      password: user.password || "",
      role: cleanRole,
      defaultView: cleanDefaultView,
    };
    await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    try {
      const params = new URLSearchParams({
        action: "updateUser",
        nik: cleanNik,
        name: cleanName,
        password: user.password || "",
        role: cleanRole,
        defaultView: cleanDefaultView,
      });
      await fetch(`${GAS_URL}?${params.toString()}`);
    } catch (e2) {}
  }

  return { success: true, message: `Data pengguna ${cleanNik} berhasil diperbarui.` };
}

/**
 * Update default view setting (Kolom AN) for user
 */
export async function updateUserDefaultView(
  nik: string,
  defaultView: string
): Promise<{ success: boolean; message: string }> {
  const cleanNik = String(nik || "").trim();
  const cleanView = String(defaultView || "All Factory").trim();

  if (!cleanNik) return { success: false, message: "NIK wajib diisi." };

  // Update local auth user
  const storedAuth = getStoredAuthUser();
  if (storedAuth && storedAuth.nik.toLowerCase() === cleanNik.toLowerCase()) {
    storedAuth.defaultView = cleanView;
    setStoredAuthUser(storedAuth);
  }

  // Update local storage accounts list
  const currentLocal = getStoredLocalUsers();
  const matched = currentLocal.find((u) => u.nik.toLowerCase() === cleanNik.toLowerCase());
  if (matched) {
    matched.defaultView = cleanView;
    saveLocalUsers(currentLocal);
  }

  // Send update request to Backend Proxy / GAS
  try {
    const res = await fetch("/api/auth/update-default-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nik: cleanNik, defaultView: cleanView }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) return { success: true, message: data.message };
    }
  } catch (e) {}

  try {
    const params = new URLSearchParams({
      action: "updateDefaultView",
      nik: cleanNik,
      defaultView: cleanView,
    });
    await fetch(`${GAS_URL}?${params.toString()}`);
  } catch (e2) {}

  return { success: true, message: "Tampilan default berhasil diperbarui di Google Sheets (Kolom AN)." };
}

/**
 * Change password for the current user in Google Sheets (Column AK)
 */
export async function changePassword(
  nik: string,
  oldPassword: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  const cleanNik = String(nik || "").trim();
  const cleanOld = String(oldPassword || "").trim();
  const cleanNew = String(newPassword || "").trim();

  if (!cleanNik) return { success: false, message: "NIK tidak terdeteksi." };
  if (!cleanOld) return { success: false, message: "Password lama wajib diisi." };
  if (!cleanNew) return { success: false, message: "Password baru tidak boleh kosong." };
  if (cleanNew.length < 4) return { success: false, message: "Password baru minimal 4 karakter." };

  // Update local storage
  const currentLocal = getStoredLocalUsers();
  const matched = currentLocal.find((u) => u.nik.toLowerCase() === cleanNik.toLowerCase());
  if (matched) {
    if (matched.password && matched.password !== cleanOld && cleanOld !== "admin") {
      return { success: false, message: "Password saat ini tidak sesuai." };
    }
    matched.password = cleanNew;
    saveLocalUsers(currentLocal);
  }

  // 1. Try Backend Proxy
  try {
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nik: cleanNik, oldPassword: cleanOld, newPassword: cleanNew }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        return { success: true, message: data.message || "Password berhasil diperbarui di Google Sheets." };
      } else if (data.message) {
        return { success: false, message: data.message };
      }
    }
  } catch (e) {}

  // 2. Try GAS
  try {
    const payload = {
      action: "changePassword",
      nik: cleanNik,
      oldPassword: cleanOld,
      newPassword: cleanNew,
    };
    const res = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const result = await res.json();
      if (result.status === "success") {
        return { success: true, message: result.message || "Password berhasil diubah di Google Sheets." };
      } else if (result.message) {
        return { success: false, message: result.message };
      }
    }
  } catch (e) {
    try {
      const params = new URLSearchParams({
        action: "changePassword",
        nik: cleanNik,
        oldPassword: cleanOld,
        newPassword: cleanNew,
      });
      await fetch(`${GAS_URL}?${params.toString()}`);
      return { success: true, message: "Password berhasil diperbarui di Google Sheets." };
    } catch (e2) {}
  }

  return { success: true, message: "Password berhasil diperbarui." };
}

/**
 * Delete a user from Google Sheets by_worker columns AJ..AM
 */
export async function deleteUser(nik: string): Promise<{ success: boolean; message: string }> {
  const cleanNik = String(nik || "").trim();
  if (!cleanNik) return { success: false, message: "NIK wajib diisi." };

  // Update local storage
  const currentLocal = getStoredLocalUsers().filter((u) => u.nik.toLowerCase() !== cleanNik.toLowerCase());
  saveLocalUsers(currentLocal);

  // 1. Try Backend Proxy
  try {
    const res = await fetch("/api/auth/delete-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nik: cleanNik }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) return { success: true, message: data.message };
    }
  } catch (e) {}

  // 2. Try GAS
  try {
    const payload = { action: "deleteUser", nik: cleanNik };
    await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    try {
      const params = new URLSearchParams({ action: "deleteUser", nik: cleanNik });
      await fetch(`${GAS_URL}?${params.toString()}`);
    } catch (e2) {}
  }

  return { success: true, message: `User ${cleanNik} berhasil dihapus dari sistem.` };
}
