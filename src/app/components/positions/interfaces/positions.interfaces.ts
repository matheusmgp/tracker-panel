export interface PositionData {
  id: number;
  vehicleId: number;
  companyId: number;
  sectorId: number | null;
  clientId: number | null;
  jsonData: {
    gps: string;
    mode: string;
    type: string;
    curse: string;
    speed: string;
    address: string;
    voltage: string;
    datetime: string;
    latitude: string;
    odometer: string;
    sectorId: number;
    hourmeter: string;
    longitude: string;
    messagenum: string;
    satellites: string;
    voltagebkp: string;
    messagetype: string;
    trackercode: number;
    trackerdata: {
      code: number;
      equipament: string;
    };
    vehiclecode: number;
    vehicledata: {
      id: number;
      board: string;
      color: string;
      chassis: string;
      renavam: string;
      modelYear: string;
      clientData: {
        companyid: number;
        clientcode: number;
        clientfantasy: string;
      };
      description: string;
      vehicleType: string;
    };
    inputsoutputs: string;
    localizationcode: string;
  };
  createdAt: string;
  updatedAt: string;
  quantity: number;
}

export interface ApiResponse {
  success: boolean;
  statusCode: number;
  data: {
    count: number;
    pages: number;
    current_page: number;
    list: PositionData[];
    quantity: number;
  };
  timestamp: string;
  method: string;
}
