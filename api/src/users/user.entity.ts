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

  /**
   * Argon2id hash — never the plain password, and excluded from default
   * selects. El formato codificado (`$argon2id$v=19$m=...,t=...,p=...$sal$hash`)
   * ocupa ~97 caracteres con los parámetros actuales; 255 deja margen para
   * subirlos sin migrar la columna.
   */
  @Column({ length: 255, select: false })
  clave: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => Project, (project) => project.createdBy)
  proyectos: Project[];
}
