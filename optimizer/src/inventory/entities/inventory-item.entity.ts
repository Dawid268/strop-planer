import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('inventory_items')
export class InventoryItemEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ type: 'uuid', nullable: true })
  public ownerId?: string;

  @Column({ length: 50 })
  public catalogCode!: string;

  @Column({ length: 100 })
  public name!: string;

  @Column({ length: 20 })
  public type!:
    | 'panel'
    | 'prop'
    | 'beam'
    | 'head'
    | 'tripod'
    | 'drophead'
    | 'accessory';

  @Column({ length: 50 })
  public system!: string;

  @Column({ length: 50 })
  public manufacturer!: string;

  @Column({ type: 'float', nullable: true })
  public dimensionLength?: number;

  @Column({ type: 'float', nullable: true })
  public dimensionWidth?: number;

  @Column({ type: 'float', nullable: true })
  public dimensionHeight?: number;

  @Column({ type: 'int', default: 0 })
  public quantityAvailable!: number;

  @Column({ type: 'int', default: 0 })
  public quantityReserved!: number;

  @Column({ type: 'float', nullable: true })
  public loadCapacity?: number;

  @Column({ type: 'float' })
  public weight!: number;

  @Column({ type: 'float' })
  public dailyRentPrice!: number;

  @Column({ length: 20, default: 'dobry' })
  public condition!: 'nowy' | 'dobry' | 'używany' | 'do_naprawy';

  @Column({ length: 50, nullable: true })
  public warehouseLocation?: string;

  @Column({ default: true })
  public isActive!: boolean;

  @Column({ type: 'datetime', nullable: true })
  public lastInspectionDate?: Date;

  @Column({ type: 'text', nullable: true })
  public notes?: string;

  @CreateDateColumn()
  public createdAt!: Date;

  @UpdateDateColumn()
  public updatedAt!: Date;
}
