import { Search } from 'lucide-react';
import styles from './SearchBar.module.css';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  width?: number;
}

export function SearchBar({ value, onChange, placeholder, width }: SearchBarProps) {
  return (
    <label className={styles.bar} style={width ? { maxWidth: width } : undefined}>
      <Search size={20} aria-hidden className={styles.icon} />
      <span className="visually-hidden">{placeholder}</span>
      <input
        type="search"
        className={styles.input}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
