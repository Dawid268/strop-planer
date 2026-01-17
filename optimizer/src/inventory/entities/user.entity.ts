import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { FormworkProjectEntity } from './formwork-project.entity';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ length: 100 })
  public companyName!: string;

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

  @Column({ length: 20, default: 'user' })
  public role!: 'admin' | 'user';

  @Column({ default: true })
  public isActive!: boolean;

  @OneToMany(() => FormworkProjectEntity, (project) => project.user)
  public projects!: FormworkProjectEntity[];

  @CreateDateColumn()
  public createdAt!: Date;

  @UpdateDateColumn()
  public updatedAt!: Date;
}
