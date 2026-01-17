import { Component, inject, OnInit, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { TableModule } from "primeng/table";
import { CardModule } from "primeng/card";
import { ButtonModule } from "primeng/button";
import { InputTextModule } from "primeng/inputtext";
import { SelectModule } from "primeng/select";
import { TagModule } from "primeng/tag";
import { DialogService, DynamicDialogRef } from "primeng/dynamicdialog";
import { ProgressSpinnerModule } from "primeng/progressspinner";
import { IconFieldModule } from "primeng/iconfield";
import { InputIconModule } from "primeng/inputicon";
import { SkeletonModule } from "primeng/skeleton";
import { ConfirmationService, MessageService } from "primeng/api";
import { ConfirmDialogModule } from "primeng/confirmdialog";
import { ToastModule } from "primeng/toast";
import { AddItemDialogComponent } from "./components/add-item-dialog.component";
import { InventoryStore } from "./store/inventory.store";
import type {
  InventoryItem,
  CreateInventoryItemDto,
  UpdateInventoryItemDto,
} from "./models/inventory.model";

@Component({
  selector: "app-inventory-page",
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    CardModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    TagModule,
    ProgressSpinnerModule,
    IconFieldModule,
    InputIconModule,
    SkeletonModule,
    ConfirmDialogModule,
    ToastModule,
  ],
  providers: [DialogService, ConfirmationService, MessageService],
  template: `
    <div class="inventory-page p-4 max-w-screen-xl mx-auto">
      <header
        class="page-header flex flex-column md:flex-row md:justify-content-between md:align-items-start gap-4 mb-5"
      >
        <div>
          <h1 class="text-3xl font-medium text-900 m-0">Magazyn</h1>
          <p class="text-600 mt-2">
            Zarządzaj stanem magazynowym elementów szalunkowych
          </p>
        </div>
        <div class="header-actions flex gap-2">
          <p-button
            label="Eksport CSV"
            icon="pi pi-download"
            [outlined]="true"
            (click)="exportToCsv()"
          ></p-button>
          <p-button
            label="Dodaj element"
            icon="pi pi-plus"
            (click)="openAddDialog()"
          ></p-button>
        </div>
      </header>

      <!-- Filters -->
      <p-card class="filters-card shadow-1 mb-4 border-none">
        <div class="flex flex-wrap gap-3">
          <div class="flex-grow-1 md:flex-grow-0">
            <p-iconField iconPosition="right">
              <p-inputIcon styleClass="pi pi-search"></p-inputIcon>
              <input
                pInputText
                [(ngModel)]="searchQuery"
                placeholder="Szukaj po nazwie..."
                (ngModelChange)="applySearch()"
                class="w-full"
              />
            </p-iconField>
          </div>

          <p-select
            [options]="typeOptions"
            [(ngModel)]="filterType"
            optionLabel="label"
            optionValue="value"
            placeholder="Wszystkie typy"
            (onChange)="applyFilters()"
            class="w-full md:w-12rem"
          ></p-select>

          <p-select
            [options]="manufacturerOptions"
            [(ngModel)]="filterManufacturer"
            optionLabel="label"
            optionValue="value"
            placeholder="Wszyscy producenci"
            (onChange)="applyFilters()"
            class="w-full md:w-12rem"
          ></p-select>
        </div>
      </p-card>

      <!-- Table -->
      <p-card class="table-card shadow-2 border-none">
        @if (store.loading()) {
          <p-table [value]="[1, 2, 3, 4, 5, 6, 7, 8]" class="w-full">
            <ng-template pTemplate="header">
              <tr>
                <th style="width: 4rem"></th>
                <th>Nazwa</th>
                <th>Typ</th>
                <th>Producent</th>
                <th>Wymiary</th>
                <th>Dostępne</th>
                <th style="width: 8rem"></th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body">
              <tr>
                <td><p-skeleton shape="circle" size="2rem"></p-skeleton></td>
                <td><p-skeleton width="80%"></p-skeleton></td>
                <td><p-skeleton width="60%"></p-skeleton></td>
                <td><p-skeleton width="70%"></p-skeleton></td>
                <td><p-skeleton width="90%"></p-skeleton></td>
                <td><p-skeleton width="40%"></p-skeleton></td>
                <td><p-skeleton width="100%"></p-skeleton></td>
              </tr>
            </ng-template>
          </p-table>
        } @else {
          <p-table
            [value]="filteredItems()"
            [(selection)]="selectedItems"
            dataKey="id"
            [paginator]="true"
            [rows]="10"
            responsiveLayout="scroll"
            styleClass="p-datatable-sm"
          >
            <ng-template pTemplate="header">
              <tr>
                <th style="width: 4rem">
                  <p-tableHeaderCheckbox></p-tableHeaderCheckbox>
                </th>
                <th pSortableColumn="name">
                  Nazwa <p-sortIcon field="name"></p-sortIcon>
                </th>
                <th pSortableColumn="type">
                  Typ <p-sortIcon field="type"></p-sortIcon>
                </th>
                <th pSortableColumn="manufacturer">
                  Producent <p-sortIcon field="manufacturer"></p-sortIcon>
                </th>
                <th>Wymiary</th>
                <th pSortableColumn="quantityAvailable">
                  Dostępne <p-sortIcon field="quantityAvailable"></p-sortIcon>
                </th>
                <th style="width: 8rem"></th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-item>
              <tr>
                <td>
                  <p-tableCheckbox [value]="item"></p-tableCheckbox>
                </td>
                <td class="font-bold">{{ item.name }}</td>
                <td>
                  <p-tag
                    [severity]="getTypeSeverity(item.type)"
                    [value]="getTypeLabel(item.type)"
                  ></p-tag>
                </td>
                <td>{{ item.manufacturer }}</td>
                <td>{{ formatDimensions(item.dimensions) }}</td>
                <td>
                  <span
                    class="font-medium"
                    [class.text-green-600]="
                      item.quantityAvailable - item.quantityReserved > 0
                    "
                  >
                    {{ item.quantityAvailable - item.quantityReserved }}
                  </span>
                  <span class="text-600"> / {{ item.quantityAvailable }}</span>
                </td>
                <td>
                  <div class="flex gap-2">
                    <button
                      pButton
                      icon="pi pi-pencil"
                      class="p-button-text p-button-rounded p-button-sm"
                      (click)="editItem(item)"
                    ></button>
                    <button
                      pButton
                      icon="pi pi-trash"
                      class="p-button-text p-button-rounded p-button-danger p-button-sm"
                      (click)="deleteItem(item.id)"
                    ></button>
                  </div>
                </td>
              </tr>
            </ng-template>
          </p-table>
        }
      </p-card>
    </div>
    <p-confirmDialog
      header="Potwierdzenie"
      icon="pi pi-exclamation-triangle"
    ></p-confirmDialog>
    <p-toast></p-toast>
  `,
  styles: [
    `
      ::ng-deep .table-card .p-card-content {
        padding: 0 !important;
      }
    `,
  ],
})
export class InventoryPageComponent implements OnInit {
  public readonly store = inject(InventoryStore);
  private readonly dialogService = inject(DialogService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly messageService = inject(MessageService);

  public searchQuery = "";
  public filterType = "";
  public filterManufacturer = "";
  public selectedItems: InventoryItem[] = [];

  public typeOptions = [
    { label: "Wszystkie typy", value: "" },
    { label: "Panele", value: "panel" },
    { label: "Podpory", value: "prop" },
    { label: "Dźwigary", value: "beam" },
    { label: "Akcesoria", value: "accessory" },
  ];

  public manufacturerOptions = [
    { label: "Wszyscy producenci", value: "" },
    { label: "PERI", value: "PERI" },
    { label: "DOKA", value: "DOKA" },
    { label: "ULMA", value: "ULMA" },
  ];

  public ngOnInit(): void {
    this.store.loadItems();
  }

  public filteredItems(): InventoryItem[] {
    return this.store.items().filter((item) => {
      if (
        this.searchQuery &&
        !item.name.toLowerCase().includes(this.searchQuery.toLowerCase())
      )
        return false;
      if (this.filterType && item.type !== this.filterType) return false;
      if (
        this.filterManufacturer &&
        item.manufacturer !== this.filterManufacturer
      )
        return false;
      return true;
    });
  }

  public applySearch(): void {}
  public applyFilters(): void {}

  public formatDimensions(dim: any): string {
    if (!dim) return "-";
    const parts = [];
    if (dim.length) parts.push(`L:${dim.length}`);
    if (dim.width) parts.push(`W:${dim.width}`);
    if (dim.height) parts.push(`H:${dim.height}`);
    return parts.join(" x ");
  }

  public getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      panel: "Panel",
      prop: "Podpora",
      beam: "Dźwigar",
      accessory: "Akcesoria",
      drophead: "Głowica",
      tripod: "Trójnóg",
    };
    return labels[type] || type;
  }

  public getTypeSeverity(
    type: string,
  ):
    | "secondary"
    | "success"
    | "info"
    | "warn"
    | "danger"
    | "contrast"
    | undefined {
    const severities: Record<
      string,
      "secondary" | "success" | "info" | "warn" | "danger" | "contrast"
    > = {
      panel: "success",
      prop: "warn",
      beam: "info",
      accessory: "secondary",
    };
    return severities[type] || "secondary";
  }

  public openAddDialog(): void {
    const ref = this.dialogService.open(AddItemDialogComponent, {
      header: "Dodaj element",
      width: "500px",
      contentStyle: { overflow: "auto" },
    });

    ref?.onClose.subscribe((result: CreateInventoryItemDto | undefined) => {
      if (result) {
        this.store.createItem(result);
        this.messageService.add({
          severity: "success",
          summary: "Sukces",
          detail: "Dodano element",
        });
      }
    });
  }

  public editItem(item: InventoryItem): void {
    const ref = this.dialogService.open(AddItemDialogComponent, {
      header: "Edytuj element",
      width: "500px",
      contentStyle: { overflow: "auto" },
      data: item,
    });

    ref?.onClose.subscribe((result: UpdateInventoryItemDto | undefined) => {
      if (result) {
        this.store.updateItem({ id: item.id, dto: result });
        this.messageService.add({
          severity: "success",
          summary: "Sukces",
          detail: "Zaktualizowano element",
        });
      }
    });
  }

  public deleteItem(id: string): void {
    this.confirmationService.confirm({
      message: "Czy na pewno chcesz usunąć ten element z magazynu?",
      header: "Potwierdzenie usunięcia",
      icon: "pi pi-exclamation-triangle",
      acceptLabel: "Tak, usuń",
      rejectLabel: "Anuluj",
      acceptButtonStyleClass: "p-button-danger p-button-text",
      rejectButtonStyleClass: "p-button-text p-button-secondary",
      accept: () => {
        this.store.deleteItem(id);
        this.messageService.add({
          severity: "success",
          summary: "Sukces",
          detail: "Usunięto element",
        });
      },
    });
  }

  public exportToCsv() {
    const itemsToExport =
      this.selectedItems.length > 0 ? this.selectedItems : this.filteredItems();

    if (itemsToExport.length === 0) {
      this.messageService.add({
        severity: "warn",
        summary: "Błąd",
        detail: "Brak elementów do eksportu",
      });
      return;
    }

    const headers = [
      "Nazwa",
      "Typ",
      "Producent",
      "Wymiary",
      "Dostępne",
      "Zarezerwowane",
    ];
    const rows = itemsToExport.map((item) => [
      item.name,
      this.getTypeLabel(item.type),
      item.manufacturer,
      this.formatDimensions(item.dimensions),
      item.quantityAvailable,
      item.quantityReserved,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `magazyn_eksport_${new Date().toISOString().slice(0, 10)}.csv`,
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }
}
