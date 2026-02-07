import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import {
  withCallState,
  withDevtools,
  withStorageSync,
  setLoading,
  setLoaded,
} from '@angular-architects/ngrx-toolkit';

export interface User {
  id: string;
  email: string;
  companyName: string;
  role: string;
}

export interface AppState {
  user: User | null;
  isAuthenticated: boolean;
  themeMode: 'light' | 'dark';
}

const initialState: AppState = {
  user: null,
  isAuthenticated: false,
  themeMode: 'light',
};

export const AppStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withCallState(),
  withStorageSync({
    key: 'appState',
    select: (state: AppState) => ({ themeMode: state.themeMode }),
  }),
  withDevtools('appStore'),
  withMethods((store) => ({
    startLoading(): void {
      patchState(store, setLoading());
    },

    finishLoading(): void {
      patchState(store, setLoaded());
    },

    setUser(user: User): void {
      patchState(store, { user, isAuthenticated: !!user });
    },

    logout(): void {
      patchState(store, { user: null, isAuthenticated: false });
    },

    toggleTheme(): void {
      const mode = store.themeMode() === 'light' ? 'dark' : 'light';
      patchState(store, { themeMode: mode });
    },
  })),
);
