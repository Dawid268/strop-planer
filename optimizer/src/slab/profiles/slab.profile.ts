import { AutomapperProfile, InjectMapper } from '@automapper/nestjs';
import { createMap, Mapper, MappingProfile } from '@automapper/core';
import { Injectable } from '@nestjs/common';
import {
  SlabData,
  BeamData,
  SlabDimensions,
  ReinforcementData,
  AxesData,
  BeamSection,
} from '@/slab/interfaces/slab.interface';
import {
  SlabDataDto,
  BeamDataDto,
  SlabDimensionsDto,
  ReinforcementDataDto,
  AxesDto,
  BeamSectionDto,
} from '@/slab/dto/slab.dto';

@Injectable()
export class SlabProfile extends AutomapperProfile {
  constructor(@InjectMapper() mapper: Mapper) {
    super(mapper);
  }

  override get profile(): MappingProfile {
    return (mapper: Mapper) => {
      createMap(mapper, SlabDimensions, SlabDimensionsDto);
      createMap(mapper, BeamSection, BeamSectionDto);
      createMap(mapper, BeamData, BeamDataDto);
      createMap(mapper, ReinforcementData, ReinforcementDataDto);
      createMap(mapper, AxesData, AxesDto);
      createMap(mapper, SlabData, SlabDataDto);
    };
  }
}
