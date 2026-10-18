/**
 * Accession numbers for orders made in the admin panel, in the lab station's format
 * (LAB-YYYYMMDD-NNN, lib/station/store nextAccession): the next number of the day, counted in
 * the database inside the insert itself. `p` is the SQL placeholder holding accessionPrefix().
 */
export function accessionPrefix(d = new Date()): string {
  return `LAB-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-`;
}
export const accessionSql = (p: string) =>
  `(${p}::text || lpad((coalesce((select max(substr(accession_no, length(${p}::text) + 1)::int) from test_orders
     where accession_no like ${p}::text || '%' and substr(accession_no, length(${p}::text) + 1) ~ '^[0-9]{1,9}$'), 0) + 1)::text, 3, '0'))`;
