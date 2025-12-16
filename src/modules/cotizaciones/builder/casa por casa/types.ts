export type BuildCasaPorCasaInput = {
  totalEntrevistas: number;
  duracionCuestionarioMin: number;
  tipoEntrevista: string;
  penetracionCategoria: number; // 0..1
  cobertura: string;
  supervisores: number;
  encuestadoresTotales: number;
  realizamosCuestionario: boolean;
  realizamosScript: boolean;
  clienteSolicitaReporte: boolean;
  clienteSolicitaInformeBI: boolean;
  numeroOlasBi: number;
  clienteSolicitaTablas: boolean;
  trabajoDeCampoRealiza: boolean;
  trabajoDeCampoTipo?: 'propio' | 'subcontratado';
  trabajoDeCampoCosto?: number;
};

export type BuildCasaPorCasaResult = {
  items: Array<{
    category: string;
    description: string;
    personas: any;
    dias: any;
    costoUnitario: any;
    costoTotal: any;
    comisionable: boolean;
    totalConComision: any;
    orden: number;
  }>;
  totalCobrar: number;
  costoPorEntrevista: number;
};
