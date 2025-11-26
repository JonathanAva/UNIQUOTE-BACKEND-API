// src/modules/cotizaciones/builder/casa-por-casa.builder.ts
//
// Builder para armar los bloques de la cotización
// del tipo "Casa por casa" con cobertura NACIONAL.
//
// Aquí SOLO hay lógica de armado de bloques:
//  - TRABAJO DE CAMPO
//  - RECURSOS
//  - DIRECCIÓN
//  - (más adelante) PROCESAMIENTO, ELEMENTOS EXTRA, etc.
//
// No hay Nest, ni Prisma, ni acceso a BD.

import {
  distribuirEntrevistasNacional,
  aplicarRendimientoNacional,
  aplicarEncuestadoresYSupervisoresNacional,
  aplicarDiasCampoYCostosNacional,
  aplicarPrecioBoletaNacional,
  calcularTotalesViaticosTransporteHotelNacional,
  calcularPagosPersonalNacional,
  type DistribucionNacionalResult,
  type ParamsRendimiento,
} from '../engine/casa-por-casa/nacional.engine';

// ---------------------------------------------------------
// Tipos locales
// ---------------------------------------------------------

export interface CotizacionItemBuild {
  category: string;
  description: string;
  personas: number | null;        // "# pers/encues/grp"
  dias: number | null;            // "# días/pág."
  costoUnitario: number | null;   // "Costo US$"
  costoTotal: number | null;      // "Costo total US$"
  comisionable: boolean;          // Sí / No
  totalConComision: number | null;// "Total"
  orden: number;                  // para mantener el orden del Excel
}

/**
 * Parámetros que necesita el builder de Casa por casa / Nacional.
 */
export interface CasaPorCasaNacionalBuilderParams {
  // Inputs de la cotización
  totalEntrevistas: number;          // Ingresar!H4
  duracionCuestionarioMin: number;   // Ingresar!C12 (ej. 15 min)
  tipoEntrevista: string;            // Casa por casa / Telefónico / Online, etc.
  cobertura: string;                 // Nacional / Urbano / AMSS / Unimer...
  supervisores: number;              // Ingresar!C19
  encuestadoresTotales: number;      // Ingresar!C20
  realizamosCuestionario: boolean;   // Ingresar!C24
  realizamosScript: boolean;         // Ingresar!C25

  // Factores globales de la cabecera de cotización
  factorComisionable: number;        // G4 → 1.00 (100 %)
  factorNoComisionable: number;      // G7 → 0.05 (5 %)

  // Resultado del motor NACIONAL ya calculado
  distribucion: DistribucionNacionalResult;
}

/**
 * Resultado global del builder.
 */
export interface CasaPorCasaNacionalBuildResult {
  items: CotizacionItemBuild[];
  totalCobrar: number;
  costoPorEntrevista: number;
}

// Entrada que usará el SERVICE al llamar al builder
export interface BuildCotizacionCasaPorCasaInput {
  totalEntrevistas: number;
  duracionCuestionarioMin: number;
  tipoEntrevista: string;
  penetracionCategoria: string;
  cobertura: string;
  supervisores: number;
  encuestadoresTotales: number;
  realizamosCuestionario: boolean;
  realizamosScript: boolean;
}

// ---------------------------------------------------------
// Helpers genéricos
// ---------------------------------------------------------

const round2 = (value: number): number =>
  Math.round(value * 100) / 100;

function aplicarComision(
  costoTotal: number,
  comisionable: boolean,
  factorComisionable: number,
  factorNoComisionable: number,
): number {
  const factor = comisionable
    ? 1 + factorComisionable
    : 1 + factorNoComisionable;

  return round2(costoTotal * factor);
}

function buildItemSimple(opts: {
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
  const personas = opts.personas;
  const dias = opts.dias;
  const costoUnitario = opts.costoUnitario;

  const costoTotal = round2(personas * dias * costoUnitario);
  const totalConComision = aplicarComision(
    costoTotal,
    opts.comisionable,
    opts.factorComisionable,
    opts.factorNoComisionable,
  );

  return {
    category: opts.category,
    description: opts.description,
    personas,
    dias,
    costoUnitario,
    costoTotal,
    comisionable: opts.comisionable,
    totalConComision,
    orden: opts.orden,
  };
}

// ---------------------------------------------------------
// Bloque: TRABAJO DE CAMPO
// ---------------------------------------------------------

function buildTrabajoCampoCasaPorCasaNacional(
  params: CasaPorCasaNacionalBuilderParams,
): CotizacionItemBuild[] {
  const {
    supervisores,
    encuestadoresTotales,
    distribucion,
    factorComisionable,
    factorNoComisionable,
  } = params;

  const items: CotizacionItemBuild[] = [];

  const totalPersonasCampo = supervisores + encuestadoresTotales;

  const diasCampoReal = distribucion.totalDiasCampoEncuestGlobal ?? 0;
  const diasCampo = round2(diasCampoReal || 0);

  const totalViaticos = distribucion.totalViaticosGlobal ?? 0;
  const totalTransporte = distribucion.totalTMicrobusGlobal ?? 0;
  const totalHotel = distribucion.totalHotelGlobal ?? 0;

  const totalPagoEncuestadores =
    distribucion.totalPagoEncuestadoresGlobal ?? 0;
  const totalPagoSupervisores =
    distribucion.totalPagoSupervisoresGlobal ?? 0;

  // Dirección Trabajo Campo
  {
    const item = buildItemSimple({
      category: 'TRABAJO DE CAMPO',
      description: 'Dirección Trabajo Campo',
      personas: 1,
      dias: diasCampo,
      costoUnitario: 50,
      comisionable: true,
      orden: 10,
      factorComisionable,
      factorNoComisionable,
    });
    items.push(item);
  }

  // Capacitación
  {
    const item = buildItemSimple({
      category: 'TRABAJO DE CAMPO',
      description: 'Capacitación',
      personas: totalPersonasCampo,
      dias: 1,
      costoUnitario: 8,
      comisionable: true,
      orden: 11,
      factorComisionable,
      factorNoComisionable,
    });
    items.push(item);
  }

  // Supervisor (campo)
  {
    const personas = supervisores;
    const dias = diasCampo;
    const costoTotal = round2(totalPagoSupervisores);
    const costoUnitario =
      personas > 0 && dias > 0
        ? round2(costoTotal / (personas * dias))
        : 0;

    const totalConComision = aplicarComision(
      costoTotal,
      true,
      factorComisionable,
      factorNoComisionable,
    );

    items.push({
      category: 'TRABAJO DE CAMPO',
      description: 'Supervisor',
      personas,
      dias,
      costoUnitario,
      costoTotal,
      comisionable: true,
      totalConComision,
      orden: 12,
    });
  }

  // Encuestadores
  {
    const item = buildItemSimple({
      category: 'TRABAJO DE CAMPO',
      description: 'Encuestadores',
      personas: encuestadoresTotales,
      dias: diasCampo,
      costoUnitario: 3.5,
      comisionable: true,
      orden: 13,
      factorComisionable,
      factorNoComisionable,
    });
    items.push(item);
  }

  // Pago de filtros
  {
    const item = buildItemSimple({
      category: 'TRABAJO DE CAMPO',
      description: 'Pago de filtros',
      personas: 0,
      dias: 1,
      costoUnitario: 0.5,
      comisionable: true,
      orden: 14,
      factorComisionable,
      factorNoComisionable,
    });
    items.push(item);
  }

  // Viáticos
  {
    const personas = totalPersonasCampo;
    const dias = diasCampo;
    const costoTotal = round2(totalViaticos);
    const costoUnitario =
      personas > 0 && dias > 0
        ? round2(costoTotal / (personas * dias))
        : 0;

    const totalConComision = aplicarComision(
      costoTotal,
      true,
      factorComisionable,
      factorNoComisionable,
    );

    items.push({
      category: 'TRABAJO DE CAMPO',
      description: 'Viaticos',
      personas,
      dias,
      costoUnitario,
      costoTotal,
      comisionable: true,
      totalConComision,
      orden: 15,
    });
  }

  // Transporte
  {
    const personas = totalPersonasCampo;
    const dias = diasCampo;
    const costoTotal = round2(totalTransporte);
    const costoUnitario =
      personas > 0 && dias > 0
        ? round2(costoTotal / (personas * dias))
        : 0;

    const totalConComision = aplicarComision(
      costoTotal,
      true,
      factorComisionable,
      factorNoComisionable,
    );

    items.push({
      category: 'TRABAJO DE CAMPO',
      description: 'Transporte',
      personas,
      dias,
      costoUnitario,
      costoTotal,
      comisionable: true,
      totalConComision,
      orden: 16,
    });
  }

  // Hotel
  {
    const personas = totalPersonasCampo;
    const dias = diasCampo;
    const costoTotal = round2(totalHotel);
    const costoUnitario =
      personas > 0 && dias > 0
        ? round2(costoTotal / (personas * dias))
        : 0;

    const totalConComision = aplicarComision(
      costoTotal,
      false,
      factorComisionable,
      factorNoComisionable,
    );

    items.push({
      category: 'TRABAJO DE CAMPO',
      description: 'Hotel',
      personas,
      dias,
      costoUnitario,
      costoTotal,
      comisionable: false,
      totalConComision,
      orden: 17,
    });
  }

  return items;
}

// ---------------------------------------------------------
// Bloque: RECURSOS
// ---------------------------------------------------------

const RECURSOS_CONFIG_NACIONAL = {
  diasRecursos: 15,
  telefonoUnimeresUnit: 0.6,
  telefonoCelularCampoUnit: 0.36,
  internetEncuestadoresUnit: 3,
  usbUnit: 3.1,
  papelUnit: 0.3,
  usoDispositivosUnit: 5,
  plataformaStgUnit: 0.26,
};

function buildRecursosCasaPorCasaNacional(
  params: CasaPorCasaNacionalBuilderParams,
): CotizacionItemBuild[] {
  const {
    supervisores,
    encuestadoresTotales,
    distribucion,
    factorComisionable,
    factorNoComisionable,
    tipoEntrevista,
    totalEntrevistas,
  } = params;

  const items: CotizacionItemBuild[] = [];

  const totalPersonasCampo = supervisores + encuestadoresTotales;
  const diasRecursos = RECURSOS_CONFIG_NACIONAL.diasRecursos;

  const totalEntrevistasAjustado =
    distribucion.totalEntrevistasAjustado || totalEntrevistas;

  const isTelefonico =
    tipoEntrevista.trim().toLowerCase() === 'telefónico';

  // Teléfono (UNIMERES)
  items.push(
    buildItemSimple({
      category: 'RECURSOS',
      description: 'Teléfono (UNIMERES)',
      personas: 1,
      dias: diasRecursos,
      costoUnitario: RECURSOS_CONFIG_NACIONAL.telefonoUnimeresUnit,
      comisionable: false,
      orden: 20,
      factorComisionable,
      factorNoComisionable,
    }),
  );

  // Teléfono celular (campo)
  items.push(
    buildItemSimple({
      category: 'RECURSOS',
      description: 'Teléfono celular (campo)',
      personas: totalPersonasCampo,
      dias: diasRecursos,
      costoUnitario: RECURSOS_CONFIG_NACIONAL.telefonoCelularCampoUnit,
      comisionable: false,
      orden: 21,
      factorComisionable,
      factorNoComisionable,
    }),
  );

  // Internet a encuestadores
  items.push(
    buildItemSimple({
      category: 'RECURSOS',
      description: 'Internet a encuestadores',
      personas: encuestadoresTotales,
      dias: diasRecursos,
      costoUnitario: RECURSOS_CONFIG_NACIONAL.internetEncuestadoresUnit,
      comisionable: false,
      orden: 22,
      factorComisionable,
      factorNoComisionable,
    }),
  );

  // USB
  items.push(
    buildItemSimple({
      category: 'RECURSOS',
      description: 'USB',
      personas: 1,
      dias: 1,
      costoUnitario: RECURSOS_CONFIG_NACIONAL.usbUnit,
      comisionable: true,
      orden: 23,
      factorComisionable,
      factorNoComisionable,
    }),
  );

  // Papel
  items.push(
    buildItemSimple({
      category: 'RECURSOS',
      description: 'Papel',
      personas: totalPersonasCampo,
      dias: 1,
      costoUnitario: RECURSOS_CONFIG_NACIONAL.papelUnit,
      comisionable: true,
      orden: 24,
      factorComisionable,
      factorNoComisionable,
    }),
  );

  // Uso de dispositivos
  items.push(
    buildItemSimple({
      category: 'RECURSOS',
      description: 'Uso de dispositivos',
      personas: totalPersonasCampo,
      dias: diasRecursos,
      costoUnitario: RECURSOS_CONFIG_NACIONAL.usoDispositivosUnit,
      comisionable: false,
      orden: 25,
      factorComisionable,
      factorNoComisionable,
    }),
  );

  // Plataforma de Captura STG
  {
    const personas = totalEntrevistasAjustado;
    const dias = 0;
    const costoUnitario = isTelefonico
      ? 0
      : RECURSOS_CONFIG_NACIONAL.plataformaStgUnit;

    const costoTotal = round2(personas * costoUnitario);
    const totalConComision = aplicarComision(
      costoTotal,
      false,
      factorComisionable,
      factorNoComisionable,
    );

    items.push({
      category: 'RECURSOS',
      description: 'Plataforma de Captura STG',
      personas,
      dias,
      costoUnitario,
      costoTotal,
      comisionable: false,
      totalConComision,
      orden: 26,
    });
  }

  return items;
}

// ---------------------------------------------------------
// Bloque: DIRECCIÓN – Días director
// ---------------------------------------------------------

function buildDireccionCasaPorCasaNacional(
  params: CasaPorCasaNacionalBuilderParams,
): CotizacionItemBuild[] {
  const { distribucion } = params;

  const items: CotizacionItemBuild[] = [];

  const diasProyecto = distribucion.totalDiasCampoEncuestGlobal ?? 0; // ej. 15
  const horasBase = diasProyecto * 2;
  const horasTotales = horasBase + 4; // 2h/día + 4h extras

  const COSTO_HORA_DIRECTOR = 10;
  const costoInterno = round2(horasTotales * COSTO_HORA_DIRECTOR); // 340
  const totalConComision = round2(costoInterno / 0.4); // 850

  items.push({
    category: 'DIRECCIÓN',
    description: 'Días director',
    personas: 1,
    dias: horasTotales,      // 34
    costoUnitario: null,
    costoTotal: null,
    comisionable: true,
    totalConComision,        // 850.00
    orden: 30,
  });

  return items;
}

// ---------------------------------------------------------
// DIRECCIÓN – Realización Cuestionario
// ---------------------------------------------------------

function buildRealizacionCuestionario(
  params: CasaPorCasaNacionalBuilderParams,
): CotizacionItemBuild {
  const { duracionCuestionarioMin, realizamosCuestionario } = params;

  const personas = realizamosCuestionario ? 1 : 0;
  const dias = 1;

  const PREGUNTAS_POR_MINUTO = 4;
  const MINUTOS_POR_PREGUNTA = 5;
  const PRECIO_HORA = 10;
  const MARGEN_COMISION = 0.4;

  const investigacionHoras = 1.5;
  const investigacionPrecio = investigacionHoras * PRECIO_HORA; // 15

  const preguntasTotales = duracionCuestionarioMin * PREGUNTAS_POR_MINUTO;
  const tiempoPorPreguntaMin = preguntasTotales * MINUTOS_POR_PREGUNTA; // 300
  const horasTiempoPorPregunta = tiempoPorPreguntaMin / 60; // 5
  const tiempoPorPreguntaPrecio =
    horasTiempoPorPregunta * PRECIO_HORA; // 50

  const precioRealizacion = investigacionPrecio + tiempoPorPreguntaPrecio; // 65
  const costoTotal = round2(personas * dias * precioRealizacion); // 65 ó 0

  const totalConComision =
    personas > 0 ? round2(costoTotal / MARGEN_COMISION) : 0; // 162.50

  return {
    category: 'DIRECCIÓN',
    description: 'Realización Cuestionario',
    personas,
    dias,
    costoUnitario: null, // en el Excel se deja "-"
    costoTotal,          // 65.00
    comisionable: true,
    totalConComision,    // 162.50
    orden: 32,
  };
}

// ---------------------------------------------------------
// DIRECCIÓN – Supervisor (Script)
// ---------------------------------------------------------

function buildSupervisorScript(
  params: CasaPorCasaNacionalBuilderParams,
): CotizacionItemBuild {
  const { duracionCuestionarioMin, realizamosScript } = params;

  const personas = realizamosScript ? 1 : 0;
  const dias = 1;

  if (!realizamosScript) {
    return {
      category: 'DIRECCIÓN',
      description: 'Supervisor',
      personas,
      dias,
      costoUnitario: null,
      costoTotal: null,
      comisionable: true,
      totalConComision: 0,
      orden: 33,
    };
  }

  const PREGUNTAS_POR_MINUTO = 4;
  const PRECIO_HORA_SCRIPT = 8;
  const MINUTOS_CAMBIOS = 60;
  const MARGEN_COMISION = 0.4;

  const preguntasTotales =
    duracionCuestionarioMin * PREGUNTAS_POR_MINUTO; // ej. 60

  // Tiempo fijo para entender de qué trata → solo tiempo, sin costo
  const _minEntender = duracionCuestionarioMin * 2; // 15 * 2 = 30

  // Programar una pregunta en software
  const minProg = preguntasTotales; // 1 min por pregunta
  const horasProg = minProg / 60;
  const precioProg = horasProg * PRECIO_HORA_SCRIPT; // 8

  // Definir saltos y reglas
  const minSaltos = preguntasTotales;
  const horasSaltos = minSaltos / 60;
  const precioSaltos = horasSaltos * PRECIO_HORA_SCRIPT; // 8

  // Duración de prueba
  const minPrueba = duracionCuestionarioMin * 2; // 30
  const horasPrueba = minPrueba / 60;
  const precioPrueba = horasPrueba * PRECIO_HORA_SCRIPT; // 4

  // Cambios
  const minCambios = MINUTOS_CAMBIOS; // 60
  const horasCambios = minCambios / 60; // 1
  const precioCambios = horasCambios * PRECIO_HORA_SCRIPT; // 8

  const precioInterno = round2(
    precioProg + precioSaltos + precioPrueba + precioCambios,
  ); // 28.00

  const totalConComision = round2(precioInterno / MARGEN_COMISION); // 70.00

  return {
    category: 'DIRECCIÓN',
    description: 'Supervisor',
    personas,
    dias,
    costoUnitario: null,  // "-" en Excel
    costoTotal: null,     // "-"
    comisionable: true,
    totalConComision,     // 70.00
    orden: 33,
  };
}

// ---------------------------------------------------------
// Builder principal: Casa por casa / Nacional (interno)
// ---------------------------------------------------------

export function buildCasaPorCasaNacional(
  params: CasaPorCasaNacionalBuilderParams,
): CasaPorCasaNacionalBuildResult {
  const trabajoCampo = buildTrabajoCampoCasaPorCasaNacional(params);
  const recursos = buildRecursosCasaPorCasaNacional(params);
  const direccion = buildDireccionCasaPorCasaNacional(params);
  const realizacionCuestionario = buildRealizacionCuestionario(params);
  const supervisorScript = buildSupervisorScript(params);

  const items: CotizacionItemBuild[] = [
    ...trabajoCampo,
    ...recursos,
    ...direccion,
    realizacionCuestionario,
    supervisorScript,
  ];

  const totalCobrar = round2(
    items.reduce(
      (acc, it) => acc + (it.totalConComision ?? 0),
      0,
    ),
  );

  const costoPorEntrevista =
    params.totalEntrevistas > 0
      ? round2(totalCobrar / params.totalEntrevistas)
      : 0;

  return {
    items,
    totalCobrar,
    costoPorEntrevista,
  };
}

// ---------------------------------------------------------
// FUNCIÓN QUE USA EL SERVICE
// ---------------------------------------------------------

export function buildCotizacionCasaPorCasa(
  input: BuildCotizacionCasaPorCasaInput,
): CasaPorCasaNacionalBuildResult {
  const coberturaLower = input.cobertura.trim().toLowerCase();
  if (coberturaLower !== 'nacional') {
    throw new Error(
      `Por ahora el builder "Casa por casa" solo soporta cobertura "Nacional" (recibido: "${input.cobertura}")`,
    );
  }

  // Mapear penetración a fracción
  const rawPen = (input.penetracionCategoria ?? '').toString();
  const value = rawPen.trim().toLowerCase();
  const numeric = Number(value.replace('%', ''));
  let penetracion: number;

  if (!Number.isNaN(numeric) && numeric > 0) {
    penetracion = numeric > 1 ? numeric / 100 : numeric;
  } else {
    switch (value) {
      case 'facil':
      case 'fácil':
        penetracion = 0.85;
        break;
      case 'medio':
        penetracion = 0.6;
        break;
      case 'dificil':
      case 'difícil':
        penetracion = 0.35;
        break;
      default:
        throw new Error(
          `penetracionCategoria inválida: "${rawPen}", envía porcentaje (ej. "80%" o "0.8") o etiquetas facil/medio/dificil`,
        );
    }
  }

  // 1) Distribución base
  let distribucion = distribuirEntrevistasNacional(
    input.totalEntrevistas,
    input.tipoEntrevista,
  );

  // 2) Rendimiento
  const paramsRendimiento: ParamsRendimiento = {
    duracionCuestionarioMin: input.duracionCuestionarioMin,
    penetracion,
    totalEncuestadores: input.encuestadoresTotales,
    segmentSize: 20,
    filterMinutes: 2,
    searchMinutes: 8,
    desplazamientoMin: 60,
    groupSize: 4,
  };

  distribucion = aplicarRendimientoNacional(distribucion, paramsRendimiento);

  // 3) Encuestadores / supervisores
  distribucion = aplicarEncuestadoresYSupervisoresNacional(
    distribucion,
    input.encuestadoresTotales,
    { groupSize: 4, supervisorSplit: 4 },
  );

  // 4) Días campo + costos
  distribucion = aplicarDiasCampoYCostosNacional(distribucion);

  // 5) Precio de boleta
  distribucion = aplicarPrecioBoletaNacional(distribucion, {
    duracionCuestionarioMin: input.duracionCuestionarioMin,
    penetracion,
  });

  // 6) Viáticos / transporte / hotel
  distribucion =
    calcularTotalesViaticosTransporteHotelNacional(distribucion);

  // 7) Pagos personal
  distribucion = calcularPagosPersonalNacional(distribucion);

  // 8) Construir bloques
  const builderParams: CasaPorCasaNacionalBuilderParams = {
    totalEntrevistas: input.totalEntrevistas,
    duracionCuestionarioMin: input.duracionCuestionarioMin,
    tipoEntrevista: input.tipoEntrevista,
    cobertura: input.cobertura,
    supervisores: input.supervisores,
    encuestadoresTotales: input.encuestadoresTotales,
    realizamosCuestionario: input.realizamosCuestionario,
    realizamosScript: input.realizamosScript,
    factorComisionable: 1,    // 100 %
    factorNoComisionable: 0.05, // 5 %
    distribucion,
  };

  return buildCasaPorCasaNacional(builderParams);
}
