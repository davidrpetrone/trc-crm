import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function FinancialInputsPage() {
  const qc = useQueryClient();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [localValues, setLocalValues] = useState({});
  const [saving, setSaving] = useState({});

  const { data: inputs = [], isLoading } = useQuery({
    queryKey: ['financial-inputs', year],
    queryFn: () => api.get(`/financial-inputs?year=${year}`).then(r => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: ({ month, target_revenue, prior_year_revenue }) =>
      api.put(`/financial-inputs/${year}/${month}`, { target_revenue, prior_year_revenue }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['financial-inputs', year] });
      setSaving(s => ({ ...s, [vars.month]: false }));
    },
    onError: (_, vars) => setSaving(s => ({ ...s, [vars.month]: false })),
  });

  function getVal(month, field) {
    const key = `${month}_${field}`;
    if (key in localValues) return localValues[key];
    const row = inputs.find(r => r.month === month);
    return row ? (row[field] || '') : '';
  }

  function setVal(month, field, value) {
    setLocalValues(v => ({ ...v, [`${month}_${field}`]: value }));
  }

  function isDirty(month) {
    return `${month}_target_revenue` in localValues || `${month}_prior_year_revenue` in localValues;
  }

  function saveRow(month) {
    if (!isDirty(month)) return;
    const target = parseFloat(getVal(month, 'target_revenue')) || 0;
    const prior = parseFloat(getVal(month, 'prior_year_revenue')) || 0;
    setSaving(s => ({ ...s, [month]: true }));
    saveMutation.mutate({ month, target_revenue: target, prior_year_revenue: prior });
  }

  const totalTarget = MONTHS.reduce((s, _, i) => s + (parseFloat(getVal(i + 1, 'target_revenue')) || 0), 0);
  const totalPrior = MONTHS.reduce((s, _, i) => s + (parseFloat(getVal(i + 1, 'prior_year_revenue')) || 0), 0);

  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

  return (
    <div className="rel-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Financial Inputs</h1>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Monthly revenue targets and prior year actuals — used as reference lines on Revenue Outlook
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>Year:</label>
          <select
            value={year}
            onChange={e => { setYear(Number(e.target.value)); setLocalValues({}); }}
            style={{ width: 100 }}
          >
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <p style={{ padding: 20, color: 'var(--text-muted)' }}>Loading...</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 80 }}>Month</th>
                <th>Revenue Target {year} ($)</th>
                <th>Prior Year Actuals {year - 1} ($)</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {MONTHS.map((label, i) => {
                const month = i + 1;
                return (
                  <tr key={month}>
                    <td style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: 13 }}>
                      {label}
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="10000"
                        placeholder="0"
                        value={getVal(month, 'target_revenue')}
                        onChange={e => setVal(month, 'target_revenue', e.target.value)}
                        onBlur={() => saveRow(month)}
                        style={{ maxWidth: 200 }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="10000"
                        placeholder="0"
                        value={getVal(month, 'prior_year_revenue')}
                        onChange={e => setVal(month, 'prior_year_revenue', e.target.value)}
                        onBlur={() => saveRow(month)}
                        style={{ maxWidth: 200 }}
                      />
                    </td>
                    <td>
                      {isDirty(month) && (
                        <button
                          className="btn-primary"
                          style={{ padding: '4px 12px', fontSize: 12 }}
                          disabled={saving[month]}
                          onClick={() => saveRow(month)}
                        >
                          {saving[month] ? '...' : 'Save'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              <tr style={{ borderTop: '2px solid var(--border)', background: 'var(--surface2)' }}>
                <td style={{ fontWeight: 700 }}>Total</td>
                <td style={{ fontWeight: 700, color: 'var(--gold)' }}>
                  {totalTarget > 0 ? '$' + Math.round(totalTarget).toLocaleString() : '—'}
                </td>
                <td style={{ fontWeight: 700, color: 'var(--text-muted)' }}>
                  {totalPrior > 0 ? '$' + Math.round(totalPrior).toLocaleString() : '—'}
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        )}
      </div>

      <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--text-muted)' }}>
        <strong style={{ color: 'var(--text)' }}>How these are used:</strong>
        <ul style={{ marginTop: 6, paddingLeft: 20, lineHeight: 1.8 }}>
          <li><span style={{ color: '#f85149' }}>— Target line</span> on Revenue Outlook shows your monthly revenue goal</li>
          <li><span style={{ color: '#8b949e' }}>— Prior year line</span> shows {year - 1} actuals for year-over-year comparison</li>
          <li>Values auto-save when you tab or click out of a field</li>
        </ul>
      </div>
    </div>
  );
}
