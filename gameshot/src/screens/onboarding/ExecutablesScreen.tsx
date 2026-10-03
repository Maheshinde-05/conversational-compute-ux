import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { Button } from '../../components/Button';
import { Checkbox } from '../../components/Checkbox';
import { DataTable, type Column } from '../../components/DataTable';
import { SearchBar } from '../../components/SearchBar';
import { StepDots } from '../../components/StepDots';
import { TextField } from '../../components/TextField';
import { executables, formatBytes, type Executable } from '../../data/mock';
import { useOnboarding } from '../../state/OnboardingContext';
import shared from './Onboarding.module.css';
import styles from './ExecutablesScreen.module.css';

export function ExecutablesScreen() {
  const navigate = useNavigate();
  const { selectedExecutables: selected, setSelectedExecutables, launchArguments, setLaunchArguments } = useOnboarding();
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? executables.filter((e) => `${e.name} ${e.type}`.toLowerCase().includes(q)) : executables;
  }, [query]);

  const allSelected = rows.length > 0 && rows.every((r) => selected.includes(r.id));
  const someSelected = rows.some((r) => selected.includes(r.id));

  const toggle = (id: string, on: boolean) =>
    setSelectedExecutables(on ? [...selected, id] : selected.filter((s) => s !== id));

  const toggleAll = (on: boolean) =>
    setSelectedExecutables(on ? Array.from(new Set([...selected, ...rows.map((r) => r.id)])) : selected.filter((s) => !rows.some((r) => r.id === s)));

  const columns: Column<Executable>[] = [
    { key: 'name', header: 'File name', sortValue: (r) => r.name, render: (r) => <a href="#" className={styles.link} onClick={(e) => e.preventDefault()}>{r.name}</a> },
    { key: 'type', header: 'Type', sortValue: (r) => r.type, render: (r) => r.type },
    { key: 'size', header: 'Size', sortValue: (r) => r.sizeBytes, render: (r) => formatBytes(r.sizeBytes) },
  ];

  return (
    <AppShell showNav={false}>
      <div className={`${shared.page} ${shared.narrow}`}>
        <h1 className={shared.title}>Tell us how to run your files</h1>
        <p className={shared.subtitle}>
          Select game build executable and tell us how to run this. Path to executable under the ZIP, and arguments.
        </p>

        <span className={shared.sectionLabel}>Select executables</span>

        <div className={styles.tableCard}>
          <h2 className={styles.tableTitle}>Folders/files ({executables.length})</h2>
          <div className={styles.search}>
            <SearchBar value={query} onChange={setQuery} placeholder="Search by file name, type" width={508} />
          </div>
          <DataTable
            caption="Executables"
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            leading={{
              header: <Checkbox label="Select all" checked={allSelected} indeterminate={someSelected && !allSelected} onChange={toggleAll} />,
              cell: (r) => <Checkbox label={`Select ${r.name}`} checked={selected.includes(r.id)} onChange={(on) => toggle(r.id, on)} />,
            }}
          />
          <div className={styles.addCustom}>
            {/* TODO(design): flow for adding a custom executable path isn't designed yet. */}
            <Button variant="text" size="sm">
              <Plus size={18} aria-hidden />
              Add custom executables
            </Button>
          </div>
        </div>

        <span className={shared.sectionLabel}>Define arguments</span>
        <div className={styles.argsCard}>
          <TextField label="Launch arguments" multiline value={launchArguments} onChange={setLaunchArguments} />
        </div>

        <div className={shared.footer}>
          <Button size="lg" className={shared.continue} disabled={selected.length === 0} onClick={() => navigate('/onboarding/compute')}>
            Continue
          </Button>
          <StepDots total={3} current={1} />
        </div>
      </div>
    </AppShell>
  );
}
