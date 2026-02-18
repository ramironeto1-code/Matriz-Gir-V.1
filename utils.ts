
export const EFFICACY_REDUCTION_MAP: Record<number, number> = {
  1: 0.00,
  2: 0.20,
  3: 0.50,
  4: 0.80,
  5: 0.95,
};

export const EFFICACY_LABELS: Record<number, string> = {
  1: '1 - Inexistente (0%)',
  2: '2 - Fraco (20%)',
  3: '3 - Médio (50%)',
  4: '4 - Forte (80%)',
  5: '5 - Excelente (95%)',
};

export const RISK_LEVELS_INFO = [
  { range: '4,21 -> 5,00', label: 'Muito Alto', color: 'bg-red-600', hex: '#dc2626' },
  { range: '3,41 -> 4,20', label: 'Alto', color: 'bg-orange-600', hex: '#ea580c' },
  { range: '2,61 -> 3,40', label: 'Médio', color: 'bg-yellow-400', hex: '#facc15' },
  { range: '1,81 -> 2,60', label: 'Baixo', color: 'bg-sky-500', hex: '#0ea5e9' },
  { range: '1,00 -> 1,80', label: 'Muito Baixo', color: 'bg-emerald-600', hex: '#059669' },
];

export const getRiskLevelData = (score: number) => {
  const s = typeof score !== 'number' || isNaN(score) ? 1 : score;
  if (s >= 4.21) return { ...RISK_LEVELS_INFO[0], colorClass: RISK_LEVELS_INFO[0].color + ' text-white' };
  if (s >= 3.41) return { ...RISK_LEVELS_INFO[1], colorClass: RISK_LEVELS_INFO[1].color + ' text-white' };
  if (s >= 2.61) return { ...RISK_LEVELS_INFO[2], colorClass: RISK_LEVELS_INFO[2].color + ' text-gray-950' };
  if (s >= 1.81) return { ...RISK_LEVELS_INFO[3], colorClass: RISK_LEVELS_INFO[3].color + ' text-white' };
  return { ...RISK_LEVELS_INFO[4], colorClass: RISK_LEVELS_INFO[4].color + ' text-white' };
};

export const calculateLiquidRisk = (inherentScore: number, effectiveness: number) => {
  const score = Number(inherentScore);
  const safeScore = isNaN(score) ? 0 : score;
  const reduction = EFFICACY_REDUCTION_MAP[effectiveness] ?? 0.50;
  return safeScore * (1 - reduction);
};
