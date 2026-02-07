import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Slab')
@Controller({ version: '1', path: 'slab' })
export class SlabController {}
