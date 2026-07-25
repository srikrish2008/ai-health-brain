import React, { useState } from 'react';
import { Plus, Trash2, X, Stethoscope, ClipboardList } from 'lucide-react';

const SPECIALTIES = [
  'General Physician', 'Cardiologist', 'Dermatologist', 'Neurologist',
  'Orthopedic', 'Pediatrician', 'Psychiatrist', 'Gynecologist',
  'Ophthalmologist', 'ENT Specialist', 'Endocrinologist', 'Gastroenterologist',
  'Urologist', 'Oncologist', 'Pulmonologist', 'Dentist', 'Physiotherapist'
];

function LogVisitForm({ onLog, onClose }) {
  const [form, setForm] = useState({
    doctorName: '',
    specialty: '',
    visitDate: new Date().toISOString().split('T')[0],
    reason: '',
    diagnosis: '',
    prescriptions: '',
    recommendations: '',
    nextVisit: '',
    notes: '',
    clinicName: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    await onLog(form);
    setSubmitting(false);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-sheet">
        <div className="modal-header">
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Log Doctor Visit</h2>
          <button type="button" className="btn btn-ghost" style={{ padding: '8px', minHeight: '40px' }} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="subform-grid">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Doctor Name</label>
              <input type="text" placeholder="Dr. Smith" value={form.doctorName} onChange={e => set('doctorName', e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Specialty</label>
              <select value={form.specialty} onChange={e => set('specialty', e.target.value)}>
                <option value="">Select specialty</option>
                {SPECIALTIES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Visit Date *</label>
              <input type="date" value={form.visitDate} onChange={e => set('visitDate', e.target.value)} required />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Clinic / Hospital Name</label>
              <input type="text" placeholder="e.g. Apollo Hospital" value={form.clinicName} onChange={e => set('clinicName', e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label>Reason for Visit *</label>
            <input type="text" placeholder="e.g. Chest pain, routine checkup..." value={form.reason} onChange={e => set('reason', e.target.value)} required />
          </div>

          <div className="form-group">
            <label>Diagnosis</label>
            <input type="text" placeholder="What was diagnosed?" value={form.diagnosis} onChange={e => set('diagnosis', e.target.value)} />
          </div>

          <div className="form-group">
            <label>Prescriptions</label>
            <textarea rows={2} placeholder="Medications prescribed (comma-separated)" value={form.prescriptions} onChange={e => set('prescriptions', e.target.value)} style={{ resize: 'vertical' }} />
          </div>

          <div className="form-group">
            <label>Doctor's Recommendations</label>
            <textarea rows={2} placeholder="Lifestyle advice, follow-up tests, etc." value={form.recommendations} onChange={e => set('recommendations', e.target.value)} style={{ resize: 'vertical' }} />
          </div>

          <div className="form-group">
            <label>Next Visit Date</label>
            <input type="date" value={form.nextVisit} onChange={e => set('nextVisit', e.target.value)} />
          </div>

          <div className="form-group">
            <label>Personal Notes</label>
            <textarea rows={2} placeholder="Anything else to remember..." value={form.notes} onChange={e => set('notes', e.target.value)} style={{ resize: 'vertical' }} />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginBottom: '16px' }} disabled={submitting}>
            <Stethoscope size={16} />
            {submitting ? 'Saving...' : 'Save Visit'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function VisitsTab({ visits, onLogVisit, onDeleteVisit }) {
  const [showForm, setShowForm] = useState(false);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <div>
      {showForm && (
        <LogVisitForm
          onLog={onLogVisit}
          onClose={() => setShowForm(false)}
        />
      )}

      <div className="flex-between" style={{ marginBottom: '16px' }}>
        <h2 className="section-title" style={{ marginBottom: 0 }}>
          <Stethoscope style={{ color: 'var(--primary)' }} />
          Doctor Visits
        </h2>
        <button className="btn btn-primary" style={{ padding: '10px 16px', minHeight: '42px', fontSize: '0.875rem' }} onClick={() => setShowForm(true)}>
          <Plus size={16} /> Log Visit
        </button>
      </div>

      {visits.length === 0 ? (
        <div className="empty-state">
          <ClipboardList size={48} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
          <h3>No visits recorded</h3>
          <p>Log your doctor visits to keep a medical history of appointments, diagnoses, and prescriptions.</p>
          <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={() => setShowForm(true)}>
            <Plus size={16} /> Log First Visit
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {visits.map(v => (
            <div key={v.id} className="card visit-card" style={{ marginBottom: 0, borderLeft: '4px solid var(--primary)' }}>
              <div className="flex-between" style={{ alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>{v.doctorName || 'Doctor Visit'}</div>
                  {v.specialty && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600, marginBottom: '4px' }}>{v.specialty}</div>
                  )}
                  {v.clinicName && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{v.clinicName}</div>
                  )}
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>{formatDate(v.visitDate)}</div>

                  {v.reason && (
                    <div style={{ marginBottom: '6px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Reason</span>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{v.reason}</div>
                    </div>
                  )}

                  {v.diagnosis && (
                    <div style={{ marginBottom: '6px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Diagnosis</span>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 600 }}>{v.diagnosis}</div>
                    </div>
                  )}

                  {v.prescriptions && (
                    <div style={{ marginBottom: '6px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Prescriptions</span>
                      <div style={{ fontSize: '0.875rem', backgroundColor: 'var(--success-light)', padding: '6px 10px', borderRadius: '8px', color: 'var(--success-hover)' }}>{v.prescriptions}</div>
                    </div>
                  )}

                  {v.recommendations && (
                    <div style={{ marginBottom: '6px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Recommendations</span>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{v.recommendations}</div>
                    </div>
                  )}

                  {v.nextVisit && (
                    <div style={{ marginTop: '6px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 600, backgroundColor: 'var(--primary-light)', color: 'var(--primary-hover)', padding: '4px 10px', borderRadius: '999px' }}>
                      📅 Next visit: {formatDate(v.nextVisit)}
                    </div>
                  )}
                </div>

                <button className="btn btn-ghost" style={{ padding: '6px', minHeight: '36px', color: 'var(--danger)', flexShrink: 0, marginLeft: '8px' }} onClick={() => onDeleteVisit(v.id)}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export { LogVisitForm };
