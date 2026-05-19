import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isCurrencyProduct(productName?: string, block?: string, segment?: string) {
  if (!block) return false;
  if (block !== 'Conquista') return true;
  
  const name = productName?.toLowerCase() || '';
  const isPrevidencia = name.includes('previdência') || name.includes('previdencia');
  const isSpecialSegment = ['Especial', 'Select ONE', 'Select High'].includes(segment || '');
  
  if (isPrevidencia && isSpecialSegment) return true;
  
  return false;
}
