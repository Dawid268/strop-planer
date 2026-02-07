import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap, EMPTY } from 'rxjs';
import { tapResponse } from '@ngrx/operators';
import {
  withDevtools,
  withCallState,
  setLoading,
  setLoaded,
  setError,
  withStorageSync,
} from '@angular-architects/ngrx-toolkit';

import { AuthService } from '@api/auth.service';
import { AuthState, LoginDto, RegisterDto } from '@models/auth.models';

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  accessToken: null,
  refreshToken: null,
};

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withStorageSync({
    key: 'authState',
    select: (state: AuthState) => ({
      user: state.user,
      isAuthenticated: state.isAuthenticated,
      accessToken: state.accessToken,
      refreshToken: state.refreshToken,
    }),
  }),
  withDevtools('authStore'),
  withCallState(),
  withMethods(
    (store, authService = inject(AuthService), router = inject(Router)) => ({
      login: rxMethod<LoginDto>(
        pipe(
          tap(() => patchState(store, setLoading())),
          switchMap((dto) =>
            authService.login(dto).pipe(
              tapResponse({
                next: (response) => {
                  patchState(
                    store,
                    {
                      user: response.user,
                      isAuthenticated: true,
                      accessToken: response.access_token,
                      refreshToken: response.refresh_token,
                    },
                    setLoaded(),
                  );
                  router.navigate(['/dashboard']);
                },
                error: (error: Error) => {
                  patchState(store, setError(error.message || 'Login failed'));
                },
              }),
            ),
          ),
        ),
      ),
      register: rxMethod<RegisterDto>(
        pipe(
          tap(() => patchState(store, setLoading())),
          switchMap((dto) =>
            authService.register(dto).pipe(
              tapResponse({
                next: () => {
                  patchState(store, setLoaded());
                  router.navigate(['/login']);
                },
                error: (error: Error) => {
                  patchState(
                    store,
                    setError(error.message || 'Registration failed'),
                  );
                },
              }),
            ),
          ),
        ),
      ),
      refreshToken: rxMethod<void>(
        pipe(
          tap(() => patchState(store, setLoading())),
          switchMap(() => {
            const refreshToken = store.refreshToken();
            if (!refreshToken) {
              patchState(store, initialState, setLoaded());
              router.navigate(['/login']);
              return EMPTY;
            }
            return authService.refreshToken(refreshToken).pipe(
              tapResponse({
                next: (response) => {
                  patchState(
                    store,
                    {
                      accessToken: response.access_token,
                      refreshToken: response.refresh_token,
                    },
                    setLoaded(),
                  );
                },
                error: () => {
                  patchState(store, initialState, setLoaded());
                  router.navigate(['/login']);
                },
              }),
            );
          }),
        ),
      ),
      logout: (): void => {
        authService.logout(store.accessToken());
        patchState(store, initialState);
      },
      /** Used by auth interceptor after successful token refresh */
      setTokens(accessToken: string, refreshToken: string): void {
        patchState(store, { accessToken, refreshToken });
      },
      clearError: (): void => {
        patchState(store, setLoaded());
      },
      /** Reset form state (clear loading/loaded/error) for fresh form entry */
      resetFormState: (): void => {
        patchState(store, { callState: 'init' });
      },
    }),
  ),
);
