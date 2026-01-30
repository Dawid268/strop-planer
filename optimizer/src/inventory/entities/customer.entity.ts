import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Relation,
} from 'typeorm';

@Entity('rental_items')
export class RentalItemEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @ManyToOne('RentalEntity', 'items')
  @JoinColumn({ name: 'rentalId' })
  public rental!: Relation<RentalEntity>;

  @Column({ type: 'uuid' })
  public rentalId!: string;

  // Relacja do elementu magazynowego
  @Column({ type: 'uuid' })
  public inventoryItemId!: string;

  // Dane elementu w momencie wynajmu (snapshot)
  @Column({ length: 100 })
  public itemName!: string;

  @Column({ length: 50 })
  public itemCatalogCode!: string;

  @Column({ length: 30 })
  public itemType!: string;

  @Column({ length: 30 })
  public itemSystem!: string;

  // Wymiary (ważne - różne rozmiary w magazynie)
  @Column({ type: 'float', nullable: true })
  public dimensionLength!: number;

  @Column({ type: 'float', nullable: true })
  public dimensionWidth!: number;

  @Column({ type: 'float', nullable: true })
  public dimensionHeight!: number;

  // Ilość i cena
  @Column({ type: 'int' })
  public quantity!: number;

  @Column({ type: 'float' })
  public dailyPricePerUnit!: number;

  // Zwroty
  @Column({ type: 'int', default: 0 })
  public returnedQuantity!: number;

  @Column({ type: 'datetime', nullable: true })
  public returnedAt!: Date;

  @Column({ type: 'text', nullable: true })
  public returnNotes!: string;

  @CreateDateColumn()
  public createdAt!: Date;
}

/**
 * Wynajem (zamówienie)
 */
@Entity('rentals')
export class RentalEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  // Numer zamówienia (czytelny dla ludzi)
  @Column({ length: 20, unique: true })
  public orderNumber!: string;

  @ManyToOne('CustomerEntity', 'rentals')
  @JoinColumn({ name: 'customerId' })
  public customer!: Relation<CustomerEntity>;

  @Column({ type: 'uuid' })
  public customerId!: string;

  // Właściciel wypożyczalni
  @Column({ type: 'uuid' })
  public ownerId!: string;

  // Terminy wynajmu
  @Column({ type: 'datetime' })
  public startDate!: Date;

  @Column({ type: 'datetime' })
  public expectedEndDate!: Date;

  @Column({ type: 'datetime', nullable: true })
  public actualEndDate!: Date;

  // Status
  @Column({ length: 20, default: 'active' })
  public status!:
    | 'draft'
    | 'active'
    | 'partially_returned'
    | 'completed'
    | 'cancelled';

  // Koszty
  @Column({ type: 'float', default: 0 })
  public totalDailyRate!: number;

  @Column({ type: 'float', default: 0 })
  public depositAmount!: number;

  @Column({ type: 'float', default: 0 })
  public totalPaid!: number;

  // Adres dostawy (jeśli inny niż klienta)
  @Column({ type: 'text', nullable: true })
  public deliveryAddress!: string;

  // Notatki
  @Column({ type: 'text', nullable: true })
  public notes!: string;

  // Pozycje wynajmu
  @OneToMany('RentalItemEntity', 'rental')
  public items!: RentalItemEntity[];

  // Powiązany projekt szalunkowy
  @Column({ type: 'uuid', nullable: true })
  public projectId!: string;

  @CreateDateColumn()
  public createdAt!: Date;

  @UpdateDateColumn()
  public updatedAt!: Date;
}

/**
 * Klient wypożyczalni szalunków
 */
@Entity('customers')
export class CustomerEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  // Dane firmy/osoby
  @Column({ length: 100 })
  public companyName!: string;

  @Column({ length: 50, nullable: true })
  public contactPerson!: string;

  @Column({ length: 20, nullable: true })
  public nip!: string;

  // Dane kontaktowe
  @Column({ length: 100 })
  public email!: string;

  @Column({ length: 20 })
  public phone!: string;

  @Column({ length: 20, nullable: true })
  public phoneSecondary!: string;

  // Adres
  @Column({ length: 100 })
  public street!: string;

  @Column({ length: 10 })
  public postalCode!: string;

  @Column({ length: 50 })
  public city!: string;

  // Notatki
  @Column({ type: 'text', nullable: true })
  public notes!: string;

  // Status klienta
  @Column({ default: true })
  public isActive!: boolean;

  // Właściciel wypożyczalni (relacja)
  @Column({ type: 'uuid' })
  public ownerId!: string;

  // Wynajmy klienta
  @OneToMany('RentalEntity', 'rentals')
  public rentals!: RentalEntity[];

  @CreateDateColumn()
  public createdAt!: Date;

  @UpdateDateColumn()
  public updatedAt!: Date;
}
