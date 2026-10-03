import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/Button';
import { Checkbox } from '../../components/Checkbox';
import { DataTable, type Column } from '../../components/DataTable';
import { SearchBar } from '../../components/SearchBar';
import { sessions, versions as seedVersions, type BuildVersion } from '../../data/mock';
import { useOnboarding } from '../../state/OnboardingContext';
import styles from './Build.module.css';

export function VersionsTab() {
  const navigate = useNavigate();
  const { buildId = '' } = useParams();
  const { build } = useOnboarding();

  // Seed from the Create build modal when we came through onboarding.
  const initial = useMemo<BuildVersion[]>(
    () =>
      build
        ? [{ id: 'v1', version: build.version, tags: build.tags || 'Production', lastUpdated: new Date().toLocaleDateString('en-US') }]
        : seedVersions,
    [build],
  );
  const [rows, setRows] = useState(initial);
  const [selected, setSelected] = useState<string[]>(initial.map((r) => r.id));
  const [query, setQuery] = useState('');

  const filtered = rows.filter((r) => `${r.version} ${r.tags}`.toLowerCase().includes(query.trim().toLowerCase()));
  const all = filtered.length > 0 && filtered.every((r) => selected.includes(r.id));
  const some = filtered.some((r) => selected.includes(r.id));

  const columns: Column<BuildVersion>[] = [
    { key: 'version', header: 'Version', sortValue: (r) => r.version, render: (r) => r.version, width: '35%' },
    { key: 'tags', header: 'Tags', sortValue: (r) => r.tags, render: (r) => r.tags, width: '30%' },
    { key: 'updated', header: 'Last updated', sortValue: (r) => r.lastUpdated, render: (r) => r.lastUpdated },
  ];

  return (
    <section aria-labelledby="versions-title">
      <div className={styles.toolbar}>
        <h2 id="versions-title">Versions (#{String(rows.length).padStart(2, '0')})</h2>
        <div className={styles.toolbarActions}>
          <Button variant="neutral" disabled={selected.length === 0} onClick={() => { setRows((r) => r.filter((x) => !selected.includes(x.id))); setSelected([]); }}>
            Delete
          </Button>
          {/* TODO(design): Create version / Deploy to a game flows aren't designed yet. */}
          <Button variant="neutral">Create version</Button>
          <Button
            variant="neutral"
            disabled={selected.length !== 1}
            title={selected.length !== 1 ? 'Select exactly one version' : undefined}
            onClick={() => navigate(`/builds/${encodeURIComponent(buildId)}/sessions/${sessions[0].id}`)}
          >
            Run game session
          </Button>
          <Button variant="neutral">Deploy to a game</Button>
        </div>
      </div>
      <div className={styles.searchRow}>
        <SearchBar value={query} onChange={setQuery} placeholder="Search by build name, version, tags.." width={567} />
      </div>
      <DataTable
        caption="Build versions"
        columns={columns}
        rows={filtered}
        rowKey={(r) => r.id}
        leading={{
          header: (
            <Checkbox
              label="Select all versions"
              checked={all}
              indeterminate={some && !all}
              onChange={(on) => setSelected(on ? filtered.map((r) => r.id) : [])}
            />
          ),
          cell: (r) => (
            <Checkbox
              label={`Select version ${r.version}`}
              checked={selected.includes(r.id)}
              onChange={(on) => setSelected((s) => (on ? [...s, r.id] : s.filter((x) => x !== r.id)))}
            />
          ),
        }}
      />
    </section>
  );
}
