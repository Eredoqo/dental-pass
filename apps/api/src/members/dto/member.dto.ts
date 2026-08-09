import { ArrayNotEmpty, IsArray, IsEmail, IsIn, IsOptional } from 'class-validator';
import { ClinicRole } from '@dental-passport/db';

const ROLES: ClinicRole[] = ['OWNER', 'ADMIN', 'DENTIST', 'ASSISTANT'];

export class InviteMemberDto {
  @IsEmail()
  email: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsIn(ROLES, { each: true })
  roles: ClinicRole[];
}

export class UpdateMemberDto {
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(ROLES, { each: true })
  roles?: ClinicRole[];

  @IsOptional()
  @IsIn(['ACTIVE', 'DISABLED'])
  status?: 'ACTIVE' | 'DISABLED';
}
