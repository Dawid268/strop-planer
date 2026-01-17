import { DataSource } from 'typeorm';
import { UserEntity } from '../inventory/entities/user.entity';
import { FormworkProjectEntity } from '../inventory/entities/formwork-project.entity';
import { InventoryItemEntity } from '../inventory/entities/inventory-item.entity';
import * as bcrypt from 'bcrypt';

/**
 * Seed script - tworzy mockowane dane demo
 * Uruchom: npm run seed
 */

export async function seedDatabase(dataSource: DataSource): Promise<void> {
  const userRepo = dataSource.getRepository(UserEntity);
  const projectRepo = dataSource.getRepository(FormworkProjectEntity);
  const inventoryRepo = dataSource.getRepository(InventoryItemEntity);

  console.log('🌱 Rozpoczynam seeding bazy danych...');

  // ========================================
  // 1. MOCKOWANY WŁAŚCICIEL (Użytkownik demo)
  // ========================================

  const existingOwner = await userRepo.findOne({
    where: { email: 'demo@szalunki.pl' },
  });
  let owner: UserEntity;

  if (!existingOwner) {
    owner = userRepo.create({
      email: 'demo@szalunki.pl',
      passwordHash: await bcrypt.hash('Demo123!@#', 10),
      companyName: 'Szalunki Demo Sp. z o.o.',
      phone: '+48 123 456 789',
      address: 'ul. Budowlana 15, 00-001 Warszawa',
      taxId: 'PL1234567890',
      role: 'admin',
      isActive: true,
    });
    await userRepo.save(owner);
    console.log('✅ Utworzono użytkownika demo: demo@szalunki.pl / Demo123!@#');
  } else {
    owner = existingOwner;
    console.log('ℹ️ Użytkownik demo już istnieje');
  }

  // ========================================
  // 2. PROJEKT HIACYNT 8 (z PDF)
  // ========================================

  const existingProject = await projectRepo.findOne({
    where: { name: '139-AiD Pawlak HIACYNT 8', userId: owner.id },
  });

  if (!existingProject) {
    const hiacyntProject = projectRepo.create({
      name: '139-AiD Pawlak HIACYNT 8',
      description:
        'Projekt konstrukcyjny domu jednorodzinnego. Autor: Konrad Ścisłowicz. Pow. użytkowa: 211.07 m², Pow. zabudowy: 212 m², Kubatura: 1440 m³',
      status: 'calculated',
      slabLength: 14.5,
      slabWidth: 14.6,
      slabThickness: 0.25,
      floorHeight: 2.8,
      slabType: 'monolityczny',
      formworkSystem: 'PERI_SKYDECK',
      userId: owner.id,
      calculationResult: JSON.stringify({
        panelsRequired: 42,
        propsRequired: 84,
        beamsRequired: 28,
        coverage: 98.5,
        totalArea: 211.07,
      }),
    });
    await projectRepo.save(hiacyntProject);
    console.log('✅ Utworzono projekt: HIACYNT 8');

    // Dodatkowe projekty demo
    const demoProjects = [
      {
        name: 'Strop parter - Budowa A',
        description: 'Strop monolityczny nad garażem',
        status: 'draft' as const,
        slabLength: 8,
        slabWidth: 6,
        slabThickness: 0.2,
        floorHeight: 2.6,
        slabType: 'monolityczny' as const,
        formworkSystem: 'DOKA_DOKAFLEX',
        userId: owner.id,
      },
      {
        name: 'Hala przemysłowa - sekcja B',
        description: 'Strop żelbetowy nad halą produkcyjną',
        status: 'optimized' as const,
        slabLength: 20,
        slabWidth: 15,
        slabThickness: 0.3,
        floorHeight: 4.5,
        slabType: 'filigranowy' as const,
        formworkSystem: 'PERI_SKYDECK',
        userId: owner.id,
      },
      {
        name: 'Biurowiec C - piętro 3',
        description: 'Typowe piętro biurowe',
        status: 'completed' as const,
        slabLength: 25,
        slabWidth: 12,
        slabThickness: 0.25,
        floorHeight: 3.2,
        slabType: 'monolityczny' as const,
        formworkSystem: 'ULMA_ENKOFLEX',
        userId: owner.id,
      },
    ];

    for (const p of demoProjects) {
      await projectRepo.save(projectRepo.create(p));
    }
    console.log('✅ Utworzono 3 dodatkowe projekty demo');
  }

  // ========================================
  // 3. MAGAZYN SZALUNKÓW (Elementy PERI)
  // ========================================

  const existingInventory = await inventoryRepo.count();

  if (existingInventory === 0) {
    const inventoryItems = [
      // Panele SKYDECK
      {
        name: 'Panel SD 120x75',
        type: 'panel',
        system: 'SKYDECK',
        manufacturer: 'PERI',
        catalogCode: 'SD-120-75',
        dimensions: '120x75 cm',
        weight: 12.5,
        quantity: 150,
        reserved: 42,
      },
      {
        name: 'Panel SD 90x75',
        type: 'panel',
        system: 'SKYDECK',
        manufacturer: 'PERI',
        catalogCode: 'SD-90-75',
        dimensions: '90x75 cm',
        weight: 9.8,
        quantity: 100,
        reserved: 28,
      },
      {
        name: 'Panel SD 120x60',
        type: 'panel',
        system: 'SKYDECK',
        manufacturer: 'PERI',
        catalogCode: 'SD-120-60',
        dimensions: '120x60 cm',
        weight: 10.2,
        quantity: 80,
        reserved: 15,
      },
      {
        name: 'Panel SD 60x75',
        type: 'panel',
        system: 'SKYDECK',
        manufacturer: 'PERI',
        catalogCode: 'SD-60-75',
        dimensions: '60x75 cm',
        weight: 6.5,
        quantity: 60,
        reserved: 8,
      },
      {
        name: 'Panel SD 30x75',
        type: 'panel',
        system: 'SKYDECK',
        manufacturer: 'PERI',
        catalogCode: 'SD-30-75',
        dimensions: '30x75 cm',
        weight: 3.8,
        quantity: 40,
        reserved: 5,
      },

      // Podpory PEP Ergo
      {
        name: 'Podpora PEP Ergo 200',
        type: 'prop',
        system: 'MULTIPROP',
        manufacturer: 'PERI',
        catalogCode: 'PEP-200',
        dimensions: '140-200 cm',
        weight: 8.2,
        quantity: 200,
        reserved: 84,
      },
      {
        name: 'Podpora PEP Ergo 250',
        type: 'prop',
        system: 'MULTIPROP',
        manufacturer: 'PERI',
        catalogCode: 'PEP-250',
        dimensions: '180-250 cm',
        weight: 9.5,
        quantity: 180,
        reserved: 60,
      },
      {
        name: 'Podpora PEP Ergo 300',
        type: 'prop',
        system: 'MULTIPROP',
        manufacturer: 'PERI',
        catalogCode: 'PEP-300',
        dimensions: '220-300 cm',
        weight: 11.0,
        quantity: 150,
        reserved: 45,
      },
      {
        name: 'Podpora PEP Ergo 350',
        type: 'prop',
        system: 'MULTIPROP',
        manufacturer: 'PERI',
        catalogCode: 'PEP-350',
        dimensions: '260-350 cm',
        weight: 12.8,
        quantity: 100,
        reserved: 30,
      },

      // Dźwigary GT24
      {
        name: 'Dźwigar GT24 180',
        type: 'beam',
        system: 'GT24',
        manufacturer: 'PERI',
        catalogCode: 'GT24-180',
        dimensions: '180 cm',
        weight: 5.4,
        quantity: 120,
        reserved: 28,
      },
      {
        name: 'Dźwigar GT24 240',
        type: 'beam',
        system: 'GT24',
        manufacturer: 'PERI',
        catalogCode: 'GT24-240',
        dimensions: '240 cm',
        weight: 7.2,
        quantity: 100,
        reserved: 22,
      },
      {
        name: 'Dźwigar GT24 330',
        type: 'beam',
        system: 'GT24',
        manufacturer: 'PERI',
        catalogCode: 'GT24-330',
        dimensions: '330 cm',
        weight: 9.9,
        quantity: 80,
        reserved: 18,
      },
      {
        name: 'Dźwigar GT24 420',
        type: 'beam',
        system: 'GT24',
        manufacturer: 'PERI',
        catalogCode: 'GT24-420',
        dimensions: '420 cm',
        weight: 12.6,
        quantity: 60,
        reserved: 12,
      },

      // Akcesoria
      {
        name: 'Głowica opadająca DH',
        type: 'accessory',
        system: 'SKYDECK',
        manufacturer: 'PERI',
        catalogCode: 'DH-01',
        dimensions: '-',
        weight: 2.1,
        quantity: 200,
        reserved: 50,
      },
      {
        name: 'Łącznik paneli SD',
        type: 'accessory',
        system: 'SKYDECK',
        manufacturer: 'PERI',
        catalogCode: 'SD-CONN',
        dimensions: '-',
        weight: 0.5,
        quantity: 500,
        reserved: 100,
      },
      {
        name: 'Trójnóg stalowy',
        type: 'accessory',
        system: 'MULTIPROP',
        manufacturer: 'PERI',
        catalogCode: 'TRIPOD',
        dimensions: '-',
        weight: 4.5,
        quantity: 100,
        reserved: 25,
      },
      {
        name: 'Widelec głowicy U',
        type: 'accessory',
        system: 'MULTIPROP',
        manufacturer: 'PERI',
        catalogCode: 'U-HEAD',
        dimensions: '-',
        weight: 3.2,
        quantity: 200,
        reserved: 45,
      },

      // Elementy DOKA
      {
        name: 'Panel Dokaflex 200x50',
        type: 'panel',
        system: 'DOKAFLEX',
        manufacturer: 'DOKA',
        catalogCode: 'DKF-200-50',
        dimensions: '200x50 cm',
        weight: 14.0,
        quantity: 60,
        reserved: 0,
      },
      {
        name: 'Dźwigar H20 N 245',
        type: 'beam',
        system: 'DOKAFLEX',
        manufacturer: 'DOKA',
        catalogCode: 'H20-245',
        dimensions: '245 cm',
        weight: 7.8,
        quantity: 50,
        reserved: 0,
      },
      {
        name: 'Stojak Eurex 20 300',
        type: 'prop',
        system: 'EUREX',
        manufacturer: 'DOKA',
        catalogCode: 'E20-300',
        dimensions: '200-300 cm',
        weight: 10.5,
        quantity: 80,
        reserved: 0,
      },
    ];

    for (const item of inventoryItems) {
      const createdItem = inventoryRepo.create({
        catalogCode: item.catalogCode,
        name: item.name,
        type: item.type as any,
        system: item.system,
        manufacturer: item.manufacturer,
        // Extract dimensions string to optional numbers if needed, or ignore for now as entity has separate fields
        // For now assuming dimensions string is not used or mapped elsewhere
        quantityAvailable: item.quantity - item.reserved,
        quantityReserved: item.reserved,
        weight: item.weight,
        dailyRentPrice: 10.0, // Default price
        ownerId: owner.id,
      });
      await inventoryRepo.save(createdItem);
    }
    console.log(`✅ Utworzono ${inventoryItems.length} elementów magazynowych`);
  } else {
    console.log(`ℹ️ Magazyn już zawiera ${existingInventory} elementów`);
  }

  console.log('');
  console.log('🎉 Seeding zakończony!');
  console.log('');
  console.log('Dane logowania demo:');
  console.log('  Email:    demo@szalunki.pl');
  console.log('  Hasło:    Demo123!@#');
}
