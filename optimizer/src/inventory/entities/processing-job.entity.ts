import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { FormworkProjectEntity } from '@/inventory/entities/formwork-project.entity';

export type ProcessingJobType = 'geometry_extraction';

export type ProcessingJobStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';

/**
 * Tabela jobów przetwarzania (ekstrakcja geometrii, w przyszłości inne typy).
 * Przechowuje aktualny stan joba i korelację z projektem.
 * Docelowo może być synchronizowana z Redis / kolejką (Bull itp.).
 */
@Entity('processing_jobs')
@Index(['projectId'])
@Index(['status'])
@Index(['type', 'createdAt'])
export class ProcessingJobEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  /** Typ joba – np. geometry_extraction (rozszerzalne o kolejki, inne pipeline'y). */
  @Column({ length: 50 })
  public type!: ProcessingJobType;

  @Column({ length: 20 })
  public status!: ProcessingJobStatus;

  @Column({ type: 'text' })
  public message!: string;

  @Column({ type: 'int', default: 0 })
  public attempt!: number;

  /** Opcjonalna relacja do projektu (np. ekstrakcja geometrii dla projektu). */
  @ManyToOne(() => FormworkProjectEntity, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'projectId' })
  public project?: FormworkProjectEntity | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  public projectId?: string | null;

  /** Payload wejściowy (np. pdfPath) – JSON. */
  @Column({ type: 'text', nullable: true })
  public payload?: string | null;

  /** Wynik (np. geometria) – JSON, wypełniany przy statusie completed. */
  @Column({ type: 'text', nullable: true })
  public result?: string | null;

  /** Błąd lub ostatni komunikat błędu – przy statusie failed. */
  @Column({ type: 'text', nullable: true })
  public error?: string | null;

  @CreateDateColumn()
  public createdAt!: Date;

  @UpdateDateColumn()
  public updatedAt!: Date;
}
