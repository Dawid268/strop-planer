# Architektura edytora (client)

Dokument opisuje **od warstwy HTTP po store, serwisy i komponenty** – żebyś mógł sam pracować nad edytorem.

---

## 1. Wejście do edytora (routing)

- **Ścieżka:** `projects/:id/editor`
- **Plik routingu:** [client/src/app/app.routes.ts](client/src/app/app.routes.ts) – lazy load `EditorPageComponent`
- **Komponent strony:** [client/src/app/modules/editor/editor-page/editor-page.component.ts](client/src/app/modules/editor/editor-page/editor-page.component.ts)

W `ngOnInit` strona:
- Czyta `id` z `ActivatedRoute`
- Ustawia `store.setProjectId(id)` i wywołuje **`store.loadEditorData(id)`** (ładowanie projektu + danych edytora)
- Opcjonalnie: jeśli w URL jest `?exportId=...`, ładuje kształty z `sessionStorage` i wywołuje `store.loadFromProject(shapes, null)` (bez requestu)

Szablon strony:
- **Toolbar** (górny pasek) – zapis, obrót canvasa
- **Overlay** ładowania / błędu (gdy `store.loading()` / `store.error()`)
- **Editor canvas** + **Editor sidebar** obok siebie

---

## 2. Warstwa HTTP (API)

Edytor korzysta z **dwóch** serwisów API:

### ProjectsApiService  
**Plik:** [client/src/app/core/api/projects-api.service.ts](client/src/app/core/api/projects-api.service.ts)

- **`getById(id)`** – cały projekt (używane w store do ładowania edytora: projekt zawiera `editorData`, `svgPath`, `geoJsonPath`, `extractedSlabGeometry` itd.)
- **`updateEditorData(projectId, data: EditorData)`** – zapis danych edytora (taby, warstwy, kształty)
- **`getCadData(projectId)`** – dane CAD projektu (używa `CadService`)
- Inne (create, update, delete, uploadPdf, saveCalculation, saveOptimization) – głównie poza samym widokiem edytora

Dane edytora są **w obiekcie projektu** w polu `editorData` (po `getById`), a zapis to osobny endpoint `updateEditorData`.

### FormworkApiService  
**Plik:** [client/src/app/core/api/formwork-api.service.ts](client/src/app/core/api/formwork-api.service.ts)

- **`calculate(dto: CalculateRequestDto)`** – wysyła dane stropu (punkty, wymiary) i dostaje układ szalunku (`FormworkLayout`).  
  Używane w **EditorStore** w `generateAutoLayout` i `generateOptimalLayout` (rxMethod) – po odpowiedzi kształty z wyniku są mapowane na `Shape[]` i dodawane do aktywnej warstwy.

---

## 3. Modele danych

### Projekt i dane edytora  
**Plik:** [client/src/app/shared/models/project.model.ts](client/src/app/shared/models/project.model.ts)

- **EditorLayer** – `id`, `name`, `shapes: Shape[]`, `isVisible`, `isLocked`, `opacity`, `color`, `type: 'cad' | 'user' | 'system'`
- **EditorTab** – `id`, `name`, `active`, `layers: EditorLayer[]`
- **EditorData** – `{ tabs: EditorTab[] }` – to jest zapisywane/ładowane przez API
- **Project** – m.in. `editorData?: EditorData`, `svgPath`, `geoJsonPath`, `dxfPath`, `extractedSlabGeometry` – z tego store buduje widok edytora

### Kształty i narzędzia  
**Plik:** [client/src/app/shared/models/editor.models.ts](client/src/app/shared/models/editor.models.ts)

- **Shape** – `id`, `type` (slab | beam | panel | prop | polygon | rectangle), `x`, `y`, `rotation`, `points?`, `width?`, `height?`, `properties?`, `layer?`, `catalogCode?` itd.
- **Point** – `{ x, y }`
- **EditorTool** / **ToolType** – select, pan, add-panel, add-prop, draw-beam, draw-polygon, draw-slab-manual, trace-slab-auto, trace-slab, rectangle
- **CatalogItem** – dane z katalogu (panele/podpory) do dodawania na canvas
- **ShapeProperties**, **ReferenceGeometryData** itd.

Store trzyma **źródło prawdy** kształtów w `tabs[].layers[].shapes`. Canvas (Fabric) jest zsynchronizowany z tym stanem przez `CanvasShapeSyncService`.

---

## 4. EditorStore (stan aplikacji)

**Plik:** [client/src/app/stores/editor.store.ts](client/src/app/stores/editor.store.ts)

### Stan (EditorExtendedState)

- **tabs**, **activeTabId**, **activeLayerId** – taby i aktywna warstwa
- **selectedIds** – ID zaznaczonych kształtów
- **zoom**, **panX**, **panY** – viewport
- **gridSize**, **snapToGrid**, **showGrid**
- **activeTool**, **activeCatalogItem**
- **backgroundUrl**, **referenceGeometry** – tło SVG, geometria do snappingu
- **viewMode** – full | slab
- **projectId**, **geoJsonPath**, **dxfPath**
- **activePanel** – który panel boczny jest „aktywny”: tabs | layers | properties | catalog

Część (gridSize, snapToGrid, showGrid, viewMode) jest trzymana w localStorage przez **withStorageSync**.

### Computed (sygnały pochodne)

- **activeTab**, **activeLayers**, **activeLayer**, **cadLayer**
- **allShapes**, **selectedShapes**, **visibleShapes**
- **tabShapesWithMetadata** – kształty z metadanymi warstwy (visibility, lock, opacity) – używane przez sync do canvasa
- **isSlabDefined**, **slabShapes**, **panelShapes** – wygodne filtry

### Metody synchroniczne (przykłady)

- Kształty: **addShape**, **updateShape**, **removeShape**, **removeShapes**, **removeSelectedShapes**
- Selekcja: **select**, **selectMultiple**, **clearSelection**
- Viewport: **setZoom**, **setPan**, **resetView**, **panBy**
- Siatka: **toggleSnapToGrid**, **toggleGrid**, **setGridSize**
- Narzędzia: **setActiveTool**, **setActiveCatalogItem**
- Warstwy: **setActiveLayer**, **toggleLayerVisibility**, **toggleLayerLock**, **setLayerOpacity**, **createLayerInActiveTab**, **renameLayer**, **deleteLayer**, **saveSelectionAsLayer**, **moveSelectionToLayer**, **reorderLayers**, **moveLayerToTab**, **moveLayerToNewTab**
- Taby: **addTab**, **removeTab**, **renameTab**, **setActiveTab**
- Geometria: **createSlabFromPoints**, **snapToGridPoint**, **findNearestSnapPoint**
- Projekt: **loadFromProject**, **setProjectId**, **reloadEditorData**, **clearCanvas**, **setViewMode**, **exportToNewTab**

### Metody asynchroniczne (rxMethod)

- **loadEditorData(projectId)** – wywołuje `projectsApi.getById(projectId)`, z odpowiedzi ustawia `tabs`, `activeTabId`, `activeLayerId`, `backgroundUrl`, `referenceGeometry`, `geoJsonPath`, `dxfPath` itd. Dane edytora bierze z `project.editorData`.
- **save()** – zbiera `store.tabs()` do `EditorData`, wywołuje `projectsApi.updateEditorData(projectId, editorData)`.
- **generateAutoLayout()** / **generateOptimalLayout()** – biorą kształt stropu (polygon/slab) z `allShapes`, wywołują **FormworkApiService.calculate()**, z wyniku tworzą `Shape[]` i dopisują je do aktywnej warstwy (patchState).

Store **nie** trzyma referencji do canvas – tylko dane. Canvas jest w komponencie i w serwisach.

---

## 5. Strona edytora (EditorPageComponent)

**Plik:** [client/src/app/modules/editor/editor-page/editor-page.component.ts](client/src/app/modules/editor/editor-page/editor-page.component.ts)

- **Store:** `inject(EditorStore)` – jedyne miejsce „wiedzy” o stanie edytora na poziomie strony.
- **Editor canvas:** `viewChild('editorCanvas')` – używane do `rotateCanvasLeft()` / `rotateCanvasRight()` (delegacja do canvas).
- **Eventy:** `onSave()` → `store.save()`, `onSlabSelected(shape)` → `store.addShape(shape)` + przełączenie widoku (np. z DXF), `onRotateCanvasLeft/Right` → metody na `EditorCanvasComponent`.

Nie ma tu logiki rysowania ani Fabric – tylko inicjalizacja (loadEditorData w ngOnInit) i przyciski strony.

---

## 6. Editor Canvas (komponent + serwisy)

**Plik:** [client/src/app/modules/editor/editor-canvas/editor-canvas.component.ts](client/src/app/modules/editor/editor-canvas/editor-canvas.component.ts)

To **główny kontener** pod canvas Fabric. W `providers` ma serwisy **tylko dla tego komponentu** (nie root), żeby każda instancja edytora miała własny stan serwisów (historia, viewport, event handler itd.):

- **FabricRendererService** – tworzy/utrzymuje instancję `fabric.Canvas`, rozmiar, tło
- **CanvasEventHandlerService** – podpięcie zdarzeń myszy/koła (pan, zoom, narzędzia rysowania, selekcja)
- **CanvasShapeSyncService** – synchronizacja `store.tabShapesWithMetadata()` ↔ obiekty na canvas (dodawanie/usuwanie/aktualizacja, visibility, lock)
- **CanvasDrawingService** – rysowanie: belki, wielokąty, slab, panele, podpory, podglądy (np. linia belki, etykieta wymiaru)
- **CanvasInteractionService** – pozycja context toolbara, snap guide, szukanie obiektów pod kursorem, overlap selection
- **CanvasSelectionService** – mapowanie obiektów Fabric ↔ ID kształtów w store (zaznaczanie/odznaczanie)
- **CanvasStateService** – ładowanie tła (SVG z URL), czyszczenie tła, geometria z danych (polygony)
- **CanvasHistoryService** – undo/redo (snapshoty JSON canvasa)
- **ViewportService** – zoom/pan w pamięci (wartości liczbowe), `setZoom`, `setPan`, `zoomToFit`, `onViewChange`; Fabric viewportTransform jest aktualizowany w callbacku `onViewChange`

Dodatkowo **CadService** i **EditorStore** są wstrzykiwane (root).

### Przepływ inicjalizacji (ngAfterViewInit)

1. **initCanvas():**
   - Pobiera `canvasRef` i `containerRef` (ElementRef).
   - `fabricRenderer.init(canvasEl)` – tworzy Fabric Canvas.
   - `this.canvas = fabricRenderer.getCanvas()`.
   - Ustawienia wydajności (perPixelTargetFind, skipOffscreen itd.).
   - **viewport.setViewportSize(containerEl.clientWidth, clientHeight)**.
   - **eventHandler.init(this.canvas, containerEl, callbacks)** – callbacks to gettery z store (activeTool, activeLayer, setZoom, setPan, onSelectionChanged, onShapeModified, findNearestSnapPoint, saveHistoryState, onAutoSlabTrigger itd.).
   - **syncShapesWithCanvas()** po krótkim setTimeout (żeby stan z loadEditorData zdążył się ustawić).

2. **setupResizeObserver()** – na kontenerze; przy zmianie rozmiaru: `canvas.setDimensions`, `viewport.setViewportSize`, `requestRenderAll`.

### Efekty (effect)

- **backgroundUrl** – loadSvgFromUrl lub clearBackground (CanvasStateService).
- **showGrid** – updateGridVisible (tło canvasa: kolor lub pattern).
- **activeTool** – updateToolMode (selection, cursor, clearDrawingPreviews).
- **viewMode** – pokazywanie/ukrywanie obiektów „z SVG”.
- **tabShapesWithMetadata + activeTabId** – **syncShapesWithCanvas()** (ShapeSync).
- **cadLayer + cadData** – renderCadData lub clearCadObjects (FabricRenderer); drugi effect – batchUpdateCadObjects (visibility, opacity, locked).
- **projectId** – cadService.loadCadData(projectId).

Wszystko co „rysowalne” albo zależne od stanu store jest albo w effectach, albo w handlerach zdarzeń (eventHandler wywołuje drawing/selection/store).

### Klawisze (HostListener document:keydown)

Delete/Backspace → deleteSelected; Escape → clearDrawingPreviews + discardActiveObject + select; R → rotateSelected; Ctrl+C/V/A/Z → copy/paste/selectAll/undo; Z bez Ctrl → redo; V/H/B/M/P/S → zmiana narzędzia.  
DeleteSelected, rotateSelected, copySelected, pasteSelected, selectAll – to metody w komponencie, które operują na `this.canvas` i store (przez selection service i store.selectMultiple/removeShape/addShape itd.).

---

## 7. Serwisy core – krótko po rolach

| Serwis | Rola |
|--------|------|
| **FabricRendererService** | Init Fabric Canvas na elemencie, getCanvas(), setDimensions, setBackgroundColor/Pattern, renderCadData (linie/okręgi z CadData), batchUpdateCadObjects, clearCadObjects, zoomToFit, dispose. |
| **CanvasEventHandlerService** | init(canvas, container, callbacks). Rejestruje mouse:down/move/up, mouse:wheel, selection:created/updated/cleared, object:modified. W handlerach wywołuje drawing (np. addPolygonPoint, finishPolygon), interaction (selectSmallestAtPoint, updateContextToolbarPosition), selection, viewport (zoom/pan). Odpowiada za pan, zoom, wybór narzędzia z store. |
| **CanvasShapeSyncService** | syncShapes(canvas, shapes) – dopasowuje listę Shape (z metadanymi warstwy) do obiektów na canvas: usuwa nieistniejące, dodaje brakujące, aktualizuje właściwości (visible, lock, opacity, pozycja). Tworzy obiekty Fabric (Line, Polygon, Rect, Circle, Text) z Shape. |
| **CanvasDrawingService** | addBeamPoint, updateBeamPreview, finishBeam; addPolygonPoint, updatePolygonPreview, finishPolygon; addPanelAtPoint, addPropAtPoint; clearDrawingPreviews; updateDimensionLabel (np. przy belce). Wszystko operuje na fabric.Canvas i dopisuje do store (addShape). |
| **CanvasInteractionService** | updateContextToolbarPosition(canvas, container) – pozycja pływającego toolbara przy zaznaczeniu; updateSnapGuide; findObjectsAtPoint; hit-testing dla Line/Circle/Polygon; overlap selection. |
| **CanvasSelectionService** | Mapowanie obiekt Fabric ↔ id w store. Zaznaczanie/odznaczanie na canvas i w store (selectMultiple). |
| **CanvasStateService** | loadSvgFromUrl(canvas, url), clearBackground(canvas), loadPolygonsFromGeometry – tło i geometria referencyjna. |
| **CanvasHistoryService** | saveState(canvas), undo(canvas), redo(canvas) – snapshoty JSON. |
| **ViewportService** | Sygnały zoom, panX, panY, width, height. setZoom, setPan, setViewportSize, zoomToFit, screenToWorld. Subskrypcja onViewChange(zoom, x, y) – z niej event handler aktualizuje canvas.viewportTransform i store (setZoom, setPan). |
| **CadService** | Ładuje dane CAD projektu (getCadData), trzyma w signal cadData; używane przez editor-canvas effect do renderCadData. |
| **SvgParserService** | Parsowanie SVG (np. do importu geometrii) – używane tam, gdzie trzeba przekształcić SVG na kształty/dane. |

Podkatalog **canvas/** (CanvasChunkService, CanvasRenderQueueService, CanvasVisibilityService) – optymalizacje renderowania (chunkowanie, kolejka, visibility); mogą być używane przez FabricRenderer lub ShapeSync przy bardzo dużej liczbie obiektów.

---

## 8. Toolbar (górny pasek)

**Plik:** [client/src/app/modules/editor/editor-toolbar/editor-toolbar.component.ts](client/src/app/modules/editor/editor-toolbar/editor-toolbar.component.ts)

- **EditorToolbarComponent** – host dla przycisków; emituje (save), (rotateCanvasLeft), (rotateCanvasRight).
- **ToolButtonsComponent** – SelectButton z narzędziami (select, pan, add-panel, add-prop, draw-beam, draw-polygon, draw-slab-manual, trace-slab-auto, trace-slab) → **store.setActiveTool(tool)**; przyciski „Auto-Rozmieść” → **store.generateAutoLayout()**, „Auto-Trace” → **store.autoTracePdf()**.
- **ZoomControlsComponent** – zoom in/out, reset view → **store.setZoom**, **store.resetView**.
- **GridControlsComponent** – toggle grid, toggle snap → **store.toggleGrid**, **store.toggleSnapToGrid**.
- **ViewModeBarComponent** – tryb widoku (pełny / slab) → **store.setViewMode**.

Wszystko to tylko wywołania store; toolbar nie ma dostępu do canvas.

---

## 9. Sidebar (panel boczny)

**Plik:** [client/src/app/modules/editor/editor-sidebar/editor-sidebar.component.ts](client/src/app/modules/editor/editor-sidebar/editor-sidebar.component.ts)

- **store.activePanel()** – który panel jest „otwarty” (tabs, layers, properties, catalog); **openedPanels** (computed) określa, które accordiony są rozłożone.
- **TabsPanelComponent** – lista tabów, dodawanie/usuwanie/zmiana nazwy, nowa karta → **store.addTab**, **removeTab**, **renameTab**, **setActiveTab**.
- **LayersPanelComponent** – lista warstw aktywnego taba (store.activeLayers()), nowa warstwa, menu warstwy (przenieś do strony / usuń) → **store.createLayerInActiveTab**, **deleteLayer**, **moveLayerToTab**, **moveLayerToNewTab**; **LayerItemComponent** – visibility, lock, opacity, rename, menu.
- **PropertiesPanelComponent** – właściwości zaznaczonych kształtów (store.selectedShapes()); edycja i akcje na zaznaczeniu (np. „Zapisz jako warstwę”, „Przenieś do warstwy”) → **store.saveSelectionAsLayer**, **moveSelectionToLayer**.
- **CatalogPanelComponent** – katalog paneli/podpór; wybór pozycji → **store.setActiveCatalogItem**.

Dialogi (nowa warstwa, nowa karta) – sygnały w sidebarze (showNewLayerDialog, newLayerName itd.) i wywołania store po zatwierdzeniu.

---

## 10. Context Toolbar (pływający pasek przy zaznaczeniu)

**Plik:** [client/src/app/modules/editor/editor-canvas/components/context-toolbar/context-toolbar.component.ts](client/src/app/modules/editor/editor-canvas/components/context-toolbar/context-toolbar.component.ts)

Pokazywany gdy jest zaznaczony obiekt (pozycja z **CanvasInteractionService.updateContextToolbarPosition**). Przyciski: usuń, obrót, blokada itd. – wywołują metody w komponencie rodzica (editor-canvas) lub store (np. removeSelectedShapes, updateShape). Pozycja przekazywana z interaction service (np. przez sygnał contextToolbarPosition).

---

## 11. Przepływ danych (podsumowanie)

```
Routing (projects/:id/editor)
    → EditorPageComponent.ngOnInit
        → store.setProjectId(id)
        → store.loadEditorData(id)
            → ProjectsApiService.getById(id)
            → z project: editorData, svgPath, geoJsonPath, extractedSlabGeometry
            → patchState(tabs, activeTabId, activeLayerId, backgroundUrl, referenceGeometry, ...)

EditorStore (tabs, layers, shapes, selection, tool, viewport, …)
    ↑↓
EditorCanvasComponent (effects)
    → FabricRendererService (canvas 2D)
    → CanvasShapeSyncService: tabShapesWithMetadata() → obiekty na canvas
    → CanvasEventHandlerService: zdarzenia myszy → drawing / selection / viewport
    → ViewportService ↔ viewportTransform na canvas
    → CadService.cadData() → FabricRendererService.renderCadData

Toolbar / Sidebar
    → tylko store (setActiveTool, setZoom, addTab, deleteLayer, saveSelectionAsLayer, …)
```

- **HTTP:** ProjectsApiService (getById, updateEditorData, getCadData), FormworkApiService (calculate).
- **Stan:** EditorStore – wszystko co „kto co wybrał” i „co narysowane” (taby, warstwy, kształty, zaznaczenie, narzędzie, viewport).
- **Canvas:** Fabric w FabricRendererService; ShapeSync utrzymuje zgodność z store; EventHandler łączy mysz/klawiaturę z Drawing, Selection, Viewport i store.

Jeśli będziesz zmieniać:
- **zapisywanie/ładowanie** – store (loadEditorData, save) i ProjectsApiService;
- **narzędzia i zaznaczenie** – store (activeTool, selectedIds) + CanvasEventHandlerService + CanvasSelectionService;
- **rysowanie** – CanvasDrawingService + store (addShape, createSlabFromPoints);
- **warstwy/taby** – store (tabs, activeTabId, activeLayerId, metody warstw/tabów);
- **wydajność / duża liczba obiektów** – CanvasShapeSyncService, FabricRendererService, ewentualnie canvas/ (chunk, queue, visibility).
