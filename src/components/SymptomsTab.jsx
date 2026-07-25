import React, { useState } from 'react';
import { Plus, Trash2, X, TrendingUp, Thermometer, AlertCircle } from 'lucide-react';

const COMMON_SYMPTOMS = [
  'Headache', 'Fever', 'Fatigue', 'Nausea', 'Cough', 'Shortness of breath',
  'Chest pain', 'Dizziness', 'Back pain', 'Joint pain', 'Stomach pain', 'Vomiting',
  'Sore throat', 'Runny nose', 'Rash', 'Anxiety', 'Insomnia', 'Loss of appetite'
];

function SeveritySlider({ value, onChange }) {
  const color = value >= 8 ? 'var(--danger)' : value >= 5 ? 'var(--warning)' : 'var(--success)';
  const label = value >= 8 ? 'Severe' : value >= 5 ? 'Moderate' : 'Mild';
  return (
    <div className="form-group">
      <label style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Severity</span>
        <span style={{ fontWeight: 700, color }}>{value}/10 — {label}</span>
      </label>
      <input
        type="range"
        min="1"
        max="10"
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="severity-slider"
        style={{ '--slider-color': color }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
        <span>1 · Barely noticeable</span>
        <span>10 · Emergency</span>
      </div>
    </div>
  );
}

function LogSymptomForm({ onLog, onClose }) {
  const [symptom, setSymptom] = useState('');
  const [severity, setSeverity] = useState(3);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!symptom.trim()) return;
    setSubmitting(true);
    await onLog({ symptom: symptom.trim(), severity, notes: notes.trim() });
    setSubmitting(false);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-sheet modal-sheet-sm">
        <div className="modal-header">
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Log Symptom</h2>
          <button type="button" className="btn btn-ghost" style={{ padding: '8px', minHeight: '40px' }} onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label>Symptom</label>
            <input
              type="text"
              placeholder="Describe your symptom..."
              value={symptom}
              onChange={e => setSymptom(e.target.value)}
              required
              autoFocus
            />
            <div className="chip-row">
              {COMMON_SYMPTOMS.map(s => (
                <button
                  key={s}
                  type="button"
                  className={`chip ${symptom === s ? 'chip-active' : ''}`}
                  onClick={() => setSymptom(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <SeveritySlider value={severity} onChange={setSeverity} />

          <div className="form-group">
            <label>Notes (optional)</label>
            <textarea
              rows={3}
              placeholder="Duration, triggers, other context..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              style={{ resize: 'vertical' }}
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={submitting}>
            <TrendingUp size={16} />
            {submitting ? 'Saving...' : 'Log Symptom'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function SymptomsTab({ symptoms, onLogSymptom, onDeleteSymptom }) {
  const [showForm, setShowForm] = useState(false);

  const formatDate = (ts) => {
    if (!ts) return '';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) +
      ' · ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  const getSeverityColor = (s) => s >= 8 ? 'danger' : s >= 5 ? 'warning' : 'success';
  const getSeverityLabel = (s) => s >= 8 ? 'Severe' : s >= 5 ? 'Moderate' : 'Mild';

  return (
    <div>
      {showForm && (
        <LogSymptomForm
          onLog={onLogSymptom}
          onClose={() => setShowForm(false)}
        />
      )}

      <div className="flex-between" style={{ marginBottom: '16px' }}>
        <h2 className="section-title" style={{ marginBottom: 0 }}>
          <TrendingUp style={{ color: 'var(--warning)' }} />
          Symptom Log
        </h2>
        <button className="btn btn-primary" style={{ padding: '10px 16px', minHeight: '42px', fontSize: '0.875rem' }} onClick={() => setShowForm(true)}>
          <Plus size={16} /> Log
        </button>
      </div>

      {symptoms.length === 0 ? (
        <div className="empty-state">
          <Thermometer size={48} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
          <h3>No symptoms logged yet</h3>
          <p>Track your symptoms over time to spot patterns and share them with your doctor.</p>
          <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={() => setShowForm(true)}>
            <Plus size={16} /> Log Your First Symptom
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {symptoms.map(s => (
            <div key={s.id} className="card symptom-card" style={{ borderLeft: `4px solid var(--${getSeverityColor(s.severity)})`, marginBottom: 0 }}>
              <div className="flex-between" style={{ alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '4px' }}>{s.symptom}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>{formatDate(s.loggedAt)}</div>
                  {s.notes && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-sidebar)', padding: '8px 10px', borderRadius: '8px', marginBottom: '6px' }}>
                      {s.notes}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginLeft: '12px' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: `var(--${getSeverityColor(s.severity)})`, lineHeight: 1 }}>{s.severity}</div>
                    <div style={{ fontSize: '0.65rem', color: `var(--${getSeverityColor(s.severity)})`, fontWeight: 600 }}>{getSeverityLabel(s.severity)}</div>
                  </div>
                  <button className="btn btn-ghost" style={{ padding: '6px', minHeight: '36px', color: 'var(--danger)' }} onClick={() => onDeleteSymptom(s.id)}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export { LogSymptomForm };
