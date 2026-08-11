import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './project.entity';
import { CreateProjectDto, UpdateProjectDto } from './project.dto';
import { AuthedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';

/**
 * CRUD with no business rules beyond ownership, so the handler talks to the
 * TypeORM repository directly — a service layer here would add nothing.
 */
@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(
    @InjectRepository(Project) private readonly projects: Repository<Project>,
  ) {}

  @Get()
  findAll(@Req() req: AuthedRequest) {
    return this.projects.find({
      where: { createdById: req.user.id },
      order: { fechaInicio: 'DESC' },
    });
  }

  @Post()
  create(@Req() req: AuthedRequest, @Body() dto: CreateProjectDto) {
    return this.projects.save(
      this.projects.create({ ...dto, createdById: req.user.id }),
    );
  }

  @Patch(':id')
  async update(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProjectDto,
  ) {
    // Scoped by owner so one user cannot edit another's project.
    const project = await this.projects.findOneBy({
      id,
      createdById: req.user.id,
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');

    return this.projects.save(Object.assign(project, dto));
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    // Scope the delete by owner so one user cannot remove another's project.
    const { affected } = await this.projects.delete({
      id,
      createdById: req.user.id,
    });
    if (!affected) throw new NotFoundException('Proyecto no encontrado');
  }
}
