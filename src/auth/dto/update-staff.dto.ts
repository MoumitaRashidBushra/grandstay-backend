import { IsBoolean } from 'class-validator';

export class UpdateStaffDto {
  @IsBoolean()
  isActive: boolean;
}
