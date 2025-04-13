export function intColor(intensity?: string): number {
  if (!intensity) return 0;
  
  if (intensity === '7') return 9;
  if (intensity === '6+') return 8;
  if (intensity === '6-') return 7;
  if (intensity === '5+') return 6;
  if (intensity === '5-') return 5;
  if (intensity === '4') return 4;
  if (intensity === '3') return 3;
  if (intensity === '2') return 2;
  if (intensity === '1') return 1;
  
  return 0;
}
