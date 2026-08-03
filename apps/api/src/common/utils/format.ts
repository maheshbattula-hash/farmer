export function formatDateOnly(value?: Date | null): string {
  if (!value) {
    return '';
  }
  return value.toISOString().slice(0, 10);
}

export function formatDateTime(value?: Date | null): string {
  if (!value) {
    return '';
  }
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  const hours = String(value.getHours()).padStart(2, '0');
  const minutes = String(value.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}
