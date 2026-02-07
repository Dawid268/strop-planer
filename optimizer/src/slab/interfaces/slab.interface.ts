import { AutoMap } from '@automapper/classes';
import { SlabType, ReinforcementElementType } from '@/slab/enums/slab.enums';

export class SlabDimensions {
  @AutoMap()
  length!: number;
  @AutoMap()
  width!: number;
  @AutoMap()
  thickness!: number;
  @AutoMap()
  area!: number;
}

export class BeamSection {
  @AutoMap()
  width!: number;
  @AutoMap()
  height!: number;
}

export class BeamData {
  @AutoMap()
  symbol!: string;
  @AutoMap()
  quantity!: number;
  @AutoMap()
  mainRebarDiameter!: number;
  @AutoMap()
  stirrupDiameter!: number;
  @AutoMap()
  totalLength!: number;
  @AutoMap()
  span?: number;
  @AutoMap(() => BeamSection)
  section?: BeamSection;
}

export class ReinforcementData {
  @AutoMap()
  elementId!: string;
  @AutoMap()
  elementType!: ReinforcementElementType;
  @AutoMap()
  diameter!: number;
  @AutoMap()
  length!: number;
  @AutoMap()
  quantity!: number;
  @AutoMap()
  totalMass?: number;
}

export class AxesData {
  @AutoMap()
  horizontal!: string[];
  @AutoMap()
  vertical!: string[];
}

export class SlabData {
  @AutoMap()
  id!: string;
  @AutoMap(() => SlabDimensions)
  dimensions!: SlabDimensions;
  @AutoMap()
  type!: SlabType;
  @AutoMap(() => [BeamData])
  beams!: BeamData[];
  @AutoMap(() => [ReinforcementData])
  reinforcement!: ReinforcementData[];
  @AutoMap(() => AxesData)
  axes!: AxesData;
  @AutoMap()
  concreteClass?: string;
  @AutoMap()
  steelClass?: string;
  @AutoMap()
  notes?: string[];
}

export class ExtractedPdfData {
  @AutoMap()
  sourceFile!: string;
  @AutoMap()
  extractedAt!: Date;
  @AutoMap(() => SlabData)
  slab?: SlabData | null;
  @AutoMap()
  rawText!: string;
  @AutoMap()
  warnings!: string[];
  @AutoMap()
  geometry?: { polygons: { x: number; y: number }[][] };
}
