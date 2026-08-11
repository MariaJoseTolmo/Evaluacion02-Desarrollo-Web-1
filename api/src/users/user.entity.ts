import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Project } from '../projects/project.entity';

@Entity('usuarios')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 120 })
  nombre: string;

  /** Unique business identifier for the user. */
  @Column({ length: 180, unique: true })
  correo: string;

  /** bcrypt hash — never the plain password, and excluded from default selects. */
  @Column({ length: 60, select: false })
  clave: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => Project, (project) => project.createdBy)
  proyectos: Project[];
}
