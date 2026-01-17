import { Component, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { DynamicDialogRef, DynamicDialogConfig } from "primeng/dynamicdialog";
import { ButtonModule } from "primeng/button";
import { InputTextModule } from "primeng/inputtext";
import { InputNumberModule } from "primeng/inputnumber";
import { SelectModule } from "primeng/select";

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
  ],
  template: `
    <div class="flex flex-column gap-4 p-1">
      <div class="flex flex-column gap-2">
        <label for="name" class="font-medium text-900">Nazwa</label>
        <input
          id="name"
          pInputText
          [(ngModel)]="item.name"
          required
          class="w-full"
        />
      </div>

      <div class="grid">
        <div class="col-12 md:col-6 flex flex-column gap-2">
          <label for="type" class="font-medium text-900">Typ</label>
          <p-select
            id="type"
            [options]="typeOptions"
            [(ngModel)]="item.type"
            optionLabel="label"
            optionValue="value"
            required
            class="w-full"
          ></p-select>
        </div>
        <div class="col-12 md:col-6 flex flex-column gap-2">
          <label for="manufacturer" class="font-medium text-900"
            >Producent</label
          >
          <p-select
            id="manufacturer"
            [options]="manufacturerOptions"
            [(ngModel)]="item.manufacturer"
            optionLabel="label"
            optionValue="value"
            required
            class="w-full"
          ></p-select>
        </div>
      </div>

      <div class="flex flex-column gap-2">
        <label for="system" class="font-medium text-900">System</label>
        <input
          id="system"
          pInputText
          [(ngModel)]="item.system"
          placeholder="np. MULTIFLEX, DOKAFLEX"
          class="w-full"
        />
      </div>

      <div class="grid">
        <div class="col-6 md:col-3 flex flex-column gap-2">
          <label for="length" class="font-medium text-900 text-xs"
            >Dł. (cm)</label
          >
          <p-inputNumber
            id="length"
            [(ngModel)]="item.dimensions.length"
            placeholder="0"
            class="w-full"
          ></p-inputNumber>
        </div>
        <div class="col-6 md:col-3 flex flex-column gap-2">
          <label for="width" class="font-medium text-900 text-xs"
            >Szer. (cm)</label
          >
          <p-inputNumber
            id="width"
            [(ngModel)]="item.dimensions.width"
            placeholder="0"
            class="w-full"
          ></p-inputNumber>
        </div>
        <div class="col-6 md:col-3 flex flex-column gap-2">
          <label for="height" class="font-medium text-900 text-xs"
            >Wys. (cm)</label
          >
          <p-inputNumber
            id="height"
            [(ngModel)]="item.dimensions.height"
            placeholder="0"
            class="w-full"
          ></p-inputNumber>
        </div>
        <div class="col-6 md:col-3 flex flex-column gap-2">
          <label
            for="quantity"
            class="font-medium text-900 text-xs text-primary"
            >Ilość</label
          >
          <p-inputNumber
            id="quantity"
            [(ngModel)]="item.quantityAvailable"
            [min]="0"
            required
            class="w-full"
          ></p-inputNumber>
        </div>
      </div>

      <div class="flex justify-content-end gap-2 mt-4">
        <button
          pButton
          label="Anuluj"
          class="p-button-text p-button-secondary font-bold"
          (click)="ref.close()"
        ></button>
        <button
          pButton
          [label]="isEdit ? 'Zapisz' : 'Dodaj'"
          class="font-bold px-4"
          [disabled]="!isValid()"
          (click)="submit()"
        ></button>
      </div>
    </div>
  `,
  styles: [
    `
      :host ::ng-deep .p-inputnumber input {
        width: 100%;
      }
    `,
  ],
})
export class AddItemDialogComponent {
  public ref = inject(DynamicDialogRef);
  public config = inject(DynamicDialogConfig);

  public readonly isEdit: boolean;
  public item = {
    name: "",
    type: "panel" as "panel" | "prop" | "beam" | "accessory",
    manufacturer: "PERI",
    system: "",
    dimensions: { length: null, width: null, height: null } as any,
    quantityAvailable: 1,
  };

  public typeOptions = [
    { label: "Panel", value: "panel" },
    { label: "Podpora", value: "prop" },
    { label: "Dźwigar", value: "beam" },
    { label: "Akcesoria", value: "accessory" },
  ];

  public manufacturerOptions = [
    { label: "PERI", value: "PERI" },
    { label: "DOKA", value: "DOKA" },
    { label: "ULMA", value: "ULMA" },
    { label: "MEVA", value: "MEVA" },
  ];

  constructor() {
    this.isEdit = !!this.config.data;
    if (this.config.data) {
      this.item = {
        ...this.config.data,
        dimensions: { ...this.config.data.dimensions },
        quantityAvailable: this.config.data.quantityAvailable,
      };
    }
  }

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
