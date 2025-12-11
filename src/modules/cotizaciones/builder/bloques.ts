// ===========================================================================
// BLOQUES REUTILIZABLES DEL BUILDER "Casa por casa / Nacional"
// Utiliza constantes dinámicas desde la base de datos para armar cada ítem.
// ===========================================================================

import { CotizacionItemBuild } from './casa-por-casa.builder';
import { DistribucionNacionalResult } from '@/modules/cotizaciones/engine/casa-por-casa/nacional.engine';

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

/**
 * Devuelve el primer costo que encuentre entre varias posibles claves.
 * Evita que el unitario salga 0 cuando la clave en DB tiene
 * mayúsculas/minúsculas/acentos distintos.
 */
function getCosto(
  constantes: Record<string, number>,
  posiblesClaves: string[],
  fallback = 0,
): number {
  for (const k of posiblesClaves) {
    const v = constantes[k];
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
  }
  return fallback;
}

/** Redondea a 2 decimales */
export const round2 = (v: number): number => Math.round(v * 100) / 100;

/** Aplica el factor de comisión */
export function aplicarComision(
  costo: number,
  comisionable: boolean,
  fC: number,
  fNC: number,
): number {
  const factor = comisionable ? 1 + fC : 1 + fNC;
  return round2(costo * factor);
}

/** Ítem estándar: costoTotal = personas * días * unitario */
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

/**
 * Ítem cuyo total no es personas*días*unit (ej. Plataforma STG).
 * Permite pasar costoTotal directamente.
 */
export function buildItemConTotal(opts: {
  category: string;
  description: string;
  personas: number | null;
  dias: number | null;
  costoUnitario: number | null;
  costoTotal: number;
  comisionable: boolean;
  orden: number;
  factorComisionable: number;
  factorNoComisionable: number;
}): CotizacionItemBuild {
  const costoTotal = round2(opts.costoTotal);
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

  // 🗓️ Días desde el engine (ya viene con ceil para cuadrar con Excel)
  const diasCampo = round2(distribucion.totalDiasCampoEncuestGlobal ?? 0);

  const items: CotizacionItemBuild[] = [];

  // Dirección Trabajo Campo
  items.push(
    buildItemSimple({
      category: 'TRABAJO DE CAMPO',
      description: 'Dirección Trabajo Campo',
      personas: 1,
      dias: diasCampo,
      costoUnitario: getCosto(
        constantes,
        [
          'Trabajo de Campo.Dirección Trabajo Campo',
          'Dirección.Dirección Trabajo Campo',
          'direccion campo',
        ],
        50,
      ),
      comisionable: true,
      orden: 10,
      factorComisionable,
      factorNoComisionable,
    }),
  );

  // Capacitación
  items.push(
    buildItemSimple({
      category: 'TRABAJO DE CAMPO',
      description: 'Capacitación',
      personas: totalPersonasCampo,
      dias: 1,
      costoUnitario: getCosto(
        constantes,
        ['Trabajo de Campo.Capacitación', 'Capacitación', 'capacitacion'],
        8,
      ),
      comisionable: true,
      orden: 11,
      factorComisionable,
      factorNoComisionable,
    }),
  );

  // Supervisor (prorrateado desde el total del engine)
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

  // ✅ Encuestadores (PRORRATEADO)
  //   unitario = totalPagoEncuestadoresGlobal / (encuestadoresTotales * diasCampo)
  //   En tu ejemplo: 1575 / (30 * 14) = 3.75
  {
    const costoTotal = round2(distribucion.totalPagoEncuestadoresGlobal ?? 0);
    const personas = encuestadoresTotales;
    const dias = diasCampo;
    const costoUnitario =
      personas > 0 && dias > 0 ? round2(costoTotal / (personas * dias)) : 0;

    items.push({
      category: 'TRABAJO DE CAMPO',
      description: 'Encuestadores',
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
      orden: 13,
    });
  }

  // Pago de filtros
  items.push(
    buildItemSimple({
      category: 'TRABAJO DE CAMPO',
      description: 'Pago de filtros',
      personas: 0,
      dias: 1,
      costoUnitario: getCosto(
        constantes,
        ['Trabajo de Campo.Pago filtros', 'Pago filtros', 'pago filtros'],
        0.5,
      ),
      comisionable: true,
      orden: 14,
      factorComisionable,
      factorNoComisionable,
    }),
  );

  // Viáticos (prorrateado desde el total del engine)
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

  // Transporte (prorrateado)
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

  // Hotel (prorrateado; no comisionable)
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
    distribucion: DistribucionNacionalResult; // días desde el engine (W14)
    tipoEntrevista?: string; // para decidir plataformas por canal
  },
  constantes: Record<string, number>,
): CotizacionItemBuild[] {
  const {
    encuestadoresTotales,
    supervisores,
    factorComisionable,
    factorNoComisionable,
    incentivoTotal,
    distribucion,
    tipoEntrevista,
  } = params;

  const totalPersonas = encuestadoresTotales + supervisores;
  // Días totales desde el engine (fila TOTAL W14)
  const dias = Math.max(0, Number(distribucion.totalDiasCampoEncuestGlobal ?? 0));
  const totalEntrevistasAjustado = distribucion.totalEntrevistasAjustado ?? 0;
  const totalEntrevistasBase = distribucion.totalEntrevistasBase ?? 0;

  const items: CotizacionItemBuild[] = [];

  // Ítems estándar por día
  const comunes = [
    {
      keys: ['Recursos.Teléfono (UNIMERES)'],
      label: 'Teléfono (UNIMERES)',
      personas: 1,
      dias,
      comisionable: false,
      orden: 20,
    },
    {
      keys: ['Recursos.Teléfono celular (campo)'],
      label: 'Teléfono celular (campo)',
      personas: totalPersonas,
      dias,
      comisionable: false,
      orden: 21,
    },
    {
      keys: ['Recursos.Internet a encuestadores'],
      label: 'Internet a encuestadores',
      personas: encuestadoresTotales,
      dias,
      comisionable: false,
      orden: 22,
    },
    {
      keys: ['Recursos.USB'],
      label: 'USB',
      personas: 1,
      dias: 1,
      comisionable: true,
      orden: 23,
    },
    {
      keys: ['Recursos.Papel'],
      label: 'Papel',
      personas: totalPersonas,
      dias: 1,
      comisionable: true,
      orden: 24,
    },
    {
      keys: ['Recursos.Uso de dispositivos'],
      label: 'Uso de dispositivos',
      personas: totalPersonas,
      dias,
      comisionable: false,
      orden: 25,
    },
  ] as const;

  for (const e of comunes) {
    const unit = getCosto(constantes, e.keys as unknown as string[], 0);
    items.push(
      buildItemSimple({
        category: 'RECURSOS',
        description: e.label,
        personas: e.personas,
        dias: e.dias as number,
        costoUnitario: unit,
        comisionable: e.comisionable,
        orden: e.orden,
        factorComisionable,
        factorNoComisionable,
      }),
    );
  }

  // --- Plataformas por canal ---
  const esCallCenter = (tipoEntrevista ?? '').toLowerCase().includes('call');
  const esOnline = (tipoEntrevista ?? '').toLowerCase().includes('online');

  // Plataforma de Captura STG (CPC → costo por entrevista)
  {
    const unit = getCosto(constantes, ['Recursos.Plataforma de Captura STG'], 0);
    const total = round2(totalEntrevistasAjustado * unit);
    items.push(
      buildItemConTotal({
        category: 'RECURSOS',
        description: 'Plataforma de Captura STG',
        personas: totalEntrevistasAjustado,
        // En Excel muestran 0.00; dejamos 0 para reflejarlo
        dias: 0,
        costoUnitario: unit,
        costoTotal: total,
        comisionable: false,
        orden: 26,
        factorComisionable,
        factorNoComisionable,
      }),
    );
  }

  // Plataforma Call Center (solo si aplica el canal)
  {
    const unitPlataforma = esCallCenter
      ? getCosto(constantes, ['Recursos.Plataforma Call Center'], 0)
      : 0;
    const totalPlataforma = round2(totalEntrevistasAjustado * unitPlataforma * 1); // 1 día

    items.push(
      buildItemConTotal({
        category: 'RECURSOS',
        description: 'Plataforma Call Center',
        personas: totalEntrevistasAjustado,
        dias: 1,
        costoUnitario: unitPlataforma,
        costoTotal: totalPlataforma,
        comisionable: false,
        orden: 27,
        factorComisionable,
        factorNoComisionable,
      }),
    );
  }

  // Teléfono Call Center (solo si aplica el canal; Excel usa 18 días)
  {
    const unitTelefono = esCallCenter
      ? getCosto(constantes, ['Recursos.Telefono Call Center', 'Recursos.Teléfono Call Center'], 0)
      : 0;
    const totalTelefono = round2(totalEntrevistasAjustado * unitTelefono * 18);

    items.push(
      buildItemConTotal({
        category: 'RECURSOS',
        description: 'Telefono Call Center',
        personas: totalEntrevistasAjustado,
        dias: 18,
        costoUnitario: unitTelefono,
        costoTotal: totalTelefono,
        comisionable: true, // en tu Excel aparece Sí
        orden: 28,
        factorComisionable,
        factorNoComisionable,
      }),
    );
  }

  // Plataforma Online (solo si aplica)
  {
    const unitPlataformaOnline = esOnline
      ? getCosto(constantes, ['Recursos.Plataforma Online'], 0)
      : 0;
    const totalPlataformaOnline = round2(1 * unitPlataformaOnline); // 1 día, 1 persona simbólica

    items.push(
      buildItemConTotal({
        category: 'RECURSOS',
        description: 'Plataforma Online',
        personas: 1,
        dias: 1,
        costoUnitario: unitPlataformaOnline,
        costoTotal: totalPlataformaOnline,
        comisionable: false,
        orden: 29,
        factorComisionable,
        factorNoComisionable,
      }),
    );
  }

  // Pauta Online (solo si aplica; usa base)
  {
    const unitPauta = esOnline ? getCosto(constantes, ['Recursos.Pauta Online'], 0) : 0;
    const totalPauta = round2(totalEntrevistasBase * unitPauta * 1);

    items.push(
      buildItemConTotal({
        category: 'RECURSOS',
        description: 'Pauta Online',
        personas: totalEntrevistasBase,
        dias: 1,
        costoUnitario: unitPauta,
        costoTotal: totalPauta,
        comisionable: false,
        orden: 30,
        factorComisionable,
        factorNoComisionable,
      }),
    );
  }

  // Incentivo (si aplica)
  if (incentivoTotal && incentivoTotal > 0) {
    items.push(
      buildItemConTotal({
        category: 'RECURSOS',
        description: 'Incentivo',
        personas: totalEntrevistasBase,
        dias: 1,
        costoUnitario: null,
        costoTotal: round2(incentivoTotal),
        comisionable: true,
        orden: 31,
        factorComisionable,
        factorNoComisionable,
      }),
    );
  }

  return items;
}

// ---------------------------------------------------------------------------
// DIRECCIÓN
// ---------------------------------------------------------------------------

// ... helpers getCosto, round2 siguen igual

/**
 * Días director (en realidad son HORAS totales mostradas en la columna "días"):
 *  - horasFijas = 4  (AC122)
 *  - horasPorDia = 2 (constante)  → AC123 = horasPorDia * diasCampo (W14 TOTAL)
 *  - horasTotales = AC122 + AC123
 *  - costoTotal (AF124) = horasTotales * tarifaHoraDirector
 *  - totalConComision (Excel) = AF124 / margenBase (0.4)
 *
 * Claves esperadas en `constantes` (con fallbacks):
 *  - "Dirección.Horas fijas director"          → default 4
 *  - "Dirección.Horas por día director"        → default 2
 *  - "Dirección.Tarifa hora director"          → default 10
 *  - "Dirección.Margen base director"          → default 0.4
 */
export function buildDiasDirector(
  params: {
    factorComisionable: number;     // NO se usa para este renglón (se respeta regla Excel)
    factorNoComisionable: number;   // NO se usa para este renglón
    distribucion: DistribucionNacionalResult; // para leer W14 TOTAL
  },
  constantes: Record<string, number>,
): CotizacionItemBuild {
  const diasCampo = Number(params.distribucion.totalDiasCampoEncuestGlobal ?? 0); // W14 TOTAL

  const horasFijas = getCosto(constantes, ['Dirección.Horas fijas director'], 4);           // AC122
  const horasPorDia = getCosto(constantes, ['Dirección.Horas por día director'], 2);       // factor de AC123
  const tarifaHora  = getCosto(constantes, ['Dirección.Tarifa hora director'], 10);        // $/hora
  const margenBase  = getCosto(constantes, ['Dirección.Margen base director'], 0.4);       // divisor para gross-up

  // AC123 = 2 * W28   → aquí W28 = diasCampo
  const ac123 = horasPorDia * diasCampo;

  // Horas totales (las mostramos en la columna "días" tal cual hace el Excel)
  const horasTotales = horasFijas + ac123;

  // AF124 = horasTotales * tarifaHoraDirector
  const costoTotal = round2(horasTotales * tarifaHora);

  // Total con comisión = AF124 / 0.4 (regla Excel para este renglón)
  const totalConComision = margenBase > 0 ? round2(costoTotal / margenBase) : costoTotal;

  return {
    category: 'DIRECCIÓN',
    description: 'Días director',
    personas: 1,
    dias: horasTotales,        // ⚠️ en Excel muestran 32 aquí (son horas, no días-calendario)
    costoUnitario: tarifaHora, // muestran “–” en Excel, pero guardamos la tarifa para trazabilidad
    costoTotal,                // AF124 (ej: 32 * 10 = 320)
    comisionable: true,
    totalConComision,          // ej: 320 / 0.4 = 800
    orden: 31,
  };
}


export function buildRealizacionCuestionario(
  params: { factorComisionable: number; factorNoComisionable: number },
  constantes?: Record<string, number>,
): CotizacionItemBuild {
  const unit = constantes
    ? getCosto(constantes, ['Dirección.Realización Cuestionario'], 65)
    : 65;

  return {
    category: 'DIRECCIÓN',
    description: 'Realización Cuestionario',
    personas: 1,
    dias: 1,
    costoUnitario: unit,
    costoTotal: unit,
    comisionable: true,
    totalConComision: aplicarComision(
      unit,
      true,
      params.factorComisionable,
      params.factorNoComisionable,
    ),
    orden: 32,
  };
}

export function buildSupervisorScript(
  params: { factorComisionable: number; factorNoComisionable: number },
  constantes?: Record<string, number>,
): CotizacionItemBuild {
  const unit = constantes
    ? getCosto(constantes, ['Dirección.Supervisor'], 28)
    : 28;

  return {
    category: 'DIRECCIÓN',
    description: 'Supervisor Script',
    personas: 1,
    dias: 1,
    costoUnitario: unit,
    costoTotal: unit,
    comisionable: true,
    totalConComision: aplicarComision(
      unit,
      true,
      params.factorComisionable,
      params.factorNoComisionable,
    ),
    orden: 34,
  };
}

export function buildReporteResultados(
  params: { factorComisionable: number; factorNoComisionable: number },
  constantes?: Record<string, number>,
): CotizacionItemBuild {
  const unit = constantes
    ? getCosto(constantes, ['Dirección.Reporte de Resultados'], 340)
    : 340;

  return {
    category: 'DIRECCIÓN',
    description: 'Reporte de Resultados',
    personas: 1,
    dias: 1,
    costoUnitario: unit,
    costoTotal: unit,
    comisionable: true,
    totalConComision: aplicarComision(
      unit,
      true,
      params.factorComisionable,
      params.factorNoComisionable,
    ),
    orden: 35,
  };
}

export function buildInformeBi(
  params: {
    numeroOlasBi: number;
    factorComisionable: number;
    factorNoComisionable: number;
  },
  _constantes?: Record<string, number>,
): CotizacionItemBuild {
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
