// ===========================================================================
// BLOQUES REUTILIZABLES DEL BUILDER "Casa por casa / Nacional"
// Utiliza constantes dinámicas desde la base de datos para armar cada ítem.
// ===========================================================================

import { CotizacionItemBuild } from './casa-por-casa.builder';
import {
  DistribucionNacionalResult,
} from '@/modules/cotizaciones/engine/casa-por-casa/nacional.engine';

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

/**
 * Redondea a 2 decimales
 */
export const round2 = (v: number): number => Math.round(v * 100) / 100;

/**
 * Aplica el factor de comisión
 */
export function aplicarComision(
  costo: number,
  comisionable: boolean,
  fC: number,
  fNC: number,
): number {
  const factor = comisionable ? 1 + fC : 1 + fNC;
  return round2(costo * factor);
}

/**
 * Crea un ítem estándar a partir de valores simples
 */
export function buildItemSimple(opts: {
  category: string;
  description: string;
  personas: number;
  dias: number;
  costoUnitario: number;
  comisionable: boolean;
  orden: number;
  factorComisionable: number;
  factorNoComisionable: number;
}): CotizacionItemBuild {
  const costoTotal = round2(opts.personas * opts.dias * opts.costoUnitario);
  const totalConComision = aplicarComision(
    costoTotal,
    opts.comisionable,
    opts.factorComisionable,
    opts.factorNoComisionable,
  );

  return {
    category: opts.category,
    description: opts.description,
    personas: opts.personas,
    dias: opts.dias,
    costoUnitario: opts.costoUnitario,
    costoTotal,
    comisionable: opts.comisionable,
    totalConComision,
    orden: opts.orden,
  };
}

// ---------------------------------------------------------------------------
// TRABAJO DE CAMPO
// ---------------------------------------------------------------------------

export async function buildTrabajoCampoCasaPorCasaNacional(
  params: {
    supervisores: number;
    encuestadoresTotales: number;
    factorComisionable: number;
    factorNoComisionable: number;
    distribucion: DistribucionNacionalResult;
  },
  constantes: Record<string, number>,
): Promise<CotizacionItemBuild[]> {
  const {
    supervisores,
    encuestadoresTotales,
    factorComisionable,
    factorNoComisionable,
    distribucion,
  } = params;

  const totalPersonasCampo = supervisores + encuestadoresTotales;
  const diasCampo = round2(distribucion.totalDiasCampoEncuestGlobal ?? 0);

  const items: CotizacionItemBuild[] = [];

  items.push(
    buildItemSimple({
      category: 'TRABAJO DE CAMPO',
      description: 'Dirección Trabajo Campo',
      personas: 1,
      dias: diasCampo,
      costoUnitario: constantes['direccion campo'] ?? 50,
      comisionable: true,
      orden: 10,
      factorComisionable,
      factorNoComisionable,
    }),
  );

  items.push(
    buildItemSimple({
      category: 'TRABAJO DE CAMPO',
      description: 'Capacitación',
      personas: totalPersonasCampo,
      dias: 1,
      costoUnitario: constantes['capacitacion'] ?? 8,
      comisionable: true,
      orden: 11,
      factorComisionable,
      factorNoComisionable,
    }),
  );

  // Supervisor
  {
    const costoTotal = round2(distribucion.totalPagoSupervisoresGlobal ?? 0);
    const personas = supervisores;
    const dias = diasCampo;
    const costoUnitario =
      personas > 0 && dias > 0 ? round2(costoTotal / (personas * dias)) : 0;

    items.push({
      category: 'TRABAJO DE CAMPO',
      description: 'Supervisor',
      personas,
      dias,
      costoUnitario,
      costoTotal,
      comisionable: true,
      totalConComision: aplicarComision(
        costoTotal,
        true,
        factorComisionable,
        factorNoComisionable,
      ),
      orden: 12,
    });
  }

  items.push(
    buildItemSimple({
      category: 'TRABAJO DE CAMPO',
      description: 'Encuestadores',
      personas: encuestadoresTotales,
      dias: diasCampo,
      costoUnitario: constantes['encuestadores'] ?? 3.5,
      comisionable: true,
      orden: 13,
      factorComisionable,
      factorNoComisionable,
    }),
  );

  items.push(
    buildItemSimple({
      category: 'TRABAJO DE CAMPO',
      description: 'Pago de filtros',
      personas: 0,
      dias: 1,
      costoUnitario: constantes['pago filtros'] ?? 0.5,
      comisionable: true,
      orden: 14,
      factorComisionable,
      factorNoComisionable,
    }),
  );

  // Viáticos
  {
    const costoTotal = round2(distribucion.totalViaticosGlobal ?? 0);
    const personas = totalPersonasCampo;
    const dias = diasCampo;
    const unit =
      personas > 0 && dias > 0 ? round2(costoTotal / (personas * dias)) : 0;

    items.push({
      category: 'TRABAJO DE CAMPO',
      description: 'Viáticos',
      personas,
      dias,
      costoUnitario: unit,
      costoTotal,
      comisionable: true,
      totalConComision: aplicarComision(
        costoTotal,
        true,
        factorComisionable,
        factorNoComisionable,
      ),
      orden: 15,
    });
  }

  // Transporte
  {
    const costoTotal = round2(distribucion.totalTMicrobusGlobal ?? 0);
    const personas = totalPersonasCampo;
    const dias = diasCampo;
    const unit =
      personas > 0 && dias > 0 ? round2(costoTotal / (personas * dias)) : 0;

    items.push({
      category: 'TRABAJO DE CAMPO',
      description: 'Transporte',
      personas,
      dias,
      costoUnitario: unit,
      costoTotal,
      comisionable: true,
      totalConComision: aplicarComision(
        costoTotal,
        true,
        factorComisionable,
        factorNoComisionable,
      ),
      orden: 16,
    });
  }

  // Hotel
  {
    const costoTotal = round2(distribucion.totalHotelGlobal ?? 0);
    const personas = totalPersonasCampo;
    const dias = diasCampo;
    const unit =
      personas > 0 && dias > 0 ? round2(costoTotal / (personas * dias)) : 0;

    items.push({
      category: 'TRABAJO DE CAMPO',
      description: 'Hotel',
      personas,
      dias,
      costoUnitario: unit,
      costoTotal,
      comisionable: false,
      totalConComision: aplicarComision(
        costoTotal,
        false,
        factorComisionable,
        factorNoComisionable,
      ),
      orden: 17,
    });
  }

  return items;
}


// ---------------------------------------------------------------------------
// RECURSOS
// ---------------------------------------------------------------------------

export function buildRecursosCasaPorCasaNacional(
  params: {
    encuestadoresTotales: number;
    supervisores: number;
    factorComisionable: number;
    factorNoComisionable: number;
    incentivoTotal?: number;
  },
  constantes: Record<string, number>,
): CotizacionItemBuild[] {
  const {
    encuestadoresTotales,
    supervisores,
    factorComisionable,
    factorNoComisionable,
    incentivoTotal,
  } = params;

  const totalPersonas = encuestadoresTotales + supervisores;
  const dias = constantes['dias recursos'] ?? 15;

const entries = [
  { key: 'telefono unimeres', label: 'Teléfono (UNIMERES)', personas: 1, dias, comisionable: false, orden: 20 },
  { key: 'telefono campo', label: 'Teléfono celular (campo)', personas: totalPersonas, dias, comisionable: false, orden: 21 },
  { key: 'internet encuestadores', label: 'Internet a encuestadores', personas: encuestadoresTotales, dias, comisionable: false, orden: 22 },
  { key: 'usb', label: 'USB', personas: 1, dias: 1, comisionable: true, orden: 23 },
  { key: 'papel', label: 'Papel', personas: totalPersonas, dias: 1, comisionable: true, orden: 24 },
  { key: 'uso dispositivos', label: 'Uso de dispositivos', personas: totalPersonas, dias, comisionable: false, orden: 25 },
];


const items = entries.map((e) =>
  buildItemSimple({
    category: 'RECURSOS',
    description: e.label,
    personas: e.personas,
    dias: e.dias,
    costoUnitario: constantes[e.key] ?? 0,
    comisionable: e.comisionable,
    orden: e.orden,
    factorComisionable,
    factorNoComisionable,
  }),
);


  // Incentivo (si aplica)
  if (incentivoTotal && incentivoTotal > 0) {
    items.push({
      category: 'RECURSOS',
      description: 'Incentivo',
      personas: null,
      dias: null,
      costoUnitario: null,
      costoTotal: round2(incentivoTotal),
      comisionable: true,
      totalConComision: aplicarComision(
        incentivoTotal,
        true,
        factorComisionable,
        factorNoComisionable,
      ),
      orden: 26,
    });
  }

  return items;
}

// ---------------------------------------------------------------------------
// DIRECCIÓN
// ---------------------------------------------------------------------------

export function buildRealizacionCuestionario(params: {
  factorComisionable: number;
  factorNoComisionable: number;
}): CotizacionItemBuild {
  const costo = 65;
  return {
    category: 'DIRECCIÓN',
    description: 'Realización Cuestionario',
    personas: 1,
    dias: 1,
    costoUnitario: costo,
    costoTotal: costo,
    comisionable: true,
    totalConComision: aplicarComision(
      costo,
      true,
      params.factorComisionable,
      params.factorNoComisionable,
    ),
    orden: 32,
  };
}

export function buildSupervisorScript(params: {
  factorComisionable: number;
  factorNoComisionable: number;
}): CotizacionItemBuild {
  const costo = 28;
  return {
    category: 'DIRECCIÓN',
    description: 'Supervisor Script',
    personas: 1,
    dias: 1,
    costoUnitario: costo,
    costoTotal: costo,
    comisionable: true,
    totalConComision: aplicarComision(
      costo,
      true,
      params.factorComisionable,
      params.factorNoComisionable,
    ),
    orden: 34,
  };
}

export function buildReporteResultados(params: {
  factorComisionable: number;
  factorNoComisionable: number;
}): CotizacionItemBuild {
  const costo = 340;
  return {
    category: 'DIRECCIÓN',
    description: 'Reporte de Resultados',
    personas: 1,
    dias: 1,
    costoUnitario: costo,
    costoTotal: costo,
    comisionable: true,
    totalConComision: aplicarComision(
      costo,
      true,
      params.factorComisionable,
      params.factorNoComisionable,
    ),
    orden: 35,
  };
}

export function buildInformeBi(params: {
  numeroOlasBi: number;
  factorComisionable: number;
  factorNoComisionable: number;
}): CotizacionItemBuild {
  const costoUnitario = 473.33;
  const costo = round2(costoUnitario * params.numeroOlasBi);

  return {
    category: 'DIRECCIÓN',
    description: 'Informe BI',
    personas: 1,
    dias: params.numeroOlasBi,
    costoUnitario,
    costoTotal: costo,
    comisionable: true,
    totalConComision: aplicarComision(
      costo,
      true,
      params.factorComisionable,
      params.factorNoComisionable,
    ),
    orden: 36,
  };
}

// ---------------------------------------------------------------------------
// PROCESAMIENTO
// ---------------------------------------------------------------------------

export function buildCodificacionProcesamiento(params: {
  factorComisionable: number;
  factorNoComisionable: number;
}): CotizacionItemBuild {
  const costo = 300;
  return {
    category: 'PROCESAMIENTO',
    description: 'Codificación',
    personas: 1,
    dias: 1,
    costoUnitario: costo,
    costoTotal: costo,
    comisionable: true,
    totalConComision: aplicarComision(
      costo,
      true,
      params.factorComisionable,
      params.factorNoComisionable,
    ),
    orden: 50,
  };
}

export function buildControlCalidadProcesamiento(params: {
  factorComisionable: number;
  factorNoComisionable: number;
}): CotizacionItemBuild {
  const costo = 500;
  return {
    category: 'PROCESAMIENTO',
    description: 'Control de Calidad',
    personas: 1,
    dias: 1,
    costoUnitario: costo,
    costoTotal: costo,
    comisionable: true,
    totalConComision: aplicarComision(
      costo,
      true,
      params.factorComisionable,
      params.factorNoComisionable,
    ),
    orden: 51,
  };
}

export function buildBaseLimpiezaProcesamiento(params: {
  factorComisionable: number;
  factorNoComisionable: number;
}): CotizacionItemBuild {
  const costo = 66.67;
  return {
    category: 'PROCESAMIENTO',
    description: 'Base + Limpieza (digital)',
    personas: 1,
    dias: 1,
    costoUnitario: costo,
    costoTotal: costo,
    comisionable: true,
    totalConComision: aplicarComision(
      costo,
      true,
      params.factorComisionable,
      params.factorNoComisionable,
    ),
    orden: 52,
  };
}
