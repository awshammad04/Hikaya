import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { CreateJourneyDto } from './create-journey.dto';
import { JourneysService } from './journeys.service';

@Controller('journeys')
export class JourneysController {
  constructor(private readonly journeys: JourneysService) {}
  @Post() @HttpCode(200) create(@Body() dto: CreateJourneyDto) {
    return this.journeys.create(dto);
  }
}
