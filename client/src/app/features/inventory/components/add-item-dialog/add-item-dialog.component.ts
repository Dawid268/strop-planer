import { Component, inject, ChangeDetectionStrategy } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { DynamicDialogRef, DynamicDialogConfig } from "primeng/dynamicdialog";
import { ButtonModule } from "primeng/button";
import { InputTextModule } from "primeng/inputtext";
import { InputNumberModule } from "primeng/inputnumber";
import { SelectModule } from "primeng/select";
import { TranslocoModule } from "@jsverse/transloco";

@Component({
  selector: "app-add-item-dialog",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    SelectModule,
    TranslocoModule,
  ],
  templateUrl: "./add-item-dialog.component.html",
  styleUrls: ["./add-item-dialog.component.scss"],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddItemDialogComponent {
  public readonly ref = inject(DynamicDialogRef);
  private readonly config = inject(DynamicDialogConfig);

  public readonly isEdit = !!this.config.data;
  public item = this.config.data
    ? {
        ...this.config.data,
        dimensions: { ...this.config.data.dimensions },
        quantityAvailable: this.config.data.quantityAvailable,
      }
    : {
        name: "",
        type: "panel" as "panel" | "prop" | "beam" | "accessory",
        manufacturer: "PERI",
        system: "",
        dimensions: { length: null, width: null, height: null } as any,
        quantityAvailable: 1,
      };

  public readonly typeOptions = [
    { label: "inventory.types.panel", value: "panel" },
    { label: "inventory.types.prop", value: "prop" },
    { label: "inventory.types.beam", value: "beam" },
    { label: "inventory.types.accessory", value: "accessory" },
  ];

  public readonly manufacturerOptions = [
    { label: "PERI", value: "PERI" },
    { label: "DOKA", value: "DOKA" },
    { label: "ULMA", value: "ULMA" },
    { label: "MEVA", value: "MEVA" },
  ];

  public isValid(): boolean {
    return (
      !!this.item.name &&
      !!this.item.type &&
      !!this.item.manufacturer &&
      this.item.quantityAvailable > 0
    );
  }

  public submit(): void {
    this.ref.close(this.item);
  }
}
