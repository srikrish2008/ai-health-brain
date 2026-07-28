import React, { useState, useMemo } from 'react';
import {
  Heart, Shield, Pill, Activity, AlertTriangle, ChevronRight,
  Calendar, Stethoscope, Moon, Scale, Droplets, Syringe,
  Users, Scissors, Clock, TrendingUp, Plus
} from 'lucide-react';

function StatCard({ icon: Icon, label, value, color = 'primary', onClick }) {
  return (
    <div
      className="stat-card"
      style={{ cursor: onClick ? 'pointer' : 'default', borderLeft: `4px solid var(--${color})` }}
      onClick={onClick}
    >
      <div className="stat-icon" style={{ backgroundColor: `var(--${color}-light)`, color: `var(--${color})` }}>
        <Icon size={18} />
      </div>
      <div>
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value || '—'}</div>
      </div>
    </div>
  );
}

function TagList({ items, color = 'primary', emptyText = 'None recorded' }) {
  if (!items || items.length === 0) {
    return <span className="text-muted" style={{ fontSize: '0.85rem' }}>{emptyText}</span>;
  }
  return (
    <div className="tag-list">
      {items.map((item, i) => (
        <span key={i} className={`tag tag-${color}`}>
          {typeof item === 'string' ? item : item.name}
        </span>
      ))}
    </div>
  );
}

function SectionCard({ title, icon: Icon, children, color = 'primary', onEdit }) {
  return (
    <div className="card" style={{ marginBottom: '12px' }}>
      <div className="flex-between" style={{ marginBottom: '12px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: 700 }}>
          <Icon size={18} style={{ color: `var(--${color})` }} />
          {title}
        </h3>
        {onEdit && (
          <button className="btn btn-ghost" style={{ padding: '4px 10px', minHeight: '32px', fontSize: '0.8rem' }} onClick={onEdit}>
            Edit
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

export default function HomeTab({ profile, symptoms, visits, vitals = [], onEditProfile, onAddSymptom, onAddVisit, onOpenMedications, onOpenVitals, onOpenEmergency }) {
  const recentSymptoms = useMemo(() => symptoms.slice(0, 3), [symptoms]);
  const recentVisits = useMemo(() => visits.slice(0, 3), [visits]);

  const formatDate = (ts) => {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getSeverityColor = (severity) => {
    if (severity >= 8) return 'danger';
    if (severity >= 5) return 'warning';
    return 'success';
  };

  if (!profile) return null;

  const age = profile.dateOfBirth
    ? Math.floor((Date.now() - new Date(profile.dateOfBirth)) / (365.25 * 24 * 3600 * 1000))
    : null;

  return (
    <div>
      {/* Welcome Banner */}
      <div className="welcome-banner">
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '2px' }}>
            {profile.name ? `Hello, ${profile.name.split(' ')[0]} 👋` : 'Welcome to AI Health Brain'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            {age ? `${age} years old · ` : ''}{profile.bloodType ? `Blood Type ${profile.bloodType} · ` : ''}
            {profile.gender || ''}
          </p>
        </div>
        <button className="btn btn-primary" style={{ padding: '10px 16px', minHeight: '40px', fontSize: '0.85rem' }} onClick={onEditProfile}>
          Edit Profile
        </button>
      </div>

      {/* Quick Emergency ID & Doctor Export Banner */}
      <div
        onClick={onOpenEmergency}
        style={{
          background: 'linear-gradient(135deg, #1e293b 0%, #090d16 100%)',
          border: '2px solid #dc2626',
          borderRadius: '16px',
          padding: '14px 18px',
          marginBottom: '20px',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: '#fff',
          boxShadow: '0 6px 16px rgba(220, 38, 38, 0.18)',
          transition: 'all 0.2s ease'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 900, flexShrink: 0 }}>
            🆘
          </div>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff' }}>Emergency Medical ID & Doctor Report Export</div>
            <div style={{ fontSize: '0.8rem', color: '#fca5a5', fontWeight: 500 }}>Instant high-contrast lockscreen tag & printable clinical consultation reports</div>
          </div>
        </div>
        <button type="button" style={{ backgroundColor: '#dc2626', color: '#fff', padding: '8px 14px', borderRadius: '8px', border: 'none', fontSize: '0.825rem', fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}>
          Open Card ➔
        </button>
      </div>

      {/* Quick Stats Row */}
      <div className="stats-grid">
        <StatCard icon={Scale} label="Weight" value={profile.weight ? `${profile.weight} kg` : null} color="primary" />
        <StatCard icon={Moon} label="Sleep" value={profile.averageSleepHours ? `${profile.averageSleepHours}h / night` : null} color="success" />
        <StatCard icon={Activity} label="Symptoms" value={`${symptoms.length} logged`} color="warning" onClick={onAddSymptom} />
        <StatCard icon={Stethoscope} label="Visits" value={`${visits.length} visits`} color="primary" onClick={onAddVisit} />
      </div>

      {/* Critical Alerts */}
      {profile.allergies && profile.allergies.length > 0 && (
        <SectionCard title="Known Allergies" icon={AlertTriangle} color="danger">
          <TagList items={profile.allergies} color="danger" emptyText="No allergies recorded" />
        </SectionCard>
      )}

      {/* Active Conditions */}
      <SectionCard title="Active Conditions" icon={Heart} color="primary" onEdit={onEditProfile}>
        <TagList items={profile.conditions} color="primary" emptyText="No conditions recorded" />
      </SectionCard>

      {/* Current Medications */}
      <SectionCard title="Current Medications & Reminders" icon={Pill} color="success" onEdit={onOpenMedications}>
        {profile.currentMedications && profile.currentMedications.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' }}>
            {profile.currentMedications.map((med, i) => (
              <div key={i} className="med-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>{med.name}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {med.dose} · {med.frequency}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '40%' }}>
                  {(med.schedules || ['08:00 AM']).map((t, idx) => (
                    <span key={idx} style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '10px', backgroundColor: '#dcfce7', color: '#166534', fontWeight: 700 }}>
                      ⏰ {t}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <span className="text-muted" style={{ fontSize: '0.85rem', display: 'block', marginBottom: '12px' }}>No routine medicines set up yet</span>
        )}
        <button className="btn btn-secondary" style={{ width: '100%', padding: '10px', minHeight: '40px', fontSize: '0.875rem', borderColor: '#86efac', color: '#15803d' }} onClick={onOpenMedications}>
          <Pill size={16} /> Open Daily Checklist & AI Interaction Checker
        </button>
      </SectionCard>

      {/* Vitals Analytics Card */}
      <SectionCard title="Vitals & Symptoms Analytics" icon={Activity} color="primary" onEdit={onOpenVitals}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
          {vitals.length > 0 ? (
            <>
              <div style={{ flex: '1 1 120px', padding: '10px', backgroundColor: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                <div style={{ fontSize: '0.75rem', color: '#3b82f6', fontWeight: 700 }}>LATEST BP / HR</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#1e3a8a', marginTop: '2px' }}>
                  {vitals[0].systolic ? `${vitals[0].systolic}/${vitals[0].diastolic || 80} mmHg` : '—'} 
                  {vitals[0].heartRate ? ` (${vitals[0].heartRate} bpm)` : ''}
                </div>
              </div>
              <div style={{ flex: '1 1 120px', padding: '10px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #86efac' }}>
                <div style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 700 }}>GLUCOSE / WEIGHT</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#14532d', marginTop: '2px' }}>
                  {vitals[0].bloodSugar ? `${vitals[0].bloodSugar} mg/dL` : '—'} 
                  {vitals[0].weight ? ` | ${vitals[0].weight} kg` : ''}
                </div>
              </div>
            </>
          ) : (
            <span className="text-muted" style={{ fontSize: '0.85rem' }}>No vitals logged yet today</span>
          )}
        </div>
        <button className="btn btn-secondary" style={{ width: '100%', padding: '10px', minHeight: '40px', fontSize: '0.875rem', borderColor: '#bfdbfe', color: '#2563eb' }} onClick={onOpenVitals}>
          <Activity size={16} /> View 7-Day / 30-Day Charts & Range Alerts
        </button>
      </SectionCard>

      {/* Recent Symptoms */}
      <SectionCard title="Recent Symptoms" icon={TrendingUp} color="warning">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
          {recentSymptoms.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 12px', backgroundColor: '#f8fafc', border: '1px dashed var(--border)', borderRadius: '12px', textAlign: 'center' }}>
              <TrendingUp size={28} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>No recent symptoms</div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 12px' }}>Track how you're feeling to spot patterns.</p>
              <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={onAddSymptom}>+ Log Symptom</button>
            </div>
          ) : recentSymptoms.map(s => (
            <div key={s.id} className="timeline-item">
              <div className="timeline-dot" style={{ backgroundColor: `var(--${getSeverityColor(s.severity)})` }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{s.symptom}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Severity {s.severity}/10 · {formatDate(s.loggedAt)}
                </div>
                {s.notes && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>{s.notes}</div>}
              </div>
              <span className={`badge badge-${getSeverityColor(s.severity)}`}>{s.severity}/10</span>
            </div>
          ))}
        </div>
        {recentSymptoms.length > 0 && (
          <button className="btn btn-secondary" style={{ width: '100%', padding: '10px', minHeight: '40px', fontSize: '0.875rem' }} onClick={onAddSymptom}>
            <Plus size={16} /> Log Another Symptom
          </button>
        )}
      </SectionCard>

      {/* Recent Doctor Visits */}
      <SectionCard title="Recent Doctor Visits" icon={Stethoscope} color="primary">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
          {recentVisits.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 12px', backgroundColor: '#f8fafc', border: '1px dashed var(--border)', borderRadius: '12px', textAlign: 'center' }}>
              <Stethoscope size={28} style={{ color: 'var(--text-muted)', marginBottom: '8px' }} />
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>No visits recorded</div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 12px' }}>Keep track of your appointments & diagnoses.</p>
              <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={onAddVisit}>+ Log Visit</button>
            </div>
          ) : recentVisits.map(v => (
            <div key={v.id} className="timeline-item">
              <div className="timeline-dot" style={{ backgroundColor: 'var(--primary)' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{v.doctorName || 'Doctor Visit'}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {v.specialty ? `${v.specialty} · ` : ''}{formatDate(v.visitDate)}
                </div>
                {v.diagnosis && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>Dx: {v.diagnosis}</div>}
              </div>
            </div>
          ))}
        </div>
        {recentVisits.length > 0 && (
          <button className="btn btn-secondary" style={{ width: '100%', padding: '10px', minHeight: '40px', fontSize: '0.875rem' }} onClick={onAddVisit}>
            <Plus size={16} /> Log Another Visit
          </button>
        )}
      </SectionCard>

      <footer style={{ marginTop: '24px', paddingBottom: '16px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        <p>⚠️ <strong>Medical Disclaimer:</strong> AI Health Brain provides informational insights only. It is not a substitute for professional medical advice, diagnosis, or treatment. Always consult with a qualified healthcare provider.</p>
      </footer>
    </div>
  );
}
