import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { config } from './config';
import { User } from './users/user.entity';
import { Project } from './projects/project.entity';
import { AuthModule } from './auth/auth.module';
import { ProjectsModule } from './projects/projects.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      ...config.db,
      entities: [User, Project],
    }),
    AuthModule,
    ProjectsModule,
  ],
})
export class AppModule {}
