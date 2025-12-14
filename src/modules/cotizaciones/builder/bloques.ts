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

/** Factor base “comisionable” del Excel (p. ej. 0.4) para dividir */
function getBaseComisionable(constantes: Record<string, number>, fallback = 0.4) {
  return getCosto(constantes, ['General.Base comisionable', 'General.Factor base comisionable'], fallback);
}

/** Precio por hora de dirección (para Días director y Realización de cuestionario) */
function getPrecioHoraDireccion(constantes: Record<string, number>, fallback = 10) {
  return getCosto(constantes, ['Dirección.Precio por hora director', 'Dirección.Precio hora dirección'], fallback);
}

function getPreguntasPorMin(constantes: Record<string, number>, fallback = 4) {
  return getCosto(constantes, ['Procesamiento.Preguntas por minuto', 'General.Preguntas por minuto'], fallback);
}
function getPrecioHoraProc(constantes: Record<string, number>, fallback = 10) {
  return getCosto(constantes, ['Procesamiento.Precio por hora', 'Dirección.Precio por hora', 'precio por hora'], fallback);
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
  const esOnline     = (tipoEntrevista ?? '').toLowerCase().includes('online');

  // Plataforma de Captura STG (CPC → costo por entrevista)
  {
    const unit = getCosto(constantes, ['Recursos.Plataforma de Captura STG'], 0);
    const total = round2(totalEntrevistasAjustado * unit);
    // La dejamos solo si tiene costo (>0). Si la quieres siempre, elimina el if.
    if (total > 0) {
      items.push(
        buildItemConTotal({
          category: 'RECURSOS',
          description: 'Plataforma de Captura STG',
          personas: totalEntrevistasAjustado,
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
  }

  // ===== Plataforma Call Center y Teléfono (solo si canal Call Center y total > 0) =====
  if (esCallCenter) {
    const unitPlataforma = getCosto(constantes, ['Recursos.Plataforma Call Center'], 0);
    const totalPlataforma = round2(totalEntrevistasAjustado * unitPlataforma * 1); // 1 día
    if (totalPlataforma > 0) {
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

    const unitTelefono = getCosto(constantes, ['Recursos.Telefono Call Center', 'Recursos.Teléfono Call Center'], 0);
    const totalTelefono = round2(totalEntrevistasAjustado * unitTelefono * 18);
    if (totalTelefono > 0) {
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
  }

  // ===== Plataforma Online y Pauta (solo si canal Online y total > 0) =====
  if (esOnline) {
    const unitPlataformaOnline = getCosto(constantes, ['Recursos.Plataforma Online'], 0);
    const totalPlataformaOnline = round2(1 * unitPlataformaOnline); // 1 día, 1 persona simbólica
    if (totalPlataformaOnline > 0) {
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

    const unitPauta = getCosto(constantes, ['Recursos.Pauta Online'], 0);
    const totalPauta = round2(totalEntrevistasBase * unitPauta * 1);
    if (totalPauta > 0) {
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


/**
 * Realización de cuestionario.
 * Replica la tablita del Excel:
 *  - investigación (min) = 90
 *  - tiempo por pregunta (min) = preguntas * 5
 *  - precio por hora dirección = 10 (desde constantes)
 *  - total = horasTotales * precioHora
 *  - total comisionado = total / 0.4
 */
export function buildRealizacionCuestionario(
  params: { factorComisionable: number; factorNoComisionable: number; duracionCuestionarioMin: number },
  constantes?: Record<string, number>,
): CotizacionItemBuild {
  const pregPorMin   = getCosto(constantes ?? {}, ['Dirección.Parámetro preguntas por minuto'], 4); // B26
  const preguntas    = params.duracionCuestionarioMin * pregPorMin; // B27 = B25 * B26

  const investigacionMin = getCosto(constantes ?? {}, ['Dirección.Investigación (min)'], 90); // 90
  const minPorPregunta   = getCosto(constantes ?? {}, ['Dirección.Minutos por pregunta'], 5); // 5
  const precioHora       = getCosto(constantes ?? {}, ['Dirección.Precio por hora director'], 10);
  const baseCom          = getCosto(constantes ?? {}, ['General.Base comisionable'], 0.4);

  const totalMin   = investigacionMin + preguntas * minPorPregunta; // E73+E74
  const horas      = totalMin / 60;
  const costoBase  = round2(horas * precioHora);       // 48.33 para 10 min
  const conCom     = round2(costoBase / baseCom);      // 120.83

  return {
    category: 'DIRECCIÓN',
    description: 'Realización Cuestionario',
    personas: 1,
    dias: 1,
    costoUnitario: precioHora,
    costoTotal: costoBase,
    comisionable: true,
    totalConComision: conCom,
    orden: 32,
  };
}



/**
 * SUPERVISOR SCRIPT  (Sheet1 (2) F39)
 * Base = (minTotales/60) * precioHoraSupervisor
 * Total con comisión = Base / 0.4
 *
 * Constantes que puedes configurar en DB:
 */
export function buildSupervisorScript(
  params: { factorComisionable: number; factorNoComisionable: number; duracionCuestionarioMin: number },
  constantes?: Record<string, number>,
): CotizacionItemBuild {
  const durMin     = params.duracionCuestionarioMin; // B25
  const pregPorMin = getCosto(constantes ?? {}, ['Dirección.Parámetro preguntas por minuto'], 4); // B26
  const preguntas  = durMin * pregPorMin; // B27

  // Minutos por rubro
  const minEntender = durMin * 2; // D33 (NO se incluye en precio)
  const minProg     = 1 * preguntas; // D34
  const minReglas   = 1 * preguntas; // D35
  const minPrueba   = durMin * 2;    // D36
  const minCambios  = getCosto(constantes ?? {}, ['Dirección.Min cambios'], 60); // D37 = 60

  // Lo que se PRECIA en F39 es SUM(F34:F38): excluye D33
  const totalMin = minProg + minReglas + minPrueba + minCambios; // 40+40+20+60=160 para 10min
  const horas    = totalMin / 60;

  const precioHora = getCosto(constantes ?? {}, ['Dirección.Precio hora supervisor'], 8);
  const baseCom    = getCosto(constantes ?? {}, ['General.Base comisionable'], 0.4);

  const base   = round2(horas * precioHora); // 2.6667*8 = 21.33
  const conCom = round2(base / baseCom);     // 53.33

  return {
    category: 'DIRECCIÓN',
    description: 'Supervisor Script',
    personas: 1,
    dias: 1,
    costoUnitario: null,
    costoTotal: base,
    comisionable: true,
    totalConComision: conCom,
    orden: 34,
  };
}



// ...imports y helpers iguales...

export function buildReporteResultados(
  _params: { factorComisionable: number; factorNoComisionable: number },
  constantes?: Record<string, number>,
  extras?: { duracionCuestionarioMin?: number },
): CotizacionItemBuild {
  // Parámetros base
  const duracion = Number(extras?.duracionCuestionarioMin ?? 10);
  const ppm = constantes
    ? getCosto(constantes, ['Dirección.Parametro preguntas por minuto', 'Dirección.Preguntas por minuto', 'General.Preguntas por minuto'], 4)
    : 4;
  const precioHora = getPrecioHoraDireccion(constantes ?? {}, 10);
  const baseComisionable = getBaseComisionable(constantes ?? {}, 0.4);

  // Preguntas = duración * ppm
  const preguntas = duracion * ppm;

  // --- Minutos por rubro (SIN "Procesamiento") ---
  const disenoMin       = 180;                         // 3 h fijas
  const graficasMin     = 60 * (preguntas / 4);        // 60 * (#preg/4)
  const revisionMin     = 10 * (preguntas / 4);        // 10 * (#preg/4)
  const presentacionMin = 120;                         // 2 h fijas
  const ajustesMin      = 300;                         // 5 h fijas

  // Totales
  const totalMin  = disenoMin + graficasMin + revisionMin + presentacionMin + ajustesMin;
  const totalHrs  = totalMin / 60;
  const costoBase = round2(totalHrs * precioHora);     // 216.67 con 10min y ppm=4
  const conCom    = round2(costoBase / baseComisionable); // 541.67

  return {
    category: 'DIRECCIÓN',
    description: 'Reporte de Resultados',
    personas: 1,
    dias: 1,
    costoUnitario: null,
    costoTotal: costoBase,       // 216.67
    comisionable: true,
    totalConComision: conCom,    // 541.67
    orden: 35,
  };
}

/**
 * PROCESAMIENTO → Tablas (opcional)
 * Fórmulas (tu Excel):
 *   preguntas        = duracion * 4
 *   min              = 5 * preguntas
 *   horas            = min / 60
 *   costoBase        = horas * precioHoraTablas
 *   totalConComision = costoBase / 0.4
 *
 * precioHoraTablas: se toma de constantes (recomendado):
 *   'Procesamiento.Tablas precio por hora'
 * fallback: 10 (mismo precio por hora).
 */
export function buildTablasProcesamiento(
  params: {
    duracionCuestionarioMin: number;
    factorComisionable: number;
    factorNoComisionable: number;
  },
  constantes?: Record<string, number>,
): CotizacionItemBuild {
  const C = constantes ?? {};
  const dur = Number(params.duracionCuestionarioMin || 0);
  const pregPorMin = getPreguntasPorMin(C, 4);
  const baseCom    = getBaseComisionable(C, 0.4);

  // precio/hora específico para Tablas (o usa los generales si no existe)
  const precioHoraTablas =
    getCosto(C, ['Procesamiento.Tablas precio por hora', 'Procesamiento.Precio por hora', 'Dirección.Precio por hora director'], 10);

  const preguntas = dur * pregPorMin;      // 40 (con 10min y 4 ppm)
  const minutos   = 5 * preguntas;         // 200
  const horas     = minutos / 60;          // 3.333333
  const base      = round2(horas * precioHoraTablas);   // 33.33 si $/h=10
  const conCom    = round2(base / baseCom);             // 83.33

  return {
    category: 'PROCESAMIENTO',
    description: 'Tablas',
    personas: 1,
    dias: 0,                 // 0.00 como en tu tabla
    costoUnitario: precioHoraTablas,
    costoTotal: base,        // 33.33
    comisionable: true,
    totalConComision: conCom,// 83.33
    orden: 53,               // detrás de Base+Limpieza si quieres
  };
}



export function buildInformeBi(
  params: {
    numeroOlasBi: number;
    factorComisionable: number;
    factorNoComisionable: number;
    duracionCuestionarioMin?: number; // ← lo pasaremos desde el builder
  },
  constantes?: Record<string, number>,
): CotizacionItemBuild {
  const get = (k: string[], f = 0) => getCosto(constantes ?? {}, k, f);

  // Parámetros
  const duracion  = (params.duracionCuestionarioMin ?? get(['Dirección.Duración de cuestionario', 'General.Duración cuestionario'], 10));
  const pregMin   = get(['Dirección.Preguntas por minuto', 'General.Preguntas por minuto'], 4);
  const precioHora= get(['Dirección.Precio por hora dirección', 'Dirección.Precio hora dirección'], 10);
  const baseCom   = get(['General.Base comisionable'], 0.4);

  const preguntas = duracion * pregMin;

  // --- Minutos por rubro (igual que tu Excel BI) ---
  const softwareFijoUSD          = get(['Dirección.BI.Software y alojamiento'], 100);  // $100 fijo

  const disenoMin                 = 6 * 60;                     // 360
  const adecuacionMin             = 5 * preguntas;              // 5 * #preguntas  → 200 si #preg=40
  const identificacionSegMin      = 30;                         // 30 fijo
  // D84 = 1.5 * preguntas; en la hoja BI usas 60 * 15 = 900   => 15 = (1.5 * preguntas) / 4
  const d84                       = preguntas + preguntas / 2;  // 1.5 * preguntas
  const graficasMin               = 60 * (d84 / 4);             // 60 * 15 = 900 cuando preguntas=40
  const revisionDatosMin          = 15 * 10;                    // 10 * (d84/4) → con preguntas=40: 10*15=150
  const revisionPreliminarMin     = 2 * 60;                     // 120
  const presentacionMin           = 2 * 60;                     // 120
  const ajustesMin                = 6 * 60;                     // 360 (tu hoja BI los deja fijos en 6 h)

  const totalMin =
    disenoMin +
    adecuacionMin +
    identificacionSegMin +
    graficasMin +
    revisionDatosMin +
    revisionPreliminarMin +
    presentacionMin +
    ajustesMin;

  const horas = totalMin / 60;                                  // 2240/60 = 37.3333
  const costoBase = round2(softwareFijoUSD + horas * precioHora); // 100 + 37.3333*10 = 473.33
  const totalConComision = round2(costoBase / baseCom);           // 1183.33

  return {
    category: 'DIRECCIÓN',
    description: 'Informe BI',
    personas: 1,
    dias: params.numeroOlasBi,      // en la tabla muestras #olas, pero el costo base no se multiplica
    costoUnitario: precioHora,
    costoTotal: costoBase,          // 473.33
    comisionable: true,
    totalConComision,               // 1183.33
    orden: 36,
  };
}

// ---------------------------------------------------------------------------
// PROCESAMIENTO
// ---------------------------------------------------------------------------

// Helpers ya existen arriba: getCosto, getBaseComisionable, round2, aplicarComision

export function buildCodificacionProcesamiento(
  params: {
    totalEntrevistas: number;
    duracionCuestionarioMin: number;
    factorComisionable: number;
    factorNoComisionable: number;
  },
  constantes?: Record<string, number>,
): CotizacionItemBuild {
  const totalEntrevistas = params.totalEntrevistas;
  const durMin = params.duracionCuestionarioMin;

  // Excel: Param preguntas/min (default 4)
  const pregPorMin = constantes
    ? getCosto(constantes, [
        'General.Parametro preguntas por minuto',
        'Dirección.Parametro de preguntas por minuto',
      ], 4)
    : 4;

  // Excel: base comisionable (0.4)
  const baseComisionable = constantes
    ? getBaseComisionable(constantes, 0.4)
    : 0.4;

  // Excel: tasa 0.02 (puedes moverla a constantes si quieres)
  const tasaCodif = constantes
    ? getCosto(constantes, ['Procesamiento.Tasa codificación'], 0.02)
    : 0.02;

  // ---- Fórmulas Excel ----
  const preguntas = durMin * pregPorMin;        // B84 = duración * 4
  const c104 = preguntas * 0.1;                 // C104 = preguntas * 0.1
  const costoTotal = round2(
    c104 * totalEntrevistas * (tasaCodif / baseComisionable)
  );                                            // = 200 con 10min, 1000 ent
  const totalConComision = round2(costoTotal / baseComisionable); // = 500

  // En tu tabla el "unitario" muestra 14.40; no afecta totales.
  // Dejamos dias=0 y costoUnitario opcional (puedes calcularlo como decoración).
  return {
    category: 'PROCESAMIENTO',
    description: 'Codificación',
    personas: 1,
    dias: 0,                      // 0.00 como en Excel
    costoUnitario: null,          // puedes poner 14.40 si lo quieres “decorativo”
    costoTotal,                   // 200.00
    comisionable: true,
    totalConComision,             // 500.00
    orden: 50,
  };
}


export function buildControlCalidadProcesamiento(
  params: {
    totalEntrevistas: number;
    duracionCuestionarioMin: number;
    factorComisionable: number;
    factorNoComisionable: number;
  },
  constantes?: Record<string, number>,
): CotizacionItemBuild {
  const totalEntrevistas = params.totalEntrevistas;
  const durMin = params.duracionCuestionarioMin;

  // Minutos totales a escuchar (se muestran en la columna "días")
  const minutos = totalEntrevistas * durMin;             // ej. 1000 * 10 = 10000
  const horas   = minutos / 60;                          // 166.6667

  // Precio por hora para CC (desde constantes; default = 2)
  const precioHora = constantes
    ? getCosto(constantes, [
        'Procesamiento.Precio hora CC',
        'Procesamiento.Precio hora',
        'Dirección.Precio por hora CC',
      ], 2)
    : 2;

  // Base comisionable (margen Excel)
  const baseComisionable = constantes
    ? getBaseComisionable(constantes, 0.4)
    : 0.4;

  const costoBase = round2(horas * precioHora);          // 333.33
  const totalConComision = round2(costoBase / baseComisionable); // 833.33

  return {
    category: 'PROCESAMIENTO',
    description: 'Control de Calidad',
    personas: 1,
    dias: minutos,             // ⬅️ 10000, igual a tu Excel
    costoUnitario: null,       // se muestra “–” en Excel
    costoTotal: costoBase,     // 333.33
    comisionable: true,
    totalConComision,          // 833.33
    orden: 51,
  };
}


// ---------------------------------------------------------------------------
// PROCESAMIENTO – Base + Limpieza (digital)
// Fórmula Excel (Sheet1 (2)):
//   preguntas        = duracionCuestionario * paramPregPorMin
//   minutos          = 1 (fijo) * duracionCuestionario * preguntas
//   horas            = minutos / 60
//   costoTotal (base)= horas * precioHoraProcesamiento
//   totalConComision = costoTotal / 0.4
//   (muestra: personas=1, dias=0.00, unitario=precioHora)
// ---------------------------------------------------------------------------
export function buildBaseLimpiezaProcesamiento(
  params: {
    factorComisionable: number;
    factorNoComisionable: number;
    duracionCuestionarioMin: number;  // ← viene de la coti
  },
  constantes?: Record<string, number>,
): CotizacionItemBuild {
  const C = constantes ?? {};
  const duracion = Number(params.duracionCuestionarioMin || 0);
  const pregPorMin = getPreguntasPorMin(C, 4);    // fijo 4 si no hay constante
  const precioHora = getPrecioHoraProc(C, 10);    // fijo 10 si no hay constante
  const baseCom    = getBaseComisionable(C, 0.4); // divisor 0.4

  // preguntas = duración * 4
  const preguntas = duracion * pregPorMin;

  // minutos = (1 * duración) * preguntas
  const minutos = duracion * preguntas;

  // horas = minutos/60
  const horas = minutos / 60;

  // base = horas * precioHora  → 66.67 con tus números
  const base = round2(horas * precioHora);

  // comisionado = base / 0.4 → 166.67
  const conCom = round2(base / baseCom);

  return {
    category: 'PROCESAMIENTO',
    description: 'Base + Limpieza (digital)',
    personas: 1,
    dias: 0,                // en tu tabla aparece 0.00
    costoUnitario: precioHora, // en tu Excel muestran $10.00
    costoTotal: base,       // 66.67
    comisionable: true,
    totalConComision: conCom, // 166.67
    orden: 52,
  };
}
