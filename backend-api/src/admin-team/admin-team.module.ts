import { Module } from '@nestjs/common';
import { AdminTeamService } from './admin-team.service';
import { AdminTeamController } from './admin-team.controller';
import { EmailModule } from '../email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [EmailModule, NotificationsModule],
  providers: [AdminTeamService],
  controllers: [AdminTeamController],
  exports: [AdminTeamService],
})
export class AdminTeamModule {}
