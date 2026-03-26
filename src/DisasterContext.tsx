import { createContext, useContext, useState, useEffect } from "react";

export type DisasterType =
  | "Flood"
  | "Earthquake"
  | "Cyclone"
  | "Landslide"
  | "Drought"
  | "Industrial Accident"
  | "Fire"
  | "Heatwave";

export const DISASTER_TYPES: DisasterType[] = [
  "Flood",
  "Earthquake",
  "Cyclone",
  "Landslide",
  "Drought",
  "Industrial Accident",
  "Fire",
  "Heatwave",
];

export interface DisasterMeta {
  color: string;
  description: string;
}

export const DISASTER_CONFIG: Record<DisasterType, DisasterMeta> = {
  "Flood":               { color: "#2563eb", description: "Kerala, Bihar, Assam" },
  "Earthquake":          { color: "#a16207", description: "Northeast, Gujarat, Himalayas" },
  "Cyclone":             { color: "#7c3aed", description: "Odisha, Andhra Pradesh, Tamil Nadu" },
  "Landslide":           { color: "#92400e", description: "Uttarakhand, Himachal Pradesh, Northeast" },
  "Drought":             { color: "#b45309", description: "Vidarbha, Rajasthan" },
  "Industrial Accident": { color: "#dc2626", description: "Chemical and factory disasters" },
  "Fire":                { color: "#ea580c", description: "Urban slums and forest fires" },
  "Heatwave":            { color: "#d97706", description: "Extreme heat across India" },
};

const STORAGE_KEY = "disasterlink-disaster-type";
const DEFAULT_TYPE: DisasterType = "Flood";

function buildDisasterName(type: DisasterType): string {
  return `India ${type} Response`;
}

interface DisasterContextValue {
  disasterType: DisasterType;
  disasterName: string;
  disasterColor: string;
  setDisasterType: (type: DisasterType) => void;
}

const DisasterContext = createContext<DisasterContextValue>({
  disasterType: DEFAULT_TYPE,
  disasterName: buildDisasterName(DEFAULT_TYPE),
  disasterColor: DISASTER_CONFIG[DEFAULT_TYPE].color,
  setDisasterType: () => {},
});

export function DisasterProvider({ children }: { children: React.ReactNode }) {
  const [disasterType, setDisasterTypeState] = useState<DisasterType>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && DISASTER_TYPES.includes(stored as DisasterType)) {
        return stored as DisasterType;
      }
    } catch {}
    return DEFAULT_TYPE;
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, disasterType);
    } catch {}
  }, [disasterType]);

  function setDisasterType(type: DisasterType) {
    setDisasterTypeState(type);
  }

  return (
    <DisasterContext.Provider
      value={{
        disasterType,
        disasterName: buildDisasterName(disasterType),
        disasterColor: DISASTER_CONFIG[disasterType].color,
        setDisasterType,
      }}
    >
      {children}
    </DisasterContext.Provider>
  );
}

export function useDisaster() {
  return useContext(DisasterContext);
}
