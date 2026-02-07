import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { AutoMap } from '@automapper/classes';
import { FormworkProjectEntity } from '@/inventory/entities/formwork-project.entity';

@Entity('users')
@Index('IDX_user_email', ['email'], { unique: true })
export class UserEntity {
  @AutoMap()
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @AutoMap()
  @Column({ length: 100 })
  public companyName!: string;

  @AutoMap()
  @Column({ length: 100, unique: true })
  public email!: string;

  @Column({ length: 255 })
  public passwordHash!: string;

  @Column({ length: 20, nullable: true })
  public phone?: string;

  @Column({ type: 'text', nullable: true })
  public address?: string;

  @Column({ length: 20, nullable: true })
  public taxId?: string;

  @AutoMap()
  @Column({ length: 20, default: 'user' })
  public role!: 'admin' | 'user';

  @AutoMap()
  @Column({ default: true })
  public isActive!: boolean;

  @Column({ type: 'text', nullable: true })
  public hashedRt?: string | null;

  @OneToMany(() => FormworkProjectEntity, (project) => project.user)
  public projects!: FormworkProjectEntity[];

  @CreateDateColumn()
  public createdAt!: Date;

  @UpdateDateColumn()
  public updatedAt!: Date;

  @DeleteDateColumn()
  public deletedAt?: Date;
}
