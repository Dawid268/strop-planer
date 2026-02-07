/**
 * Editor Store - Tab management methods
 * Create, delete, rename, switch tabs; move layers between tabs.
 */
import { patchState } from '@ngrx/signals';
import { MessageService } from 'primeng/api';
import type { EditorExtendedState, EditorStoreRef } from './editor.state';
import { createEmptyTab, createDefaultLayer } from './editor.helpers';


export function createTabMethods(
  store: EditorStoreRef,
  messageService: MessageService,
) {
  return {
    /** Add a new empty tab and switch to it */
    addTab(name: string): string {
      const newTab = createEmptyTab(name);

      patchState(store, (state: EditorExtendedState) => ({
        tabs: [...state.tabs, newTab].map((t) => ({
          ...t,
          active: t.id === newTab.id,
        })),
        activeTabId: newTab.id,
        activeLayerId: newTab.layers[0]?.id ?? null,
        selectedIds: [],
      }));

      return newTab.id;
    },

    /** Remove a tab (cannot remove the last one) */
    removeTab(tabId: string): void {
      const tabs = store.tabs();
      if (tabs.length <= 1) {
        messageService.add({
          severity: 'warn',
          summary: 'Uwaga',
          detail: 'Nie można usunąć ostatniej strony',
          life: 3000,
        });
        return;
      }

      const tabIndex = tabs.findIndex((t) => t.id === tabId);
      const isActive = store.activeTabId() === tabId;

      patchState(store, (state: EditorExtendedState) => {
        const newTabs = state.tabs.filter((t) => t.id !== tabId);
        let nextActiveTabId = store.activeTabId();
        let nextActiveLayerId = store.activeLayerId();

        if (isActive && newTabs.length > 0) {
          const newActiveTab =
            newTabs[Math.min(tabIndex, newTabs.length - 1)];
          nextActiveTabId = newActiveTab.id;
          nextActiveLayerId = newActiveTab.layers[0]?.id ?? null;
        }

        return {
          tabs: newTabs.map((t) => ({
            ...t,
            active: t.id === nextActiveTabId,
          })),
          activeTabId: nextActiveTabId,
          activeLayerId: nextActiveLayerId,
          selectedIds: [],
        };
      });
    },

    /** Rename a tab */
    renameTab(tabId: string, newName: string): void {
      patchState(store, (state: EditorExtendedState) => ({
        tabs: state.tabs.map((t) =>
          t.id === tabId ? { ...t, name: newName } : t,
        ),
      }));
    },

    /** Switch to a different tab */
    setActiveTab(tabId: string): void {
      const tab = store.tabs().find((t) => t.id === tabId);
      if (!tab) return;

      patchState(store, (state: EditorExtendedState) => ({
        activeTabId: tabId,
        activeLayerId: tab.layers[0]?.id ?? null,
        tabs: state.tabs.map((t) => ({ ...t, active: t.id === tabId })),
        selectedIds: [],
      }));
    },

    /** Move a layer from the active tab to another existing tab */
    moveLayerToTab(layerId: string, targetTabId: string): void {
      const activeTabId = store.activeTabId();
      if (!activeTabId || activeTabId === targetTabId) return;

      const sourceTab = store.tabs().find((t) => t.id === activeTabId);
      if (!sourceTab) return;

      const layerToMove = sourceTab.layers.find((l) => l.id === layerId);
      if (!layerToMove) return;

      // Prevent moving CAD layer from the first tab
      if (
        layerToMove.type === 'cad' &&
        store.tabs()[0]?.id === sourceTab.id
      ) {
        messageService.add({
          severity: 'warn',
          summary: 'Nie można przenieść',
          detail:
            'Warstwy CAD nie można przenosić z pierwszej strony (rzut z CAD).',
          life: 4000,
        });
        return;
      }

      patchState(store, (state: EditorExtendedState) => {
        const newTabs = state.tabs.map((t) => {
          if (t.id === activeTabId) {
            const remaining = t.layers.filter((l) => l.id !== layerId);
            return {
              ...t,
              layers:
                remaining.length > 0
                  ? remaining
                  : [createDefaultLayer('Warstwa 1', 'user')],
            };
          }
          if (t.id === targetTabId) {
            return { ...t, layers: [...t.layers, layerToMove] };
          }
          return t;
        });

        let nextActiveLayerId = state.activeLayerId;
        if (state.activeLayerId === layerId) {
          const updatedSource = newTabs.find((t) => t.id === activeTabId);
          nextActiveLayerId = updatedSource?.layers[0]?.id ?? null;
        }

        return {
          tabs: newTabs,
          activeLayerId: nextActiveLayerId,
          selectedIds: [],
        };
      });

      messageService.add({
        severity: 'success',
        summary: 'Przeniesiono warstwę',
        detail: `Warstwa "${layerToMove.name}" została przeniesiona.`,
        life: 3000,
      });
    },

    /** Move a layer to a newly created tab */
    moveLayerToNewTab(layerId: string, tabName: string): void {
      const activeTabId = store.activeTabId();
      if (!activeTabId || !tabName.trim()) return;

      const sourceTab = store.tabs().find((t) => t.id === activeTabId);
      if (!sourceTab) return;

      const layerToMove = sourceTab.layers.find((l) => l.id === layerId);
      if (!layerToMove) return;

      if (
        layerToMove.type === 'cad' &&
        store.tabs()[0]?.id === sourceTab.id
      ) {
        messageService.add({
          severity: 'warn',
          summary: 'Nie można przenieść',
          detail:
            'Warstwy CAD nie można przenosić z pierwszej strony (rzut z CAD).',
          life: 4000,
        });
        return;
      }

      const newTab = createEmptyTab(tabName.trim());
      newTab.layers = [layerToMove];

      patchState(store, (state: EditorExtendedState) => {
        const newTabs = state.tabs
          .map((t) => {
            if (t.id !== activeTabId) return t;
            const remaining = t.layers.filter((l) => l.id !== layerId);
            return {
              ...t,
              layers:
                remaining.length > 0
                  ? remaining
                  : [createDefaultLayer('Warstwa 1', 'user')],
            };
          })
          .concat({ ...newTab, active: true });

        return {
          tabs: newTabs.map((t) => ({
            ...t,
            active: t.id === newTab.id,
          })),
          activeTabId: newTab.id,
          activeLayerId: layerToMove.id,
          selectedIds: [],
        };
      });

      messageService.add({
        severity: 'success',
        summary: 'Przeniesiono warstwę',
        detail: `Warstwa "${layerToMove.name}" została przeniesiona do nowej strony.`,
        life: 3000,
      });
    },
  };
}
