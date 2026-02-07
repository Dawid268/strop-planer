import { Module } from '@nestjs/common';
import { CustomersService } from '@/customers/customers.service';
import { CustomersController } from '@/customers/customers.controller';

@Module({
  providers: [CustomersService],
  controllers: [CustomersController],
})
export class CustomersModule {}
