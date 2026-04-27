import type { Ship, ShipCooldown, Agent } from '../../services/api';

export type Tab = 'details' | 'nav' | 'scan' | 'extract' | 'cargo' | 'market' | 'shipyard';

export interface FlightControlProps {
  ship: Ship;
  onShipUpdate: (ship: Ship) => void;
}

/** Common props passed to most sub-panels */
export interface PanelProps {
  ship: Ship;
  busy: boolean;
  setBusy: (b: boolean) => void;
  flash: (msg: string, type?: 'ok' | 'err') => void;
}

export interface CooldownPanelProps extends PanelProps {
  onCooldown: boolean;
  setCooldown: (cd: ShipCooldown | null) => void;
}

export interface AgentPanelProps extends PanelProps {
  setAgent: (agent: Agent) => void;
}
