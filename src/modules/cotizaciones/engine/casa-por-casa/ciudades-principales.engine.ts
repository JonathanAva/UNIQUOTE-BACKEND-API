import type {
  DepartamentoNacional,
  DistribucionNacionalResult,
  DistribucionDepartamento,
} from '@/modules/cotizaciones/engine/casa-por-casa/nacional.engine';

/**
 * Distribución base para "Ciudades Principales" (Casa por casa):
 * - Solo Santa Ana, San Salvador, San Miguel
 * - 50% Urbano / 50% Rural
 * - Total boletas = ceil(totalEntrevistas * 1.05)  => 1000 -> 1050
 * - Horas efectivas por depto según tu tabla (aunque tengan 0 entrevistas)
 *
 * Nota:
 * - Este engine SOLO arma la base (Urbano/Rural/Total + horas/tiempo + unitarios)
 * - El pipeline (rendimiento/días/totales/pagos) se calcula después.
 */
export function distribuirEntrevistasCiudadesPrincipales(
  totalEntrevistasBase: number,
  tipoEntrevista: string,
): DistribucionNacionalResult {
  if (!Number.isFinite(totalEntrevistasBase) || totalEntrevistasBase <= 0) {
    throw new Error('totalEntrevistasBase debe ser un número positivo');
  }

  const factorAjusteMuestra = 1.05;
  const totalEntrevistasAjustado = Math.ceil(totalEntrevistasBase * factorAjusteMuestra);

  const esOnline = (tipoEntrevista ?? '').trim().toLowerCase() === 'online';

  // Config por depto (mismos deptos del pipeline nacional)
  const rows: Array<{
    departamento: DepartamentoNacional;
    horasEfectivas: number;
    viaticosUnit: number;
    tMicrobusUnit: number;
    hotelUnit: number;
  }> = [
    { departamento: 'Ahuachapán',   horasEfectivas: 7, viaticosUnit: 6,  tMicrobusUnit: 125, hotelUnit: 0 },
    { departamento: 'Santa Ana',    horasEfectivas: 7, viaticosUnit: 6,  tMicrobusUnit: 100, hotelUnit: 0 },
    { departamento: 'Sonsonate',    horasEfectivas: 7, viaticosUnit: 6,  tMicrobusUnit: 100, hotelUnit: 0 },
    { departamento: 'Chalatenango', horasEfectivas: 7, viaticosUnit: 6,  tMicrobusUnit: 135, hotelUnit: 0 },
    { departamento: 'La Libertad',  horasEfectivas: 8, viaticosUnit: 6,  tMicrobusUnit: 100, hotelUnit: 0 },
    { departamento: 'San Salvador', horasEfectivas: 8, viaticosUnit: 3,  tMicrobusUnit: 60,  hotelUnit: 0 },
    { departamento: 'Cuscatlán',    horasEfectivas: 8, viaticosUnit: 6,  tMicrobusUnit: 100, hotelUnit: 0 },
    { departamento: 'La Paz',       horasEfectivas: 7, viaticosUnit: 6,  tMicrobusUnit: 100, hotelUnit: 0 },
    { departamento: 'Cabañas',      horasEfectivas: 7, viaticosUnit: 6,  tMicrobusUnit: 125, hotelUnit: 0 },
    { departamento: 'San Vicente',  horasEfectivas: 7, viaticosUnit: 6,  tMicrobusUnit: 100, hotelUnit: 0 },
    { departamento: 'Usulután',     horasEfectivas: 7, viaticosUnit: 6,  tMicrobusUnit: 135, hotelUnit: 0 },
    { departamento: 'San Miguel',   horasEfectivas: 6, viaticosUnit: 10, tMicrobusUnit: 180, hotelUnit: 12 },
    { departamento: 'Morazán',      horasEfectivas: 5, viaticosUnit: 10, tMicrobusUnit: 180, hotelUnit: 12 },
    { departamento: 'La Unión',     horasEfectivas: 5, viaticosUnit: 10, tMicrobusUnit: 180, hotelUnit: 12 },
  ];

  // % del TOTAL (1050) tal como tu tabla:
  // Santa Ana: 12.5% U / 12.5% R
  // San Salvador: 25% U / 25% R
  // San Miguel: 12.5% U / 12.5% R
  const pctU: Partial<Record<DepartamentoNacional, number>> = {
    'Santa Ana': 0.125,
    'San Salvador': 0.25,
    'San Miguel': 0.125,
  };

  const pctR: Partial<Record<DepartamentoNacional, number>> = {
    'Santa Ana': 0.125,
    'San Salvador': 0.25,
    'San Miguel': 0.125,
  };

  // Helper: asignación “largest remainder” para que sumen exacto
  const allocate = (
    total: number,
    weights: Partial<Record<DepartamentoNacional, number>>,
  ) => {
    const deps = rows.map((r) => r.departamento);
    const sum = deps.reduce((a, d) => a + (weights[d] ?? 0), 0);

    const raw = deps.map((d) => {
      const w = sum > 0 ? (weights[d] ?? 0) / sum : 0;
      const x = w * total;
      return { dep: d, floor: Math.floor(x), frac: x - Math.floor(x) };
    });

    const out = new Map<DepartamentoNacional, number>();
    for (const r of raw) out.set(r.dep, r.floor);

    let assigned = raw.reduce((a, b) => a + b.floor, 0);
    let remaining = total - assigned;

    raw.sort((a, b) => b.frac - a.frac);

    let i = 0;
    while (remaining > 0 && raw.length > 0) {
      const key = raw[i % raw.length].dep;
      out.set(key, (out.get(key) ?? 0) + 1);
      remaining--;
      i++;
    }

    return out;
  };

  // 50/50 exacto: 525 urbano + 525 rural (para 1050)
  const totalUrbano = Math.round(totalEntrevistasAjustado * 0.5);
  const totalRural = totalEntrevistasAjustado - totalUrbano;

  const urbanoMap = allocate(totalUrbano, pctU);
  const ruralMap = allocate(totalRural, pctR);

  const filas: DistribucionDepartamento[] = rows.map((r) => {
    const urbano = urbanoMap.get(r.departamento) ?? 0;
    const rural = ruralMap.get(r.departamento) ?? 0;
    const total = urbano + rural;

    const pctUrbano = pctU[r.departamento] ?? 0;
    const pctRural = pctR[r.departamento] ?? 0;
    const pctTotal = pctUrbano + pctRural;

    // Si fuera Online, en tu nacional aplica 0.15; aquí lo mantenemos consistente:
    // (si no lo quieres aquí, quítalo)
    const uFinal = esOnline ? Math.round(urbano * 0.15) : urbano;
    const rFinal = esOnline ? Math.round(rural * 0.15) : rural;

    return {
      departamento: r.departamento,

      // % (si agregaste los campos opcionales en el type)
      pctUrbano,
      pctRural,
      pctTotal,

      urbano: uFinal,
      rural: rFinal,
      total: uFinal + rFinal,

      horasEfectivas: r.horasEfectivas,
      tiempoEfectivoMin: r.horasEfectivas * 60,

      // Pipeline lo llena después
      rendimiento: 0,
      encuestadores: 0,
      supervisores: 0,
      diasCampoEncuest: 0,

      viaticosUnit: r.viaticosUnit,
      tMicrobusUnit: r.tMicrobusUnit,
      hotelUnit: r.hotelUnit,

      precioBoleta: 0,
      totalViaticos: 0,
      totalTMicrobus: 0,
      totalHotel: 0,
      pagoPorBoletaEncuestador: 0,
      pagoEncuestadores: 0,
      pagoSupervisores: 0,
    };
  });

  return {
    totalEntrevistasBase,
    factorAjusteMuestra,
    totalEntrevistasAjustado,
    esOnline,
    filas,

    // Totales globales (pipeline los recalcula, dejamos base)
    totalDiasCampoEncuestGlobal: 0,
    totalViaticosGlobal: 0,
    totalTMicrobusGlobal: 0,
    totalHotelGlobal: 0,
    totalPagoEncuestadoresGlobal: 0,
    totalPagoSupervisoresGlobal: 0,
  };
}
