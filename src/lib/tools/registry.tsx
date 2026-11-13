import type { ComponentType } from "react";
import {
  Clock,
  Compass,
  Navigation,
  ArrowRightLeft,
  ArrowLeftRight,
  FileSpreadsheet,
  Aperture,
  Eye,
  Grid3x3,
  Gauge,
  Ruler,
  Cloud,
  Upload,
  CloudRain,
  Sparkles,
  Moon,
  type LucideIcon,
} from "lucide-react";
import { JdConverter } from "@/components/tools/JdConverter";
import { RaDecConverter } from "@/components/tools/RaDecConverter";
import { DegToRaDecConverter } from "@/components/tools/DegToRaDecConverter";
import { SipsConverter } from "@/components/tools/SipsConverter";
import { VsnetToAavsoConverter } from "@/components/tools/VsnetToAavsoConverter";
import { AavsoToVsnetConverter } from "@/components/tools/AavsoToVsnetConverter";
import { Ascii3Converter } from "@/components/tools/Ascii3Converter";
import { ExposureTimeCalculator } from "@/components/tools/ExposureTimeCalculator";
import { TelescopeFovCalculator } from "@/components/tools/TelescopeFovCalculator";
import { PlateScaleCalculator } from "@/components/tools/PlateScaleCalculator";
import { MagnitudeFluxConverter } from "@/components/tools/MagnitudeFluxConverter";
import { DistanceConverter } from "@/components/tools/DistanceConverter";
import { ClearSkyChecker } from "@/components/tools/ClearSkyChecker";
import { CatalogImportConverter } from "@/components/tools/CatalogImportConverter";
import { CloudyNightExcuseGenerator } from "@/components/tools/CloudyNightExcuseGenerator";
import { StarNamer } from "@/components/tools/StarNamer";
import { TelescopeHoroscope } from "@/components/tools/TelescopeHoroscope";

export type ToolSection = "coordinates" | "converters" | "telescope" | "planning" | "fun";

export interface ToolDef {
  slug: string;
  titleKey: string;
  descKey?: string;
  icon: LucideIcon;
  section: ToolSection;
  Component: ComponentType;
}

export const TOOL_SECTIONS: ToolSection[] = ["coordinates", "converters", "telescope", "planning", "fun"];

export const TOOLS: ToolDef[] = [
  { slug: "jd", titleKey: "tools.jd.title", icon: Clock, section: "coordinates", Component: JdConverter },
  { slug: "radec", titleKey: "tools.radec.title", icon: Compass, section: "coordinates", Component: RaDecConverter },
  { slug: "deg2radec", titleKey: "tools.deg2radec.title", icon: Navigation, section: "coordinates", Component: DegToRaDecConverter },

  { slug: "sips", titleKey: "tools.converter.title", descKey: "tools.converter.desc", icon: ArrowRightLeft, section: "converters", Component: SipsConverter },
  { slug: "vsnet", titleKey: "tools.vsnet.title", descKey: "tools.vsnet.desc", icon: ArrowRightLeft, section: "converters", Component: VsnetToAavsoConverter },
  { slug: "aavso", titleKey: "tools.aavso.title", descKey: "tools.aavso.desc", icon: ArrowLeftRight, section: "converters", Component: AavsoToVsnetConverter },
  { slug: "ascii3", titleKey: "tools.ascii3.title", descKey: "tools.ascii3.desc", icon: FileSpreadsheet, section: "converters", Component: Ascii3Converter },

  { slug: "etc", titleKey: "tools.etc.title", descKey: "tools.etc.desc", icon: Aperture, section: "telescope", Component: ExposureTimeCalculator },
  { slug: "fov", titleKey: "tools.fov.title", descKey: "tools.fov.desc", icon: Eye, section: "telescope", Component: TelescopeFovCalculator },
  { slug: "platescale", titleKey: "tools.plateScale.title", descKey: "tools.plateScale.desc", icon: Grid3x3, section: "telescope", Component: PlateScaleCalculator },
  { slug: "magnitude", titleKey: "tools.magnitude.title", descKey: "tools.magnitude.desc", icon: Gauge, section: "telescope", Component: MagnitudeFluxConverter },
  { slug: "distances", titleKey: "tools.distances.title", descKey: "tools.distances.desc", icon: Ruler, section: "telescope", Component: DistanceConverter },

  { slug: "skycheck", titleKey: "tools.skyCheck.title", descKey: "tools.skyCheck.desc", icon: Cloud, section: "planning", Component: ClearSkyChecker },
  { slug: "catalogimport", titleKey: "tools.catalogImport.title", descKey: "tools.catalogImport.desc", icon: Upload, section: "planning", Component: CatalogImportConverter },

  { slug: "excuse", titleKey: "tools.excuse.title", descKey: "tools.excuse.desc", icon: CloudRain, section: "fun", Component: CloudyNightExcuseGenerator },
  { slug: "starnamer", titleKey: "tools.starNamer.title", descKey: "tools.starNamer.desc", icon: Sparkles, section: "fun", Component: StarNamer },
  { slug: "horoscope", titleKey: "tools.horoscope.title", descKey: "tools.horoscope.desc", icon: Moon, section: "fun", Component: TelescopeHoroscope },
];

export function getTool(slug: string | undefined): ToolDef | undefined {
  return TOOLS.find((tool) => tool.slug === slug);
}

export function toolsBySection(section: ToolSection): ToolDef[] {
  return TOOLS.filter((tool) => tool.section === section);
}
