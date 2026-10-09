import { Controller, Get, Param } from '@nestjs/common';
import { GovernoratesService } from './governorates.service';
import { LocationsService } from '../locations/locations.service';

@Controller('governorates')
export class GovernoratesController {
  constructor(
    private readonly governors: GovernoratesService,
    private readonly locations: LocationsService,
  ) {}
  @Get() findAll() {
    return this.governors.findAll();
  }
  @Get(':id/locations') async findLocations(@Param('id') id: string) {
    const governorate = await this.governors.findOne(id);
    return this.locations.findAllWithStats(governorate.id);
  }
  @Get(':id') findOne(@Param('id') id: string) {
    return this.governors.findOne(id);
  }
}
