/**
 * Generates a unique container number in the format: CNT-XXXXX
 * Example: CNT-12345
 */
export function generateContainerNumber(): string {
  const randomDigits = Math.floor(10000 + Math.random() * 90000);
  return `CNT-${randomDigits}`;
}

/**
 * Validates container space values
 */
export function validateContainerSpace(totalSpace: number, availableSpace: number): boolean {
  return availableSpace >= 0 && availableSpace <= totalSpace;
}

/**
 * Calculates utilization percentage
 */
export function calculateUtilization(totalSpace: number, availableSpace: number): number {
  if (totalSpace === 0) return 0;
  return ((totalSpace - availableSpace) / totalSpace) * 100;
}

/**
 * Determines container status based on space availability
 */
export function getContainerStatus(availableSpace: number): string {
  return availableSpace === 0 ? "allocated" : "available";
}
