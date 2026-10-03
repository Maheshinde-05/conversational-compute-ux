import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDownUp } from 'lucide-react';
import styles from './DataTable.module.css';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Provide to make the column sortable. */
  sortValue?: (row: T) => string | number;
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Optional leading checkbox column, rendered by caller. */
  leading?: { header: ReactNode; cell: (row: T) => ReactNode };
  caption?: string;
}

export function DataTable<T>({ columns, rows, rowKey, leading, caption }: DataTableProps<T>) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    return [...rows].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      return (av > bv ? 1 : av < bv ? -1 : 0) * sort.dir;
    });
  }, [rows, columns, sort]);

  const toggle = (key: string) =>
    setSort((s) => (s?.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));

  return (
    <div className={styles.scroll}>
      <table className={styles.table}>
        {caption && <caption className="visually-hidden">{caption}</caption>}
        <thead>
          <tr>
            {leading && <th className={styles.leading}>{leading.header}</th>}
            {columns.map((c) => (
              <th
                key={c.key}
                style={c.width ? { width: c.width } : undefined}
                aria-sort={sort?.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}
              >
                {c.sortValue ? (
                  <button type="button" className={styles.sortBtn} onClick={() => toggle(c.key)}>
                    {c.header}
                    <ArrowDownUp size={16} aria-hidden />
                  </button>
                ) : (
                  c.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={rowKey(r)}>
              {leading && <td className={styles.leading}>{leading.cell(r)}</td>}
              {columns.map((c) => (
                <td key={c.key}>{c.render(r)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
