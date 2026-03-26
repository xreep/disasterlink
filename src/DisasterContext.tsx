import { createContext, useContext, useState, useEffect } from "react";

export type DisasterType =
  | "Flood"
  | "Earthquake"
  | "Cyclone"
  | "Landslide"
  | "Drought"
  | "Industrial Accident";

export const DISASTER_TYPES: DisasterType[] = [
  "Flood",
  "Earthquake",
  "Cyclone",
  "Landslide",
  "Drought",
  "Industrial Accident",
];

const STORAGE_KEY = "disasterlink-disaster-type";
const DEFAULT_TYPE: DisasterType = "Flood";

function buildDisasterName(type: DisasterType): string {
  return `India ${type} Response`;
}

interface DisasterContextValue {
  disasterType: DisasterType;
  disasterName: string;
  setDisasterType: (type: DisasterType) => void;
}

const DisasterContext = createContext<DisasterContextValue>({
  disasterType: DEFAULT_TYPE,
  disasterName: buildDisasterName(DEFAULT_TYPE),
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
