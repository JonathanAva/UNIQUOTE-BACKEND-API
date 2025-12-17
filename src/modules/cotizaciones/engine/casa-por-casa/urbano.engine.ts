// src/modules/cotizaciones/engine/casa-por-casa/urbano.engine.ts

import type { DistribucionNacionalResult } from './nacional.engine';

/**
 * Distribución "URBANO" (100% urbano) por departamento.
 * Estos porcentajes son "normalizados" para que SUMEN 100% dentro de urbano.
 *
 * Fuente: Urbano_depto / SUMA(Urbano_todos_los_deptos)
 */
const PESOS_URBANO: Array<{ departamento: string; pct: number }> = [
  { departamento: 'Ahuachapán', pct: 0.0547 },
  { departamento: 'Santa Ana', pct: 0.0947 },
  { departamento: 'Sonsonate', pct: 0.0774 },
  { departamento: 'Chalatenango', pct: 0.0133 },
  { departamento: 'La Libertad', pct: 0.1452 },
  { departamento: 'San Salvador', pct: 0.3435 },
  { departamento: 'Cuscatlán', pct: 0.0417 },
  { departamento: 'La Paz', pct: 0.0490 },
  { departamento: 'Cabañas', pct: 0.0130 },
  { departamento: 'San Vicente', pct: 0.0255 },
  { departamento: 'Usulután', pct: 0.0441 },
  { departamento: 'San Miguel', pct: 0.0747 },
  { departamento: 'Morazán', pct: 0.0096 },
  { departamento: 'La Unión', pct: 0.0136 },
];

/**
 * Reparte un total entero respetando porcentajes y garantizando que la suma final
 * sea EXACTAMENTE igual al total (evita que te pase lo de 1048 vs 1050).
 *
 * Método: "largest remainder"
 */
function repartirEnterosPorPorcentaje(
  total: number,
  pesos: Array<{ pct: number }>,
): number[] {
  const exactos = pesos.map((p) => p.pct * total);
  const pisos = exactos.map((x) => Math.floor(x));
  let asignado = pisos.reduce((a, b) => a + b, 0);
  let faltan = total - asignado;

  // Ordenamos por la parte decimal (mayor decimal recibe primero +1)
  const orden = exactos
    .map((x, idx) => ({ idx, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac);

  const out = [...pisos];
  let i = 0;
  while (faltan > 0) {
    out[orden[i % orden.length].idx] += 1;
    faltan -= 1;
    i += 1;
  }

  return out;
}

/**
 * Distribución base URBANO.
 * Nota: mantengo la firma parecida a Nacional por compatibilidad.
 */
export function distribuirEntrevistasUrbano(
  totalEntrevistas: number,
  _tipoEntrevista: string,
): DistribucionNacionalResult {
  // En tu Excel/flujo anterior, el total distribuido suele ser totalEntrevistas * 1.05 (p.ej. 1000 -> 1050)
  // Si en tu Nacional ya se maneja así, aquí lo replicamos para que cuadre igual.
  const totalObjetivo = Math.round(Number(totalEntrevistas) * 1.05);

  const asignaciones = repartirEnterosPorPorcentaje(totalObjetivo, PESOS_URBANO);

  const filas = PESOS_URBANO.map((p, idx) => {
    const urbano = asignaciones[idx];

    return {
      departamento: p.departamento,

      // porcentajes (urbano y total igual; rural = 0)
      pctUrbano: p.pct,
      pctRural: 0,
      pctTotal: p.pct,

      // entrevistas
      urbano,
      rural: 0,
      total: urbano,

      // valores base (si tu pipeline los sobreescribe, no pasa nada)
      horasEfectivas: 8,
      tiempoEfectivoMin: 480,
    } as any;
  });

  return {
    filas,

    // Globales iniciales (el pipeline los calcula después)
    totalDiasCampoEncuestGlobal: 0,
    totalViaticosGlobal: 0,
    totalTMicrobusGlobal: 0,
    totalHotelGlobal: 0,
    totalPagoEncuestadoresGlobal: 0,
    totalPagoSupervisoresGlobal: 0,
  } as any;
}
