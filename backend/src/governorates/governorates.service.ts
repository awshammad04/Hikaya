import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Governorate } from '../database/seed/palestine.types';
import { catalog } from '../database/seed/palestine-data';
import { LocationsService } from '../locations/locations.service';

interface GovernorateRow {
  id: string;
  slug: string;
  name: string;
  arabic_name: string;
  description: string | null;
  arabic_description: string | null;
  map_config: Pick<Governorate, 'mapCenter' | 'mapZoom' | 'bounds'>;
  cover_image_url: string | null;
}

@Injectable()
export class GovernoratesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly locations: LocationsService,
  ) {}

  async findAll() {
    let governors: Array<(typeof catalog.governorates)[number]> = [
      ...catalog.governorates,
    ];
    if (this.db.isAvailable()) {
      const result = await this.db.query<GovernorateRow>(
        'SELECT * FROM governorates ORDER BY name',
      );
      governors = result.rows.map((row) => ({
        ...(catalog.governorates.find((item) => item.id === row.id) ?? {}),
        id: row.id,
        slug: row.slug,
        name: row.name,
        arabicName: row.arabic_name,
        description:
          row.description ??
          catalog.governorates.find((item) => item.id === row.id)
            ?.description ??
          '',
        arabicDescription:
          row.arabic_description ??
          catalog.governorates.find((item) => item.id === row.id)
            ?.arabicDescription ??
          '',
        ...row.map_config,
        coverImageUrl: row.cover_image_url ?? undefined,
      }));
    }
    const all = await this.locations.findAllWithStats('all');
    return governors.map((item) => ({
      ...item,
      locationCount: all.filter(
        (location) => location.governorateId === item.id,
      ).length,
    }));
  }

  async findOne(id: string) {
    const item = (await this.findAll()).find(
      (governorate) => governorate.id === id || governorate.slug === id,
    );
    if (!item) throw new NotFoundException(`Governorate "${id}" not found`);
    return item;
  }
}
