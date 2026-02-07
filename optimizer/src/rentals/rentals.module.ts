import { Module } from '@nestjs/common';
import { RentalsService } from '@/rentals/rentals.service';
import { RentalsController } from '@/rentals/rentals.controller';

@Module({
  providers: [RentalsService],
  controllers: [RentalsController],
})
export class RentalsModule {}
