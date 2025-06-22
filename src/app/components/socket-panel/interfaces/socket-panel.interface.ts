export interface TrackerMessage {
  timestamp: string;
  event: string;
  data: string;
}

export interface MappedTrackerData {
  tipo: string;
  serialNumber: string;
  versao: string;
  comando?: string;
  estacionamento?: string;
  speedmax?: number;
  tipoConexao?: string;
  zip?: string;
  envioagrupado?: string;
  alarmebateria?: string;
  alarmegps?: string;
  alarmebateriabkp?: string;
  sensormovimento?: string;
  ligacao?: string;
  cercaeletronica?: string;
  log?: string;
}

export interface DisplayMessage {
  timestamp: string;
  event: string;
  data: MappedTrackerData;
  rawData: string;
}
