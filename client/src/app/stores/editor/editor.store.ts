/**
 * Editor Store (Facade)
 *
 * This is the main entry point for the editor state management.
 * It composes domain-specific method files for readability and maintainability:
 *
 *   editor-shape.methods.ts    — Shape CRUD (add, update, remove, slab creation)
 *   editor-layer.methods.ts    — Layer management (create, delete, rename, visibility, lock, move)
 *   editor-tab.methods.ts      — Tab management (add, remove, rename, switch, move layers)
 *   editor-formwork.methods.ts — Formwork generation (auto-layout, optimal layout)
 *   editor-project.methods.ts  — Project load/save, viewport, grid, selection, tools
 *
 * State definition: editor.state.ts
 * Helpers:          editor.helpers.ts
 */
import {
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import {
  withDevtools,
  withCallState,
  withStorageSync,
} from '@angular-architects/ngrx-toolkit';
import { computed, inject } from '@angular/core';
import { MessageService } from 'primeng/api';

import { FormworkApiService } from '@api/formwork-api.service';
import { ProjectsApiService } from '@api/projects-api.service';

import {
  EditorExtendedState,
  initialEditorState,
} from './editor.state';
import { createShapeMethods } from './editor-shape.methods';
import { createLayerMethods } from './editor-layer.methods';
import { createTabMethods } from './editor-tab.methods';
import { createFormworkMethods } from './editor-formwork.methods';
import { createProjectMethods } from './editor-project.methods';

// ============================================================================
// Store Definition
// ============================================================================

export const EditorStore = signalStore(
  { providedIn: 'root' },
  withState(initialEditorState),
  withStorageSync({
    key: 'editorState',
    select: (state: EditorExtendedState) => ({
      gridSize: state.gridSize,
      snapToGrid: state.snapToGrid,
      showGrid: state.showGrid,
      viewMode: state.viewMode,
    }),
  }),
  withDevtools('editorStore'),
  withCallState(),

  // ========================================================================
  // Computed Properties
  // ========================================================================
  withComputed((state) => ({
    activeTab: computed(() =>
      state.tabs().find((t) => t.id === state.activeTabId()),
    ),
    activeLayers: computed(() => {
      const tab = state.tabs().find((t) => t.id === state.activeTabId());
      return tab?.layers ?? [];
    }),
    activeLayer: computed(() => {
      const tab = state.tabs().find((t) => t.id === state.activeTabId());
      if (!tab) return null;
      return (
        tab.layers.find((l) => l.id === state.activeLayerId()) ??
        tab.layers.find((l) => l.type === 'user') ??
        tab.layers[0] ??
        null
      );
    }),
    cadLayer: computed(() => {
      const tab = state.tabs().find((t) => t.id === state.activeTabId());
      return tab?.layers.find((l) => l.type === 'cad') ?? null;
    }),
    allShapes: computed(() => {
      const tab = state.tabs().find((t) => t.id === state.activeTabId());
      if (!tab) return [];
      return tab.layers.flatMap((l) => l.shapes);
    }),
    selectedShapes: computed(() => {
      const tab = state.tabs().find((t) => t.id === state.activeTabId());
      if (!tab) return [];
      const allShapes = tab.layers.flatMap((l) => l.shapes);
      return allShapes.filter((s) => state.selectedIds().includes(s.id));
    }),
    visibleShapes: computed(() => {
      const tab = state.tabs().find((t) => t.id === state.activeTabId());
      if (!tab) return [];
      return tab.layers
        .filter((l) => l.isVisible)
        .flatMap((l) =>
          l.shapes.map((s) => ({
            ...s,
            layerId: l.id,
            layerLocked: l.isLocked,
            opacity: l.opacity ?? 1,
          })),
        );
    }),
    tabShapesWithMetadata: computed(() => {
      const tab = state.tabs().find((t) => t.id === state.activeTabId());
      if (!tab) return [];
      return tab.layers.flatMap((l) =>
        l.shapes.map((s) => ({
          ...s,
          layerId: l.id,
          isVisible: l.isVisible,
          isLocked: l.isLocked,
          opacity: l.opacity ?? 1,
        })),
      );
    }),
    isSlabDefined: computed(() => {
      const tab = state.tabs().find((t) => t.id === state.activeTabId());
      if (!tab) return false;
      return tab.layers
        .flatMap((l) => l.shapes)
        .some((s) => s.type === 'polygon' || s.type === 'slab');
    }),
    slabShapes: computed(() => {
      const tab = state.tabs().find((t) => t.id === state.activeTabId());
      if (!tab) return [];
      return tab.layers
        .flatMap((l) => l.shapes)
        .filter((s) => s.type === 'slab');
    }),
    panelShapes: computed(() => {
      const tab = state.tabs().find((t) => t.id === state.activeTabId());
      if (!tab) return [];
      return tab.layers
        .flatMap((l) => l.shapes)
        .filter((s) => s.type === 'panel');
    }),
  })),

  // ========================================================================
  // Methods (composed from domain files)
  // ========================================================================
  withMethods((store) => {
    const formworkApi = inject(FormworkApiService);
    const projectsApi = inject(ProjectsApiService);
    const messageService = inject(MessageService);

    return {
      ...createShapeMethods(store, messageService),
      ...createLayerMethods(store, messageService),
      ...createTabMethods(store, messageService),
      ...createFormworkMethods(store, formworkApi, messageService),
      ...createProjectMethods(store, projectsApi, messageService),
    };
  }),
);
