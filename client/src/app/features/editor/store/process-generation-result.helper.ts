import { MessageService } from "primeng/api";
import { type Shape } from "../models/editor.models";
import { patchState } from "@ngrx/signals";

export function processGenerationResult(
  result: any,
  store: any,
  messageService: MessageService,
  isOptimal = false,
) {
  const newShapes: Shape[] = [];

  if (result.elements) {
    result.elements.forEach((el: any) => {
      if (
        (el.elementType === "panel" || el.type === "panel") &&
        el.positionX !== undefined
      ) {
        // Position X/Y from backend are in meters, convert to cm (1 unit = 1 px/cm)
        const x = el.positionX * 100;
        const y = el.positionY * 100;
        const panelLength = el.details?.length || 120;
        const panelWidth = el.details?.width || 60;
        const rotation = el.rotation || 0;

        // Swap dimensions if panel is rotated 90 degrees
        const w = rotation === 90 ? panelWidth : panelLength;
        const h = rotation === 90 ? panelLength : panelWidth;

        newShapes.push({
          id: `gen_${Math.random().toString(36).substr(2, 9)}`,
          type: "panel",
          x: x,
          y: y,
          rotation: 0, // Dimensions already account for rotation
          width: w,
          height: h,
          properties: {
            fill: isOptimal ? "#4CAF50" : "#FFCC00", // Opaque fill
            stroke: "#1b5e20",
            label: el.name,
            isGenerated: true,
          } as any,
        } as Shape);
      }
    });

    // Update shapes in store - remove old generated panels first, then add new
    patchState(store, (s: any) => ({
      shapes: [
        ...s.shapes.filter((shape: Shape) => !shape.properties?.isGenerated),
        ...newShapes,
      ],
    }));

    messageService.add({
      severity: "success",
      summary: isOptimal
        ? "Optymalizacja Zakończona"
        : "Generowanie Zakończone",
      detail: `Wygenerowano ${newShapes.length} elementów. ${
        isOptimal ? "Uwzględniono stany magazynowe." : ""
      }`,
      life: 5000,
    });
  }
}
