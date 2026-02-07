import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Rentals')
@Controller({ version: '1', path: 'rentals' })
export class RentalsController {}
