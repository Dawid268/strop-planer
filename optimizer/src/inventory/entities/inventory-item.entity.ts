import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { AutoMap } from '@automapper/classes';
import { ItemType, ItemCondition } from '@/inventory/enums/inventory.enums';

@Entity('inventory_items')
@Index('IDX_inventory_item_owner', ['ownerId'])
@Index('IDX_inventory_item_type', ['type'])
@Index('IDX_inventory_item_system', ['system'])
@Index('IDX_inventory_item_active', ['isActive'])
export class InventoryItemEntity {
  @AutoMap()
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @AutoMap()
  @Column({ type: 'uuid', nullable: true })
  public ownerId?: string;

  @AutoMap()
  @Column({ length: 50 })
  public catalogCode!: string;

  @AutoMap()
  @Column({ length: 100 })
  public name!: string;

  @AutoMap()
  @Column({
    type: 'simple-enum',
    enum: ItemType,
  })
  public type!: ItemType;

  @AutoMap()
  @Column({ length: 50 })
  public system!: string;

  @AutoMap()
  @Column({ length: 50 })
  public manufacturer!: string;

  @AutoMap()
  @Column({ type: 'float', nullable: true })
  public dimensionLength?: number;

  @AutoMap()
  @Column({ type: 'float', nullable: true })
  public dimensionWidth?: number;

  @AutoMap()
  @Column({ type: 'float', nullable: true })
  public dimensionHeight?: number;

  @AutoMap()
  @Column({ type: 'int', default: 0 })
  public quantityAvailable!: number;

  @AutoMap()
  @Column({ type: 'int', default: 0 })
  public quantityReserved!: number;

  @AutoMap()
  @Column({ type: 'float', nullable: true })
  public loadCapacity?: number;

  @AutoMap()
  @Column({ type: 'float' })
  public weight!: number;

  @AutoMap()
  @Column({ type: 'float' })
  public dailyRentPrice!: number;

  @AutoMap()
  @Column({
    type: 'simple-enum',
    enum: ItemCondition,
    default: ItemCondition.GOOD,
  })
  public condition!: ItemCondition;

  @AutoMap()
  @Column({ length: 50, nullable: true })
  public warehouseLocation?: string;

  @AutoMap()
  @Column({ default: true })
  public isActive!: boolean;

  @AutoMap()
  @Column({ type: 'datetime', nullable: true })
  public lastInspectionDate?: Date;

  @AutoMap()
  @Column({ type: 'text', nullable: true })
  public notes?: string;

  @AutoMap()
  @CreateDateColumn()
  public createdAt!: Date;

  @AutoMap()
  @UpdateDateColumn()
  public updatedAt!: Date;

  @DeleteDateColumn()
  public deletedAt?: Date;
}
