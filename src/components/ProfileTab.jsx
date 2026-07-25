import React, { useState } from 'react';
import { X, Plus, Trash2, User, Droplets, Scale, Moon, Heart, AlertTriangle, Pill, Syringe, Scissors, Users, ChevronDown, ChevronUp, Save } from 'lucide-react';

// ─── Small Reusable Controls ────────────────────────────────────────────────

function FormSection({ title, icon: Icon, color = 'primary', defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="form-section">
      <button type="button" className="form-section-header" onClick={() => setOpen(o => !o)}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '1rem' }}>
          <Icon size={18} style={{ color: `var(--${color})` }} /> {title}
        </span>
        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
      {open && <div className="form-section-body">{children}</div>}
    </div>
  );
}

function TagEditor({ label, items, onChange, placeholder }) {
  const [input, setInput] = useState('');
  const add = () => {
    const v = input.trim();
    if (v && !items.includes(v)) { onChange([...items, v]); setInput(''); }
  };
  return (
    <div className="form-group">
      <label>{label}</label>
      <div className="tag-input-row">
        <input type="text" value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder={placeholder || `Add ${label.toLowerCase()} and press Enter`} />
        <button type="button" className="btn btn-primary" style={{ minWidth: '44px', minHeight: '44px', padding: '0' }} onClick={add}>
          <Plus size={18} />
        </button>
      </div>
      <div className="tag-list" style={{ marginTop: '8px' }}>
        {items.map((item, i) => (
          <span key={i} className="tag tag-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            {item}
            <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0', lineHeight: 1, color: 'inherit' }}>
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

function MedicationEditor({ label, items, onChange, past = false }) {
  const [form, setForm] = useState({ name: '', dose: '', frequency: '', since: '', from: '', to: '', reason: '' });
  const add = () => {
    if (!form.name.trim()) return;
    onChange([...items, { ...form }]);
    setForm({ name: '', dose: '', frequency: '', since: '', from: '', to: '', reason: '' });
  };
  return (
    <div className="form-group">
      <label>{label}</label>
      <div className="subform-grid">
        <input type="text" placeholder="Medication name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        <input type="text" placeholder="Dose (e.g. 500mg)" value={form.dose} onChange={e => setForm(f => ({ ...f, dose: e.target.value }))} />
        <input type="text" placeholder="Frequency (e.g. twice daily)" value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))} />
        {!past ? (
          <input type="text" placeholder="Since (e.g. Jan 2024)" value={form.since} onChange={e => setForm(f => ({ ...f, since: e.target.value }))} />
        ) : (
          <>
            <input type="text" placeholder="Reason / Condition" value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} />
            <input type="date" placeholder="From" value={form.from} onChange={e => setForm(f => ({ ...f, from: e.target.value }))} />
            <input type="date" placeholder="To" value={form.to} onChange={e => setForm(f => ({ ...f, to: e.target.value }))} />
          </>
        )}
      </div>
      <button type="button" className="btn btn-secondary" style={{ marginTop: '8px', fontSize: '0.85rem', minHeight: '40px' }} onClick={add}>
        <Plus size={14} /> Add {label.includes('Past') ? 'Past' : 'Current'} Medication
      </button>
      <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {items.map((med, i) => (
          <div key={i} className="list-item-row">
            <div>
              <span style={{ fontWeight: 600 }}>{med.name}</span>
              {med.dose && <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}> · {med.dose}</span>}
              {med.frequency && <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}> · {med.frequency}</span>}
              {past && med.from && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}> ({med.from} – {med.to})</span>}
            </div>
            <button type="button" className="btn btn-ghost" style={{ padding: '4px', minHeight: '32px', color: 'var(--danger)' }}
              onClick={() => onChange(items.filter((_, j) => j !== i))}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SurgeryEditor({ items, onChange }) {
  const [form, setForm] = useState({ name: '', year: '', notes: '' });
  const add = () => {
    if (!form.name.trim()) return;
    onChange([...items, { ...form }]);
    setForm({ name: '', year: '', notes: '' });
  };
  return (
    <div className="form-group">
      <label>Surgeries / Procedures</label>
      <div className="subform-grid">
        <input type="text" placeholder="Procedure name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        <input type="text" placeholder="Year (e.g. 2018)" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} />
        <input type="text" placeholder="Notes (optional)" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
      </div>
      <button type="button" className="btn btn-secondary" style={{ marginTop: '8px', fontSize: '0.85rem', minHeight: '40px' }} onClick={add}>
        <Plus size={14} /> Add Surgery
      </button>
      <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {items.map((s, i) => (
          <div key={i} className="list-item-row">
            <div>
              <span style={{ fontWeight: 600 }}>{s.name}</span>
              {s.year && <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}> · {s.year}</span>}
              {s.notes && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{s.notes}</div>}
            </div>
            <button type="button" className="btn btn-ghost" style={{ padding: '4px', minHeight: '32px', color: 'var(--danger)' }}
              onClick={() => onChange(items.filter((_, j) => j !== i))}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function VaccinationEditor({ items, onChange }) {
  const [form, setForm] = useState({ name: '', date: '', nextDue: '' });
  const add = () => {
    if (!form.name.trim()) return;
    onChange([...items, { ...form }]);
    setForm({ name: '', date: '', nextDue: '' });
  };
  return (
    <div className="form-group">
      <label>Vaccinations</label>
      <div className="subform-grid">
        <input type="text" placeholder="Vaccine name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        <input type="date" placeholder="Date given" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
        <input type="date" placeholder="Next due date (optional)" value={form.nextDue} onChange={e => setForm(f => ({ ...f, nextDue: e.target.value }))} />
      </div>
      <button type="button" className="btn btn-secondary" style={{ marginTop: '8px', fontSize: '0.85rem', minHeight: '40px' }} onClick={add}>
        <Plus size={14} /> Add Vaccination
      </button>
      <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {items.map((v, i) => (
          <div key={i} className="list-item-row">
            <div>
              <span style={{ fontWeight: 600 }}>{v.name}</span>
              {v.date && <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}> · {v.date}</span>}
              {v.nextDue && <span style={{ color: 'var(--primary)', fontSize: '0.8rem' }}> · Next: {v.nextDue}</span>}
            </div>
            <button type="button" className="btn btn-ghost" style={{ padding: '4px', minHeight: '32px', color: 'var(--danger)' }}
              onClick={() => onChange(items.filter((_, j) => j !== i))}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Profile Edit Modal ─────────────────────────────────────────────────

export default function ProfileTab({ profile, saving, onSave, onClose }) {
  const [form, setForm] = useState({ ...profile });

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-sheet">
        {/* Header */}
        <div className="modal-header">
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Edit Health Profile</h2>
          <button type="button" className="btn btn-ghost" style={{ padding: '8px', minHeight: '40px' }} onClick={onClose}>
            <X size={22} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">

          {/* ── Basic Info ────────────────────────────────────── */}
          <FormSection title="Basic Information" icon={User} color="primary">
            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <input id="name" type="text" placeholder="Your name" value={form.name || ''} onChange={e => set('name', e.target.value)} />
            </div>
            <div className="subform-grid">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="dob">Date of Birth</label>
                <input id="dob" type="date" value={form.dateOfBirth || ''} onChange={e => set('dateOfBirth', e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="gender">Gender</label>
                <select id="gender" value={form.gender || ''} onChange={e => set('gender', e.target.value)}>
                  <option value="">Select</option>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Non-binary</option>
                  <option>Prefer not to say</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="bloodType">Blood Type</label>
                <select id="bloodType" value={form.bloodType || ''} onChange={e => set('bloodType', e.target.value)}>
                  <option value="">Select</option>
                  {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="height">Height (cm)</label>
                <input id="height" type="number" placeholder="e.g. 172" value={form.height || ''} onChange={e => set('height', e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="weight">Weight (kg)</label>
                <input id="weight" type="number" placeholder="e.g. 70" value={form.weight || ''} onChange={e => set('weight', e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="emergency">Emergency Contact</label>
                <input id="emergency" type="text" placeholder="Name & phone" value={form.emergencyContact || ''} onChange={e => set('emergencyContact', e.target.value)} />
              </div>
            </div>
          </FormSection>

          {/* ── Allergies ─────────────────────────────────────── */}
          <FormSection title="Allergies" icon={AlertTriangle} color="danger">
            <TagEditor label="Known Allergies" items={form.allergies || []} onChange={v => set('allergies', v)} placeholder="e.g. Penicillin, Peanuts" />
          </FormSection>

          {/* ── Conditions ────────────────────────────────────── */}
          <FormSection title="Medical Conditions" icon={Heart} color="primary" defaultOpen={false}>
            <TagEditor label="Active Conditions" items={form.conditions || []} onChange={v => set('conditions', v)} placeholder="e.g. Type 2 Diabetes" />
          </FormSection>

          {/* ── Medications ───────────────────────────────────── */}
          <FormSection title="Current Medications" icon={Pill} color="success" defaultOpen={false}>
            <MedicationEditor label="Current Medications" items={form.currentMedications || []} onChange={v => set('currentMedications', v)} />
          </FormSection>

          <FormSection title="Past Medications" icon={Pill} color="warning" defaultOpen={false}>
            <MedicationEditor label="Past Medications" items={form.pastMedications || []} onChange={v => set('pastMedications', v)} past />
          </FormSection>

          {/* ── Vaccinations ──────────────────────────────────── */}
          <FormSection title="Vaccinations" icon={Syringe} color="primary" defaultOpen={false}>
            <VaccinationEditor items={form.vaccinations || []} onChange={v => set('vaccinations', v)} />
          </FormSection>

          {/* ── Surgeries ─────────────────────────────────────── */}
          <FormSection title="Surgeries & Procedures" icon={Scissors} color="warning" defaultOpen={false}>
            <SurgeryEditor items={form.surgeries || []} onChange={v => set('surgeries', v)} />
          </FormSection>

          {/* ── Family History ────────────────────────────────── */}
          <FormSection title="Family History" icon={Users} color="primary" defaultOpen={false}>
            <TagEditor label="Family Health Conditions" items={form.familyHistory || []} onChange={v => set('familyHistory', v)} placeholder='e.g. Heart Disease (Father)' />
          </FormSection>

          {/* ── Lifestyle ─────────────────────────────────────── */}
          <FormSection title="Lifestyle" icon={Moon} color="success" defaultOpen={false}>
            <div className="subform-grid">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Avg Sleep (hours/night)</label>
                <input type="number" min="1" max="24" placeholder="e.g. 7" value={form.averageSleepHours || ''} onChange={e => set('averageSleepHours', e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Smoking Status</label>
                <select value={form.smokingStatus || ''} onChange={e => set('smokingStatus', e.target.value)}>
                  <option value="">Select</option>
                  <option>Never smoked</option>
                  <option>Former smoker</option>
                  <option>Current smoker</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Alcohol Consumption</label>
                <select value={form.alcoholConsumption || ''} onChange={e => set('alcoholConsumption', e.target.value)}>
                  <option value="">Select</option>
                  <option>None</option>
                  <option>Occasional</option>
                  <option>Moderate</option>
                  <option>Heavy</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Exercise Frequency</label>
                <select value={form.exerciseFrequency || ''} onChange={e => set('exerciseFrequency', e.target.value)}>
                  <option value="">Select</option>
                  <option>Sedentary</option>
                  <option>1-2x / week</option>
                  <option>3-4x / week</option>
                  <option>5+ times / week</option>
                  <option>Daily</option>
                </select>
              </div>
            </div>
          </FormSection>

          {/* ── Save Button ────────────────────────────────────── */}
          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '16px', marginBottom: '24px' }} disabled={saving}>
            <Save size={18} />
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </div>
    </div>
  );
}
