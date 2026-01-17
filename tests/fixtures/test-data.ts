/**
 * Test data fixtures for E2E tests
 */

export const testUsers = {
  valid: {
    email: `test-${Date.now()}@example.com`,
    password: 'Test123!@#',
    companyName: 'Test Company',
    phone: '123456789',
  },
  existing: {
    email: 'existing@example.com',
    password: 'Existing123!',
    companyName: 'Existing Company',
  },
};

export const testProjects = {
  small: {
    name: 'Mały Projekt Testowy',
    description: 'Opis testowego projektu',
    slabLength: 6,
    slabWidth: 4,
    slabThickness: 0.2,
    floorHeight: 2.8,
  },
  medium: {
    name: 'Średni Projekt',
    description: 'Strop 80m²',
    slabLength: 10,
    slabWidth: 8,
    slabThickness: 0.25,
    floorHeight: 3.0,
  },
  large: {
    name: 'Duży Projekt',
    description: 'Strop 200m²',
    slabLength: 20,
    slabWidth: 10,
    slabThickness: 0.3,
    floorHeight: 3.5,
  },
};

export const testInventoryItems = {
  panel: {
    name: 'Panel Test 120x60',
    type: 'panel',
    system: 'SKYDECK',
    manufacturer: 'PERI',
    dimensions: '120x60 cm',
    quantity: 50,
  },
  prop: {
    name: 'Podpora PEP Ergo',
    type: 'prop',
    system: 'MULTIPROP',
    manufacturer: 'PERI',
    dimensions: '200-350 cm',
    quantity: 100,
  },
};

export function generateUniqueEmail(): string {
  return `test-${Date.now()}-${Math.random()
    .toString(36)
    .substring(7)}@example.com`;
}
