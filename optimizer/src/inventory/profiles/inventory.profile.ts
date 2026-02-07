import { AutomapperProfile, InjectMapper } from '@automapper/nestjs';
import {
  createMap,
  forMember,
  mapFrom,
  Mapper,
  MappingProfile,
} from '@automapper/core';
import { Injectable } from '@nestjs/common';
import { InventoryItemEntity } from '@/inventory/entities/inventory-item.entity';
import { CreateInventoryItemDto, InventoryItemDto } from '@/inventory/dto/inventory.dto';

@Injectable()
export class InventoryProfile extends AutomapperProfile {
  constructor(@InjectMapper() mapper: Mapper) {
    super(mapper);
  }

  override get profile(): MappingProfile {
    return (mapper: Mapper) => {
      createMap(
        mapper,
        InventoryItemEntity,
        InventoryItemDto,
        forMember(
          (d) => d.dimensions,
          mapFrom((s) => ({
            length: s.dimensionLength,
            width: s.dimensionWidth,
            height: s.dimensionHeight,
          })),
        ),
      );

      createMap(
        mapper,
        CreateInventoryItemDto,
        InventoryItemEntity,
        forMember(
          (d) => d.dimensionLength,
          mapFrom((s) => s.dimensions?.length),
        ),
        forMember(
          (d) => d.dimensionWidth,
          mapFrom((s) => s.dimensions?.width),
        ),
        forMember(
          (d) => d.dimensionHeight,
          mapFrom((s) => s.dimensions?.height),
        ),
        // Explicitly map type and condition just in case simple-enum needs it
        forMember(
          (d) => d.type,
          mapFrom((s) => s.type),
        ),
        forMember(
          (d) => d.condition,
          mapFrom((s) => s.condition),
        ),
      );
    };
  }
}
