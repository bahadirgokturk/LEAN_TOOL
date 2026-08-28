export const S5_STORAGE_LIMIT_BYTES = 1_000_000_000;

export type S5StorageUsage = {
  usedBytes: number;
  limitBytes: number;
  percent: number;
  photoCount: number;
  auditCount: number;
};

/** Keeps the UI percentage finite and inside the progress-bar range. */
export function createStorageUsage(
  usedBytes: unknown,
  photoCount: unknown,
  auditCount: unknown
): S5StorageUsage {
  const used = Math.max(0, Number(usedBytes) || 0);
  const percent = Math.min(100, Math.max(0, (used / S5_STORAGE_LIMIT_BYTES) * 100));

  return {
    usedBytes: used,
    limitBytes: S5_STORAGE_LIMIT_BYTES,
    percent: Number(percent.toFixed(1)),
    photoCount: Math.max(0, Number(photoCount) || 0),
    auditCount: Math.max(0, Number(auditCount) || 0),
  };
}
