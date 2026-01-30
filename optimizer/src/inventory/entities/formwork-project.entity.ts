import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from './user.entity';
import { SlabType } from '../../slab/enums/slab.enums';
import { AutoMap } from '@automapper/classes';

@Entity('formwork_projects')
export class FormworkProjectEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ length: 100 })
  public name!: string;

  @Column({ type: 'text', nullable: true })
  public description?: string;

  @AutoMap()
  @Column({ length: 50, default: 'draft' })
  public status!: 'draft' | 'calculated' | 'optimized' | 'sent' | 'completed';

  // Dane stropu
  @Column({ type: 'float' })
  public slabLength!: number;

  @Column({ type: 'float' })
  public slabWidth!: number;

  @Column({ type: 'float' })
  public slabThickness!: number;

  @Column({ type: 'float' })
  public floorHeight!: number;

  @AutoMap()
  @Column({
    type: 'simple-enum',
    enum: SlabType,
    default: SlabType.MONOLITHIC,
  })
  public slabType!: SlabType;

  // Wybrany system szalunkowy
  @Column({ length: 30, nullable: true })
  public formworkSystem?: string;

  // Wyniki obliczeń (JSON)
  @Column({ type: 'text', nullable: true })
  public calculationResult?: string;

  @Column({ type: 'text', nullable: true })
  public optimizationResult?: string;

  // Pdf źródłowy
  @Column({ length: 255, nullable: true })
  public sourcePdfPath?: string;

  @Column({ type: 'text', nullable: true })
  public extractedPdfData?: string;

  // Automatycznie wykryta geometria (Polygons)
  @Column({ type: 'text', nullable: true })
  public extractedSlabGeometry?: string;

  @Column({ type: 'text', nullable: true })
  public svgPath?: string;

  @Column({ type: 'text', nullable: true })
  public dxfPath?: string;

  @Column({ type: 'text', nullable: true })
  public geoJsonPath?: string;

  // Relacja z użytkownikiem
  @ManyToOne(() => UserEntity, (user) => user.projects)
  @JoinColumn({ name: 'userId' })
  public user!: UserEntity;

  @Column({ type: 'uuid' })
  public userId!: string;

  // Email do wysłania wyników
  @Column({ length: 100, nullable: true })
  public notificationEmail?: string;

  @Column({ type: 'datetime', nullable: true })
  public emailSentAt?: Date;

  @CreateDateColumn()
  public createdAt!: Date;

  @UpdateDateColumn()
  public updatedAt!: Date;

  @Column({ type: 'text', nullable: true })
  public editorData?: string;
}
