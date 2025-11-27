// src/modules/cotizaciones/builder/casa-por-casa.builder.ts
//
// Builder para armar los bloques de la cotización
// del tipo "Casa por casa" con cobertura NACIONAL.
//
// Aquí SOLO hay lógica de armado de bloques:
//
//  - TRABAJO DE CAMPO
//  - RECURSOS
//  - DIRECCIÓN (Días director, Realización cuestionario, Supervisor,
//               Reporte de resultados)
//  - (más adelante) PROCESAMIENTO, ELEMENTOS EXTRA, etc.
//
// No hay Nest, ni Prisma, ni acceso a BD: solo cálculos
// y armado de estructuras planas para luego crear CotizacionItem.

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

/**
 * Representa la estructura que luego se mapeará a CotizacionItem
 * de Prisma. Aquí usamos number / boolean a pelo.
 */
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
 * Parámetros que necesita el builder de Casa por casa / Nacional
 * una vez que ya tenemos la distribución calculada por el motor.
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
  clienteSolicitaReporte: boolean;   // Ingresar!C26

  // Factores globales de la cabecera de cotización
  factorComisionable: number;        // G4 → 1.00 (100 %)
  factorNoComisionable: number;      // G7 → 0.05 (5 %)

  // Resultado del motor NACIONAL ya calculado
  distribucion: DistribucionNacionalResult;
}

/**
 * Resultado global del builder:
 *  - items: todos los CotizacionItem que se guardarán
 *  - totalCobrar: suma de "Total" de todos los items
 *  - costoPorEntrevista: totalCobrar / totalEntrevistas
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
  clienteSolicitaReporte: boolean;
}

// ---------------------------------------------------------
// Helpers genéricos
// ---------------------------------------------------------

const round2 = (value: number): number =>
  Math.round(value * 100) / 100;

/**
 * Aplica el factor comisionable / no comisionable.
 *
 * - Si comisionable = true → costoTotal * (1 + factorComisionable)
 * - Si comisionable = false → costoTotal * (1 + factorNoComisionable)
 */
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

/**
 * Helper básico para filas cuya fórmula de costo total es:
 *
 *   costoTotal = personas * dias * costoUnitario
 */
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
// Bloque: TRABAJO DE CAMPO (Casa por casa / Nacional)
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

  // Días de campo global (suma de la columna "Días campo Encuest")
  const diasCampoReal = distribucion.totalDiasCampoEncuestGlobal ?? 0;
  const diasCampo = round2(diasCampoReal || 0); // en el ejemplo queda 15.00

  // Totales globales de Viáticos / Transporte / Hotel ya calculados
  const totalViaticos = distribucion.totalViaticosGlobal ?? 0;
  const totalTransporte = distribucion.totalTMicrobusGlobal ?? 0;
  const totalHotel = distribucion.totalHotelGlobal ?? 0;

  // Totales globales de pagos de personal
  const totalPagoEncuestadores =
    distribucion.totalPagoEncuestadoresGlobal ?? 0;
  const totalPagoSupervisores =
    distribucion.totalPagoSupervisoresGlobal ?? 0;

  // === Dirección Trabajo Campo ===============================
  {
    const personas = 1;
    const costoUnitario = 50;

    const item = buildItemSimple({
      category: 'TRABAJO DE CAMPO',
      description: 'Dirección Trabajo Campo',
      personas,
      dias: diasCampo,
      costoUnitario,
      comisionable: true,
      orden: 10,
      factorComisionable,
      factorNoComisionable,
    });

    items.push(item);
  }

  // === Capacitación =========================================
  {
    const personas = totalPersonasCampo;
    const costoUnitario = 8;

    const item = buildItemSimple({
      category: 'TRABAJO DE CAMPO',
      description: 'Capacitación',
      personas,
      dias: 1,
      costoUnitario,
      comisionable: true,
      orden: 11,
      factorComisionable,
      factorNoComisionable,
    });

    items.push(item);
  }

  // === Supervisor ===========================================
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
      true, // comisionable
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

  // === Encuestadores ========================================
  {
    const personas = encuestadoresTotales;
    const dias = diasCampo;
    const costoUnitario = 3.5;

    const item = buildItemSimple({
      category: 'TRABAJO DE CAMPO',
      description: 'Encuestadores',
      personas,
      dias,
      costoUnitario,
      comisionable: true,
      orden: 13,
      factorComisionable,
      factorNoComisionable,
    });

    items.push(item);
  }

  // === Pago de filtros ======================================
  {
    const personas = 0;
    const dias = 1;
    const costoUnitario = 0.5;

    const item = buildItemSimple({
      category: 'TRABAJO DE CAMPO',
      description: 'Pago de filtros',
      personas,
      dias,
      costoUnitario,
      comisionable: true,
      orden: 14,
      factorComisionable,
      factorNoComisionable,
    });

    items.push(item);
  }

  // === Viáticos =============================================
  {
    const personas = totalPersonasCampo;
    const dias = diasCampo;
    const costoTotal = round2(totalViaticos);

    const costoUnitario =
      personas > 0 && dias > 0
        ? round2(costoTotal / (personas * dias))
        : 0; // ≈ 1.56

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

  // === Transporte ===========================================
  {
    const personas = totalPersonasCampo;
    const dias = diasCampo;
    const costoTotal = round2(totalTransporte);

    const costoUnitario =
      personas > 0 && dias > 0
        ? round2(costoTotal / (personas * dias))
        : 0; // ≈ 5.71

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

  // === Hotel ================================================
  {
    const personas = totalPersonasCampo;
    const dias = diasCampo;
    const costoTotal = round2(totalHotel);

    const costoUnitario =
      personas > 0 && dias > 0
        ? round2(costoTotal / (personas * dias))
        : 0; // ≈ 0.62

    const totalConComision = aplicarComision(
      costoTotal,
      false, // No comisionable
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
// Bloque: RECURSOS (Casa por casa / Nacional)
// ---------------------------------------------------------

/**
 * Config específica para recursos de Casa por casa / Nacional.
 * Equivale a lo que hoy saca la hoja "Botones".
 */
const RECURSOS_CONFIG_NACIONAL = {
  diasRecursos: 15,            // XLOOKUP(Ingresar!C18, Botones!K:L)
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

  // Para la plataforma STG se usa el total de entrevistas ajustado (H4 * 1.05)
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

  // Resto de filas de RECURSOS se dejarán en 0 por ahora.

  return items;
}

// ---------------------------------------------------------
// Bloque: DIRECCIÓN (Casa por casa / Nacional)
// ---------------------------------------------------------

// ----- Días director --------------------------------------

function buildDiasDirector(
  params: CasaPorCasaNacionalBuilderParams,
): CotizacionItemBuild {
  const { distribucion } = params;

  const diasProyecto = distribucion.totalDiasCampoEncuestGlobal ?? 0; // ej. 15
  const horasBase = diasProyecto * 2; // 2 horas por día
  const horasTotales = horasBase + 4; // + 4 horas extras

  const COSTO_HORA_DIRECTOR = 10;
  const costoInterno = round2(horasTotales * COSTO_HORA_DIRECTOR); // ej. 340
  const totalConComision = round2(costoInterno / 0.4); // ej. 850

  return {
    category: 'DIRECCIÓN',
    description: 'Días director',
    personas: 1,
    dias: horasTotales,          // 34
    costoUnitario: null,         // "-"
    costoTotal: null,            // "-"
    comisionable: true,
    totalConComision,            // 850.00
    orden: 30,
  };
}

// ----- Realización Cuestionario ---------------------------
//
// Ver explicación en tu mensaje: total interno 65 US$,
// total comisionado 162.50

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

  // Investigación base
  const investigacionHoras = 1.5;
  const investigacionPrecio = investigacionHoras * PRECIO_HORA; // 15

  // Tiempo por pregunta
  const preguntasTotales = duracionCuestionarioMin * PREGUNTAS_POR_MINUTO;
  const tiempoPorPreguntaMin = preguntasTotales * MINUTOS_POR_PREGUNTA;
  const horasTiempoPorPregunta = tiempoPorPreguntaMin / 60; // 300 / 60 = 5
  const tiempoPorPreguntaPrecio =
    horasTiempoPorPregunta * PRECIO_HORA; // 5 * 10 = 50

  const precioRealizacion = investigacionPrecio + tiempoPorPreguntaPrecio; // 65

  const costoTotal = round2(personas * dias * precioRealizacion); // 65 ó 0
  const totalConComision =
    personas > 0 ? round2(costoTotal / MARGEN_COMISION) : 0; // 162.50

  return {
    category: 'DIRECCIÓN',
    description: 'Realización Cuestionario',
    personas,
    dias,
    costoUnitario: null,
    costoTotal,
    comisionable: true,
    totalConComision,
    orden: 32,
  };
}

// ----- Supervisor (Script) --------------------------------
//
// Total interno = 28 US$, total con comisión = 70 US$.

function buildSupervisorScript(
  params: CasaPorCasaNacionalBuilderParams,
): CotizacionItemBuild {
  const { duracionCuestionarioMin, realizamosScript } = params;

  const personas = realizamosScript ? 1 : 0;
  const dias = 1;

  const PRECIO_HORA = 8;
  const PREGUNTAS_POR_MINUTO = 4;
  const MARGEN_COMISION = 0.4;

  const preguntasTotales = duracionCuestionarioMin * PREGUNTAS_POR_MINUTO;

  // tiempos en minutos según tu tabla
  const tiempoEntenderMin = duracionCuestionarioMin * 2; // 30
  const tiempoProgramarMin = preguntasTotales * 1;       // 60
  const tiempoReglasMin = preguntasTotales * 1;          // 60
  const tiempoPruebaMin = duracionCuestionarioMin * 2;   // 30
  const tiempoCambiosMin = 60;                           // 60

  const costoEntender = (tiempoEntenderMin / 60) * PRECIO_HORA;   // 4
  const costoProgramar = (tiempoProgramarMin / 60) * PRECIO_HORA; // 8
  const costoReglas = (tiempoReglasMin / 60) * PRECIO_HORA;       // 8
  const costoPrueba = (tiempoPruebaMin / 60) * PRECIO_HORA;       // 4
  const costoCambios = (tiempoCambiosMin / 60) * PRECIO_HORA;     // 8

  const precioInterno = round2(
    costoEntender +
      costoProgramar +
      costoReglas +
      costoPrueba +
      costoCambios, // 28
  );

  const costoTotal = round2(personas * dias * precioInterno); // 28 ó 0
  const totalConComision =
    personas > 0 ? round2(costoTotal / MARGEN_COMISION) : 0; // 70

  return {
    category: 'DIRECCIÓN',
    description: 'Supervisor',
    personas,
    dias,
    costoUnitario: null,
    costoTotal,
    comisionable: true,
    totalConComision,
    orden: 33,
  };
}

// ----- Reporte de Resultados ------------------------------
//
// Total interno = 340 US$, total con comisión = 850 US$.

function buildReporteResultados(
  params: CasaPorCasaNacionalBuilderParams,
): CotizacionItemBuild {
  const {
    duracionCuestionarioMin,
    clienteSolicitaReporte,
  } = params;

  const personas = clienteSolicitaReporte ? 1 : 0;
  const dias = 1;

  const PRECIO_HORA = 10;
  const PREGUNTAS_POR_MINUTO = 4;
  const PREGUNTAS_POR_DIAPO = 4;
  const MARGEN_COMISION = 0.4;

  const preguntasTotales = duracionCuestionarioMin * PREGUNTAS_POR_MINUTO;
  const diapositivas = preguntasTotales / PREGUNTAS_POR_DIAPO; // ej. 15

  // Diseño: 180 min fijos
  const disenoMin = 180;
  const disenoCosto = (disenoMin / 60) * PRECIO_HORA; // 3h * 10 = 30

  // Procesamiento: 5 min por pregunta
  const procMin = 5 * preguntasTotales;                // 300
  const procCosto = (procMin / 60) * PRECIO_HORA;      // 5h * 10 = 50

  // Gráficas: 60 min por diapositiva
  const graficasMin = 60 * diapositivas;               // 900
  const graficasCosto = (graficasMin / 60) * PRECIO_HORA; // 15h * 10 = 150

  // Revisión de datos: 10 min por diapositiva
  const revisionMin = 10 * diapositivas;               // 150
  const revisionCosto = (revisionMin / 60) * PRECIO_HORA; // 2.5h * 10 = 25

  // Presentación a clientes: 120 min fijos
  const presentacionMin = 120;
  const presentacionCosto = (presentacionMin / 60) * PRECIO_HORA; // 2h * 10 = 20

  // Ajustes: 390 min fijos
  const ajustesMin = 390;
  const ajustesCosto = (ajustesMin / 60) * PRECIO_HORA; // 6.5h * 10 = 65

  const precioInterno = round2(
    disenoCosto +
      procCosto +
      graficasCosto +
      revisionCosto +
      presentacionCosto +
      ajustesCosto, // 340
  );

  const costoTotal = round2(personas * dias * precioInterno); // 340 ó 0
  const totalConComision =
    personas > 0 ? round2(costoTotal / MARGEN_COMISION) : 0;   // 850

  return {
    category: 'DIRECCIÓN',
    description: 'Reporte de Resultados',
    personas,
    dias,
    costoUnitario: null, // "-"
    costoTotal,          // 340
    comisionable: true,
    totalConComision,    // 850
    orden: 34,
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
  const diasDirector = buildDiasDirector(params);
  const realizacionCuestionario = buildRealizacionCuestionario(params);
  const supervisorScript = buildSupervisorScript(params);
  const reporteResultados = buildReporteResultados(params);

  const items: CotizacionItemBuild[] = [
    ...trabajoCampo,
    ...recursos,
    diasDirector,
    realizacionCuestionario,
    supervisorScript,
    reporteResultados,
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

/**
 * Builder principal que usa el service de cotizaciones.
 *
 * - Ejecuta el motor NACIONAL (distribución, rendimiento, etc.)
 * - Construye los bloques TRABAJO DE CAMPO, RECURSOS y DIRECCIÓN
 * - Devuelve items, totalCobrar y costoPorEntrevista
 */
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

  // 4) Días campo + costos unitarios
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

  // 8) Construir los bloques con factores de cabecera
  const builderParams: CasaPorCasaNacionalBuilderParams = {
    totalEntrevistas: input.totalEntrevistas,
    duracionCuestionarioMin: input.duracionCuestionarioMin,
    tipoEntrevista: input.tipoEntrevista,
    cobertura: input.cobertura,
    supervisores: input.supervisores,
    encuestadoresTotales: input.encuestadoresTotales,
    realizamosCuestionario: input.realizamosCuestionario,
    realizamosScript: input.realizamosScript,
    clienteSolicitaReporte: input.clienteSolicitaReporte,
    factorComisionable: 1,   // 100 %
    factorNoComisionable: 0.05, // 5 %
    distribucion,
  };

  return buildCasaPorCasaNacional(builderParams);
}
