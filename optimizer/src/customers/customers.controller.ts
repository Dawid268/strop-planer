import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Customers')
@Controller({ version: '1', path: 'customers' })
export class CustomersController {}
