export interface DirtyCheckable {
  isDirty(): boolean;
}

// Allows a clean sheet to close directly and confirms before discarding dirty work.
export function confirmDiscardIfDirty(sheet: DirtyCheckable, prompt: string): boolean {
  return !sheet.isDirty() || confirm(prompt);
}
