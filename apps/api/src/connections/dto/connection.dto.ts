import { IsEmail, IsIn, IsOptional } from 'class-validator';

export class CreateConnectionDto {
  @IsEmail()
  email: string;
}

export class ListConnectionsQuery {
  @IsOptional()
  @IsIn(['PENDING', 'ACTIVE', 'REVOKED'])
  status?: 'PENDING' | 'ACTIVE' | 'REVOKED';
}
