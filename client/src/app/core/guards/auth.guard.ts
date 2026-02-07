import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthStore } from '@stores/auth.store';

/**
 * Checks if token looks valid (exists and not expired).
 * Simple JWT expiry check without external libraries.
 */
function isTokenValid(token: string | null): boolean {
  if (!token) return false;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;

    const payload = JSON.parse(atob(parts[1])) as { exp?: number };
    if (!payload.exp) return false;

    // Token is valid if expiry is in the future (with 30s buffer)
    return payload.exp * 1000 > Date.now() - 30_000;
  } catch {
    return false;
  }
}

/** Protects authenticated routes — redirects to /login if not authenticated */
export const authGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  // Check both the flag AND token validity
  if (authStore.isAuthenticated() && isTokenValid(authStore.accessToken())) {
    return true;
  }

  // If we have a refresh token, the interceptor will handle refresh on first API call
  if (isTokenValid(authStore.refreshToken())) {
    return true;
  }

  // No valid tokens — clear state and redirect
  authStore.logout();
  router.navigate(['/login']);
  return false;
};

/** Protects guest-only routes (login, register) — redirects to /dashboard if logged in */
export const guestGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (!authStore.isAuthenticated()) {
    return true;
  }

  router.navigate(['/dashboard']);
  return false;
};
