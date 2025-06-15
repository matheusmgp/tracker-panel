interface TrackerMessage {
  timestamp: string;
  event: string;
  data: string;
}

interface ConnectionInfo {
  status: boolean;
  connectedAt?: string;
  disconnectedAt?: string;
}

interface TrackerInfo {
  id: number;
  device: string;
  blocker: boolean;
  situation: string;
  eletronicfence: string;
  version: string;
  hdr_network: string;
  model: string;
  vehicleid: number;
  plate: string;
  description: string;
  color: string;
  renavan: string;
  chassis: string;
  vehicletype: string;
}
