import {
  ROOM_MAX_LENGTH,
  ROOM_MIN_LENGTH,
  normalizeRoomSlug as normalizeSharedRoomSlug,
} from "../../roomSlug";

export function normalizeRoomSlug(value) {
  return normalizeSharedRoomSlug(value);
}

export const DEFAULT_ROOM = "default";
export { ROOM_MAX_LENGTH, ROOM_MIN_LENGTH };

export function isValidRoomSlug(value) {
  const room = normalizeRoomSlug(value);
  return room.length >= ROOM_MIN_LENGTH && room.length <= ROOM_MAX_LENGTH;
}

export function roomScopedStorageKey(baseKey, room) {
  const normalizedRoom = normalizeRoomSlug(room);
  return normalizedRoom ? `${baseKey}_${normalizedRoom}` : baseKey;
}

export function hostKeyStorageKey(room) {
  const normalizedRoom = normalizeRoomSlug(room) || DEFAULT_ROOM;
  return `tg_host_key_${normalizedRoom}`;
}

export function pendingHostPasswordStorageKey(room) {
  const normalizedRoom = normalizeRoomSlug(room) || DEFAULT_ROOM;
  return `tg_pending_host_password_${normalizedRoom}`;
}

function normalizeHostKey(value) {
  return String(value ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 128);
}

export function getStoredHostKey(room) {
  try {
    return normalizeHostKey(localStorage.getItem(hostKeyStorageKey(room)));
  } catch {
    return "";
  }
}

export function storeHostKey(room, hostKey) {
  const normalizedHostKey = normalizeHostKey(hostKey);
  if (!normalizedHostKey) return "";

  try {
    localStorage.setItem(hostKeyStorageKey(room), normalizedHostKey);
  } catch {
    // ignore restricted storage contexts
  }

  return normalizedHostKey;
}

export function consumeHostKeyFromQuery(room) {
  try {
    const params = new URLSearchParams(window.location.search);
    const queryHostKey = normalizeHostKey(params.get("hostKey"));
    if (!queryHostKey) return "";

    storeHostKey(room, queryHostKey);
    params.delete("hostKey");

    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", nextUrl);
    return queryHostKey;
  } catch {
    return "";
  }
}

export function storePendingHostPassword(room, password) {
  try {
    sessionStorage.setItem(pendingHostPasswordStorageKey(room), String(password ?? ""));
  } catch {
    // ignore
  }
}

export function readPendingHostPassword(room) {
  try {
    return sessionStorage.getItem(pendingHostPasswordStorageKey(room)) ?? "";
  } catch {
    return "";
  }
}

export function clearPendingHostPassword(room) {
  try {
    sessionStorage.removeItem(pendingHostPasswordStorageKey(room));
  } catch {
    // ignore
  }
}

export function consumePendingHostPassword(room) {
  const storageKey = pendingHostPasswordStorageKey(room);

  try {
    const password = sessionStorage.getItem(storageKey) ?? "";
    sessionStorage.removeItem(storageKey);
    return password;
  } catch {
    return "";
  }
}

export function createHostKey() {
  try {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 18)}`;
  }
}

export function getOrCreateHostKey(room) {
  const storageKey = hostKeyStorageKey(room);

  try {
    const params = new URLSearchParams(window.location.search);
    const queryHostKey = normalizeHostKey(params.get("hostKey"));

    if (queryHostKey) {
      localStorage.setItem(storageKey, queryHostKey);
      params.delete("hostKey");

      const nextSearch = params.toString();
      const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`;
      window.history.replaceState(null, "", nextUrl);
      return queryHostKey;
    }

    const existing = normalizeHostKey(localStorage.getItem(storageKey));
    if (existing) return existing;

    const nextKey = createHostKey();
    localStorage.setItem(storageKey, nextKey);
    return nextKey;
  } catch {
    return createHostKey();
  }
}

export function roomClaimHostApiPath(room) {
  const normalizedRoom = normalizeRoomSlug(room);
  return normalizedRoom ? `/api/rooms/${normalizedRoom}/claim-host` : "/api/rooms/default/claim-host";
}

export function roomStateApiPath(room) {
  const normalizedRoom = normalizeRoomSlug(room);
  return normalizedRoom ? `/api/rooms/${normalizedRoom}/state` : "/api/tournament-state";
}

export function roomMetaApiPath(room) {
  const normalizedRoom = normalizeRoomSlug(room);
  return normalizedRoom ? `/api/rooms/${normalizedRoom}/meta` : "/api/rooms/default/meta";
}

export function roomPath(prefix, room) {
  const normalizedRoom = normalizeRoomSlug(room);
  return normalizedRoom ? `/${prefix}/${normalizedRoom}` : `/${prefix}`;
}

export function absoluteRoomUrl(prefix, room, query = "") {
  const path = roomPath(prefix, room);
  const suffix = query ? `?${query}` : "";
  return `${window.location.origin}${path}${suffix}`;
}

export async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}
