export type CarSalesPitchSectionId =
  | "hook"
  | "exterior"
  | "interior"
  | "features"
  | "condition"
  | "price"
  | "cta";

export interface CarSalesPitchSection {
  readonly id: CarSalesPitchSectionId;
  readonly title: string;
  readonly preferredRoles: readonly string[];
  readonly targetDurationSeconds: number;
}

export const DEFAULT_CAR_SALES_PITCH_SECTIONS: readonly CarSalesPitchSection[] = [
  {
    id: "hook",
    title: "Opening hook",
    preferredRoles: ["hero", "intro", "front_view", "walkaround_start"],
    targetDurationSeconds: 3,
  },
  {
    id: "exterior",
    title: "Exterior walk-around",
    preferredRoles: ["exterior", "front", "side", "rear", "wheels"],
    targetDurationSeconds: 8,
  },
  {
    id: "interior",
    title: "Interior and dashboard",
    preferredRoles: ["interior", "dashboard", "seats", "infotainment"],
    targetDurationSeconds: 7,
  },
  {
    id: "features",
    title: "Feature highlights",
    preferredRoles: ["feature", "engine", "trunk", "sunroof", "safety"],
    targetDurationSeconds: 8,
  },
  {
    id: "condition",
    title: "Condition proof",
    preferredRoles: ["condition", "detail", "paint", "tires", "mileage"],
    targetDurationSeconds: 6,
  },
  {
    id: "price",
    title: "Price and offer",
    preferredRoles: ["price", "offer", "deal"],
    targetDurationSeconds: 4,
  },
  {
    id: "cta",
    title: "Call to action",
    preferredRoles: ["cta", "contact", "dealer", "ending"],
    targetDurationSeconds: 4,
  },
];

export function inferCarSalesSection(role = ""): CarSalesPitchSectionId {
  const normalizedRole = role.toLowerCase();

  for (const section of DEFAULT_CAR_SALES_PITCH_SECTIONS) {
    if (section.preferredRoles.some((candidate) => normalizedRole.includes(candidate))) {
      return section.id;
    }
  }

  return "features";
}
