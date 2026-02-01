import { patchState, signalStore, withMethods, withState } from "@ngrx/signals";
import { withDevtools } from "@angular-architects/ngrx-toolkit";

export interface User {
  id: string;
  email: string;
  companyName: string;
  role: string;
}

export interface AppState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  themeMode: "light" | "dark";
}

const initialState: AppState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  themeMode: "light",
};

export const AppStore = signalStore(
  { providedIn: "root" },
  withState(initialState),
  withDevtools("appStore"),
  withMethods((store) => ({
    setLoading(isLoading: boolean) {
      patchState(store, { isLoading });
    },

    setUser(user: User) {
      patchState(store, { user, isAuthenticated: !!user });
    },

    logout() {
      patchState(store, { user: null, isAuthenticated: false });
      localStorage.removeItem("access_token");
    },

    toggleTheme() {
      const mode = store.themeMode() === "light" ? "dark" : "light";
      patchState(store, { themeMode: mode });
    },
  })),
);
