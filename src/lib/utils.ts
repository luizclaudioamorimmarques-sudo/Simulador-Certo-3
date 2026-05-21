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

export function getAchievementColor(percentage: number) {
  if (percentage < 80) return 'bg-red-100 text-red-600';
  if (percentage <= 99.999) return 'bg-yellow-100 text-yellow-700';
  return 'bg-green-100 text-green-600';
}

export function getAchievementTextColor(percentage: number) {
  if (percentage < 80) return 'text-red-600';
  if (percentage <= 99.999) return 'text-yellow-600';
  return 'text-green-600';
}
