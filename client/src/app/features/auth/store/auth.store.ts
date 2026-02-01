import { inject } from "@angular/core";
import { Router } from "@angular/router";
import { patchState, signalStore, withMethods, withState } from "@ngrx/signals";
import { rxMethod } from "@ngrx/signals/rxjs-interop";
import {
  withDevtools,
  withCallState,
  setLoading,
  setLoaded,
  setError,
} from "@angular-architects/ngrx-toolkit";
import { pipe, switchMap, tap, catchError } from "rxjs";
import { AuthService } from "../services/auth.service";
import {
  AuthState,
  LoginDto,
  RegisterDto,
  AuthUser,
} from "../models/auth.models";
import { withHooks } from "@ngrx/signals";

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
};

export const AuthStore = signalStore(
  { providedIn: "root" },
  withState(initialState),
  withDevtools("authStore"),
  withCallState(),
  withMethods(
    (store, authService = inject(AuthService), router = inject(Router)) => ({
      login: rxMethod<LoginDto>(
        pipe(
          tap(() => patchState(store, setLoading())),
          switchMap((dto) =>
            authService.login(dto).pipe(
              tap((response) => {
                const data = response.data;
                authService.saveTokens(data.access_token, data.refresh_token);
                localStorage.setItem("user", JSON.stringify(data.user));
                patchState(
                  store,
                  {
                    user: data.user,
                    isAuthenticated: true,
                  },
                  setLoaded(),
                );
                router.navigate(["/dashboard"]);
              }),
              catchError((err) => {
                const message = err.message || "Login failed";
                patchState(store, setError(message));
                throw err;
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
              tap(() => {
                patchState(store, setLoaded());
                router.navigate(["/login"]);
              }),
              catchError((err) => {
                const message = err.message || "Registration failed";
                patchState(store, setError(message));
                throw err;
              }),
            ),
          ),
        ),
      ),
      logout: () => {
        authService.logout();
        localStorage.removeItem("user");
        patchState(store, initialState);
      },
      initAuth: () => {
        const userJson = localStorage.getItem("user");
        const token = authService.getToken();
        if (userJson && token) {
          try {
            const user = JSON.parse(userJson) as AuthUser;
            patchState(store, { user, isAuthenticated: true });
          } catch (e) {
            authService.logout();
          }
        }
      },
    }),
  ),
  withHooks({
    onInit(store) {
      store.initAuth();
    },
  }),
);
