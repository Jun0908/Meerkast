export type MapPosition = {
  id: string;
  name: string;
  x: string; // CSS top value (e.g., '20%')
  y: string; // CSS left value (e.g., '30%')
  agentX: string;
  agentY: string;
};

// percentages are used for responsive absolute positioning relative to the map container
export const mapZones: Record<string, MapPosition> = {
  digging: {
    id: 'digging',
    name: 'Digging Zone',
    x: '20%',
    y: '20%',
    agentX: '25%',
    agentY: '25%',
  },
  crafting: {
    id: 'crafting',
    name: 'Crafting Zone',
    x: '20%',
    y: '70%',
    agentX: '25%',
    agentY: '75%',
  },
  inspection: {
    id: 'inspection',
    name: 'Inspection',
    x: '50%',
    y: '50%',
    agentX: '45%',
    agentY: '50%',
  },
  storage: {
    id: 'storage',
    name: 'Storage',
    x: '80%',
    y: '20%',
    agentX: '75%',
    agentY: '25%',
  },
  restArea: {
    id: 'restArea',
    name: 'Rest Area',
    x: '80%',
    y: '80%',
    agentX: '75%',
    agentY: '75%',
  },
};
