/**
 * Offline / fallback authentication helpers.
 *
 * When the Supabase project is paused or unreachable the app can still
 * function by persisting user credentials in localStorage.
 */

export type OfflineUser = {
  id: string;
  email: string;
  role: "exporter" | "provider" | "admin";
  name?: string;
  company?: string;
};

const STORAGE_KEY = "nexport_offline_users";
const SESSION_KEY = "nexport_offline_session";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function getUsers(): OfflineUser[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveUsers(users: OfflineUser[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
}

function generateId(): string {
  return "offline-" + crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// public API
// ---------------------------------------------------------------------------

/** Register a new offline user. Returns the user or an error string. */
export function offlineSignUp(
  email: string,
  password: string,
  role: OfflineUser["role"],
  name?: string,
  company?: string
): { user?: OfflineUser; error?: string } {
  const users = getUsers();

  if (users.find((u) => u.email === email.toLowerCase())) {
    return { error: "An account with this email already exists." };
  }

  const user: OfflineUser = {
    id: generateId(),
    email: email.toLowerCase(),
    role,
    name,
    company,
  };

  // Store the password hash-ish (base64) – not secure, but this is a
  // dev-only fallback while Supabase is down.
  users.push(user);
  saveUsers(users);
  localStorage.setItem(`nexport_pw_${user.email}`, btoa(password));

  return { user };
}

/** Sign in an offline user. */
export function offlineSignIn(
  email: string,
  password: string
): { user?: OfflineUser; error?: string } {
  const users = getUsers();
  const user = users.find((u) => u.email === email.toLowerCase());

  if (!user) {
    return { error: "Invalid login credentials" };
  }

  const stored = localStorage.getItem(`nexport_pw_${user.email}`);
  if (!stored || atob(stored) !== password) {
    return { error: "Invalid login credentials" };
  }

  // Persist session
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  localStorage.setItem("userRole", user.role);

  // Notify same-tab listeners (e.g. AuthContext)
  window.dispatchEvent(new Event("offline-auth-change"));

  return { user };
}

/** Get the currently logged-in offline user (if any). */
export function getOfflineSession(): OfflineUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as OfflineUser) : null;
  } catch {
    return null;
  }
}

/** Clear the offline session. */
export function offlineSignOut() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem("userRole");
  window.dispatchEvent(new Event("offline-auth-change"));
}

/**
 * Try to reach Supabase within `timeoutMs`. Resolves `true` if reachable.
 */
export async function isSupabaseReachable(
  supabaseUrl: string,
  timeoutMs = 4000
): Promise<boolean> {
  try {
    const apiKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${supabaseUrl}/auth/v1/health`, {
      headers: apiKey
        ? {
          apikey: apiKey,
          Authorization: `Bearer ${apiKey}`,
        }
        : undefined,
      signal: controller.signal,
    });
    clearTimeout(timer);
    // 200 = OK, 401 = auth required but host reachable
    return res.ok || res.status === 401;
  } catch {
    return false;
  }
}
