import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

export enum ProjectStatus {
  PENDIENTE = 'pendiente',
  EN_PROGRESO = 'en_progreso',
  COMPLETADO = 'completado',
  CANCELADO = 'cancelado',
}

/** Postgres returns `numeric` as a string; keep money as a number in the app. */
const numericToNumber = {
  to: (value: number) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};

@Entity('proyectos')
export class Project {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 150 })
  nombre: string;

  @Column({ name: 'fecha_inicio', type: 'date' })
  fechaInicio: string;

  @Column({
    type: 'enum',
    enum: ProjectStatus,
    default: ProjectStatus.PENDIENTE,
  })
  estado: ProjectStatus;

  @Column({ length: 120 })
  responsable: string;

  @Column({ type: 'numeric', precision: 14, scale: 2, transformer: numericToNumber })
  monto: number;

  @ManyToOne(() => User, (user) => user.proyectos, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @Column({ name: 'created_by' })
  createdById: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
