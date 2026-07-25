import React, { useState, useMemo } from 'react';
import {
  Activity, TrendingUp, AlertTriangle, Heart, Shield, Plus,
  Calendar, Trash2, ChevronRight, CheckCircle2, Clock, Scale,
  Droplets, Thermometer, ArrowUp, ArrowDown, Minus, Info
} from 'lucide-react';

// Safe clinical range guidelines
const CLINICAL_RANGES = {
  systolic: { min: 90, max: 120, name: 'Systolic BP (mmHg)', advice: 'Maintain a cardiovascular-healthy diet and monitor regularly.' },
  diastolic: { min: 60, max: 80, name: 'Diastolic BP (mmHg)', advice: 'Stay hydrated and manage stress levels.' },
  heartRate: { min: 60, max: 100, name: 'Resting Heart Rate (BPM)', advice: 'Regular aerobic exercise supports healthy resting cardiovascular tones.' },
  bloodSugar: { min: 70, max: 100, name: 'Fasting Blood Sugar (mg/dL)', advice: 'Balance complex carbohydrates and monitor fasting glucose.' },
  temperature: { min: 97.0, max: 99.0, name: 'Body Temperature (°F)', advice: 'Adequate fluids and rest are essential when elevated.' },
  symptomSeverity: { min: 0, max: 4, name: 'Symptom Severity (1-10)', advice: 'Severe discomfort (>= 7) warrants clinical evaluation.' }
};

export default function VitalsTab({ profile, vitals = [], symptoms = [], onLogVital, onDeleteVital, onLogSymptom }) {
  const [timeRange, setTimeRange] = useState(30); // 7, 30, 90, 365 (All)
  const [selectedMetric, setSelectedMetric] = useState('bp_hr'); // 'bp_hr', 'sugar', 'temp_weight', 'symptoms'
  const [showLogForm, setShowLogForm] = useState(false);

  // Form states
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [logSystolic, setLogSystolic] = useState('');
  const [logDiastolic, setLogDiastolic] = useState('');
  const [logHr, setLogHr] = useState('');
  const [logSugar, setLogSugar] = useState('');
  const [sugarType, setSugarType] = useState('Fasting');
  const [logTemp, setLogTemp] = useState('');
  const [logWeight, setLogWeight] = useState(profile?.weight || '');
  const [logSymptomName, setLogSymptomName] = useState('');
  const [logSeverity, setLogSeverity] = useState(0); // 0 to 10
  const [logNotes, setLogNotes] = useState('');

  // Filter vitals by selected timeframe
  const filteredVitals = useMemo(() => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - timeRange);
    
    return [...vitals].filter(v => {
      let d = new Date(v.date || v.timestamp?.toDate ? v.timestamp.toDate() : Date.now());
      return isNaN(d.getTime()) ? true : d >= cutoffDate;
    }).sort((a, b) => {
      let d1 = new Date(a.date || (a.timestamp?.toDate ? a.timestamp.toDate() : Date.now()));
      let d2 = new Date(b.date || (b.timestamp?.toDate ? b.timestamp.toDate() : Date.now()));
      return d1 - d2; // chronological ascending for charting
    });
  }, [vitals, timeRange]);

  // Combined symptom data for chart
  const filteredSymptoms = useMemo(() => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - timeRange);

    return [...symptoms].filter(s => {
      let d = new Date(s.date || (s.loggedAt?.toDate ? s.loggedAt.toDate() : Date.now()));
      return isNaN(d.getTime()) ? true : d >= cutoffDate;
    }).sort((a, b) => {
      let d1 = new Date(a.date || (a.loggedAt?.toDate ? a.loggedAt.toDate() : Date.now()));
      let d2 = new Date(b.date || (b.loggedAt?.toDate ? b.loggedAt.toDate() : Date.now()));
      return d1 - d2;
    });
  }, [symptoms, timeRange]);

  // Check for any out-of-range clinical flags in recent readings
  const clinicalAlerts = useMemo(() => {
    const alerts = [];
    const latestVital = [...vitals].sort((a, b) => {
      let d1 = new Date(a.date || (a.timestamp?.toDate ? a.timestamp.toDate() : 0));
      let d2 = new Date(b.date || (b.timestamp?.toDate ? b.timestamp.toDate() : 0));
      return d2 - d1;
    })[0];

    if (!latestVital) return alerts;

    const dt = latestVital.date || (latestVital.timestamp?.toDate ? latestVital.timestamp.toDate().toLocaleDateString() : 'Recent reading');

    if (latestVital.systolic && Number(latestVital.systolic) >= 130) {
      alerts.push({
        severity: 'danger',
        title: `High Systolic Blood Pressure (${latestVital.systolic} mmHg on ${dt})`,
        advice: 'Readings above 130 mmHg indicate Stage 1 hypertension. Rest quietly and verify reading; contact healthcare professional if persistent above 140/90.'
      });
    } else if (latestVital.systolic && Number(latestVital.systolic) >= 120 && Number(latestVital.systolic) < 130) {
      alerts.push({
        severity: 'warning',
        title: `Elevated Systolic Blood Pressure (${latestVital.systolic} mmHg on ${dt})`,
        advice: 'Readings between 120-129 mmHg are considered elevated. Prioritize low-sodium cardiovascular diet and stress management.'
      });
    }

    if (latestVital.diastolic && Number(latestVital.diastolic) >= 80) {
      alerts.push({
        severity: Number(latestVital.diastolic) >= 90 ? 'danger' : 'warning',
        title: `Elevated Diastolic Blood Pressure (${latestVital.diastolic} mmHg on ${dt})`,
        advice: 'Diastolic pressures >= 80 mmHg warrant periodic monitoring and cardiovascular lifestyle compliance.'
      });
    }

    if (latestVital.heartRate && (Number(latestVital.heartRate) < 60 || Number(latestVital.heartRate) > 100)) {
      alerts.push({
        severity: 'warning',
        title: `Out of Range Resting Heart Rate (${latestVital.heartRate} BPM on ${dt})`,
        advice: Number(latestVital.heartRate) > 100
          ? 'Tachycardia (> 100 BPM) can be related to fever, stress, caffeine, or dehydration.'
          : 'Bradycardia (< 60 BPM) is common in endurance athletes but should be checked if accompanied by dizziness or fatigue.'
      });
    }

    if (latestVital.bloodSugar && Number(latestVital.bloodSugar) >= 126 && latestVital.sugarType === 'Fasting') {
      alerts.push({
        severity: 'danger',
        title: `High Fasting Glucose (${latestVital.bloodSugar} mg/dL on ${dt})`,
        advice: 'Fasting blood sugar >= 126 mg/dL across separate check-ins is a clinical marker for Diabetes. Please follow up directly with your endocrinologist.'
      });
    } else if (latestVital.bloodSugar && Number(latestVital.bloodSugar) >= 100 && Number(latestVital.bloodSugar) < 126 && latestVital.sugarType === 'Fasting') {
      alerts.push({
        severity: 'warning',
        title: `Elevated Fasting Glucose / Prediabetes Range (${latestVital.bloodSugar} mg/dL on ${dt})`,
        advice: 'Fasting levels between 100-125 mg/dL reflect impaired fasting glucose. Dietary modification and physical exercise can aid glycemic stability.'
      });
    }

    if (latestVital.temperature && Number(latestVital.temperature) >= 100.4) {
      alerts.push({
        severity: 'danger',
        title: `Active Fever (${latestVital.temperature} °F on ${dt})`,
        advice: 'Body temperature >= 100.4°F indicates systemic febrile response or infection. Maintain hydration and seek medical support if fever lasts over 48 hours or exceeds 102°F.'
      });
    }

    // Check latest symptom
    const latestSymptom = [...symptoms].sort((a, b) => {
      let d1 = new Date(a.date || (a.loggedAt?.toDate ? a.loggedAt.toDate() : 0));
      let d2 = new Date(b.date || (b.loggedAt?.toDate ? b.loggedAt.toDate() : 0));
      return d2 - d1;
    })[0];

    if (latestSymptom && Number(latestSymptom.severity) >= 7) {
      alerts.push({
        severity: 'danger',
        title: `Severe Symptom Reported (${latestSymptom.symptom || latestSymptom.symptomName} - Severity ${latestSymptom.severity}/10)`,
        advice: 'High symptom severity ratings require prompt rest and potential clinical intervention if accompanied by chest discomfort, breathing troubles, or neurological changes.'
      });
    }

    return alerts;
  }, [vitals, symptoms]);

  // Handle saving form
  const handleSubmitVital = async (e) => {
    e.preventDefault();
    if (!onLogVital) return;

    const vitalEntry = {
      date: logDate,
      systolic: logSystolic ? Number(logSystolic) : null,
      diastolic: logDiastolic ? Number(logDiastolic) : null,
      heartRate: logHr ? Number(logHr) : null,
      bloodSugar: logSugar ? Number(logSugar) : null,
      sugarType,
      temperature: logTemp ? Number(logTemp) : null,
      weight: logWeight ? Number(logWeight) : null,
      notes: logNotes.trim(),
      symptomScore: logSeverity > 0 ? Number(logSeverity) : null
    };

    await onLogVital(vitalEntry);

    // If symptom name & severity are included, also push to symptoms log
    if ((logSymptomName.trim() || logSeverity > 0) && onLogSymptom) {
      await onLogSymptom({
        symptomName: logSymptomName.trim() || 'General Discomfort / Fatigue',
        symptom: logSymptomName.trim() || 'General Discomfort / Fatigue',
        severity: logSeverity > 0 ? logSeverity : 3,
        duration: 'Recorded during daily check-in',
        notes: logNotes.trim() || `Associated with daily vitals log on ${logDate}`,
        date: logDate
      });
    }

    // Reset form & hide
    setShowLogForm(false);
    setLogSystolic('');
    setLogDiastolic('');
    setLogHr('');
    setLogSugar('');
    setLogTemp('');
    setLogSymptomName('');
    setLogSeverity(0);
    setLogNotes('');
  };

  // Helper for computing chart coordinates & summary stats
  const chartData = useMemo(() => {
    let pts = [];
    let yLabel = '';
    let safeMin = 0;
    let safeMax = 100;
    let title = '';

    if (selectedMetric === 'bp_hr') {
      title = 'Blood Pressure (Systolic) & Resting Heart Rate';
      yLabel = 'mmHg / BPM';
      safeMin = 60;
      safeMax = 120;
      pts = filteredVitals.filter(v => v.systolic || v.heartRate).map(v => ({
        label: v.date || (v.timestamp?.toDate ? v.timestamp.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Recent'),
        val1: v.systolic || null,
        val2: v.heartRate || null,
        diastolic: v.diastolic || null,
        raw: v
      }));
    } else if (selectedMetric === 'sugar') {
      title = 'Blood Sugar / Glucose Tracking';
      yLabel = 'mg/dL';
      safeMin = 70;
      safeMax = 100;
      pts = filteredVitals.filter(v => v.bloodSugar).map(v => ({
        label: v.date || (v.timestamp?.toDate ? v.timestamp.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Recent'),
        val1: v.bloodSugar,
        type: v.sugarType || 'Random',
        raw: v
      }));
    } else if (selectedMetric === 'temp_weight') {
      title = 'Body Weight & Temperature Trends';
      yLabel = 'Weight (kg) / Temp (°F)';
      safeMin = 97.0;
      safeMax = 99.0;
      pts = filteredVitals.filter(v => v.weight || v.temperature).map(v => ({
        label: v.date || (v.timestamp?.toDate ? v.timestamp.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Recent'),
        val1: v.weight || null,
        val2: v.temperature || null,
        raw: v
      }));
    } else if (selectedMetric === 'symptoms') {
      title = 'Symptom Severity Rating Timeline (1 - 10 Scale)';
      yLabel = 'Severity (1-10)';
      safeMin = 1;
      safeMax = 4;
      pts = filteredSymptoms.map(s => ({
        label: s.date || (s.loggedAt?.toDate ? s.loggedAt.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Recent'),
        val1: Number(s.severity || 0),
        name: s.symptom || s.symptomName || 'Symptom',
        raw: s
      }));
    }

    // Compute min, max, avg for primary value
    const vals = pts.map(p => p.val1).filter(val => val !== null && !isNaN(val));
    const minVal = vals.length > 0 ? Math.min(...vals) : 0;
    const maxVal = vals.length > 0 ? Math.max(...vals) : 100;
    const avgVal = vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10 : 0;

    let trend = 'Stable';
    if (vals.length >= 2) {
      const diff = vals[vals.length - 1] - vals[vals.length - 2];
      if (diff > 2) trend = 'Rising';
      else if (diff < -2) trend = 'Decreasing';
    }

    return { pts, title, yLabel, safeMin, safeMax, minVal, maxVal, avgVal, trend, totalCount: pts.length };
  }, [selectedMetric, filteredVitals, filteredSymptoms]);

  return (
    <div style={{ paddingBottom: '30px' }}>
      {/* ── 1. Mandatory Medical Disclaimer ── */}
      <div
        style={{
          backgroundColor: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: 'var(--radius)',
          padding: '12px 14px',
          marginBottom: '16px',
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
        }}
      >
        <AlertTriangle size={22} style={{ color: '#d97706', flexShrink: 0 }} />
        <div style={{ fontSize: '0.78rem', color: '#92400e', lineHeight: 1.45 }}>
          <strong>MEDICAL DISCLAIMER:</strong> Vitals and symptom severity trend charts are designed for personal health awareness and informational management only. Automated clinical range flags do not replace professional medical diagnosis, clinical prescriptions, or emergency intervention. Consult a qualified physician for healthcare decisions.
        </div>
      </div>

      {/* ── 2. Top Header & Action Row ── */}
      <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
        <div className="flex-between" style={{ flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', margin: 0 }}>
              <Activity style={{ color: '#2563eb' }} /> Vitals & Symptoms Analytics
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
              Monitor blood pressure, blood sugar, heart rate, and symptom trends against clinical safety boundaries.
            </p>
          </div>
          
          <button
            type="button"
            className="btn btn-primary"
            style={{ padding: '10px 18px', fontWeight: 700, fontSize: '0.875rem' }}
            onClick={() => setShowLogForm(!showLogForm)}
          >
            {showLogForm ? '✕ Close Form' : '+ Log Vitals & Check-in'}
          </button>
        </div>

        {/* Time Filter Chips */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Clock size={14} /> Trend Timeframe:
          </span>
          {[
            { label: 'Last 7 Days', days: 7 },
            { label: 'Last 30 Days', days: 30 },
            { label: 'Last 90 Days', days: 90 },
            { label: 'All Time (365 Days)', days: 365 }
          ].map(opt => (
            <button
              key={opt.days}
              type="button"
              className={`btn ${timeRange === opt.days ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '4px 12px', fontSize: '0.8rem', minHeight: '30px', borderRadius: '16px' }}
              onClick={() => setTimeRange(opt.days)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 3. Active Clinical Range Alerts Banner ── */}
      {clinicalAlerts.length > 0 && (
        <div style={{ marginBottom: '16px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '12px', padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800, color: '#991b1b', fontSize: '0.95rem', marginBottom: '10px' }}>
            <AlertTriangle style={{ color: '#dc2626' }} /> Automated Clinical Range Watcher — {clinicalAlerts.length} Flagged {clinicalAlerts.length === 1 ? 'Reading' : 'Readings'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {clinicalAlerts.map((alert, idx) => (
              <div key={idx} style={{ padding: '10px 12px', backgroundColor: '#ffffff', borderLeft: `5px solid ${alert.severity === 'danger' ? '#ef4444' : '#f59e0b'}`, borderRadius: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: alert.severity === 'danger' ? '#b91c1c' : '#b45309', marginBottom: '4px' }}>
                  ⚠️ {alert.title}
                </div>
                <p style={{ margin: 0, fontSize: '0.825rem', color: '#334155', lineHeight: 1.4 }}>
                  {alert.advice}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 4. Log Vitals & Symptom Modal/Form Card ── */}
      {showLogForm && (
        <div className="card" style={{ marginBottom: '20px', backgroundColor: '#eff6ff', border: '2px solid #3b82f6', padding: '18px' }}>
          <div className="flex-between" style={{ marginBottom: '14px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Plus style={{ color: '#2563eb' }} /> Record Daily Vitals & Symptom Check-in
            </h3>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '4px 8px', borderRadius: '6px', backgroundColor: '#dbeafe', color: '#1e40af' }}>
              Synced directly with Health Brain Profile
            </span>
          </div>

          <form onSubmit={handleSubmitVital} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
              <div>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.825rem', marginBottom: '4px', display: 'block' }}>Date of Reading</label>
                <input
                  type="date"
                  value={logDate}
                  onChange={e => setLogDate(e.target.value)}
                  required
                  style={{ width: '100%', height: '40px', padding: '0 10px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: '#fff', fontSize: '0.85rem' }}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.825rem', marginBottom: '4px', display: 'block' }}>Systolic BP (mmHg)</label>
                <input
                  type="number"
                  placeholder="e.g. 120"
                  value={logSystolic}
                  onChange={e => setLogSystolic(e.target.value)}
                  style={{ width: '100%', height: '40px', padding: '0 10px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: '#fff', fontSize: '0.85rem' }}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.825rem', marginBottom: '4px', display: 'block' }}>Diastolic BP (mmHg)</label>
                <input
                  type="number"
                  placeholder="e.g. 80"
                  value={logDiastolic}
                  onChange={e => setLogDiastolic(e.target.value)}
                  style={{ width: '100%', height: '40px', padding: '0 10px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: '#fff', fontSize: '0.85rem' }}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.825rem', marginBottom: '4px', display: 'block' }}>Heart Rate (BPM)</label>
                <input
                  type="number"
                  placeholder="e.g. 72"
                  value={logHr}
                  onChange={e => setLogHr(e.target.value)}
                  style={{ width: '100%', height: '40px', padding: '0 10px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: '#fff', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
              <div>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.825rem', marginBottom: '4px', display: 'block' }}>Blood Sugar (mg/dL)</label>
                <input
                  type="number"
                  placeholder="e.g. 95"
                  value={logSugar}
                  onChange={e => setLogSugar(e.target.value)}
                  style={{ width: '100%', height: '40px', padding: '0 10px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: '#fff', fontSize: '0.85rem' }}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.825rem', marginBottom: '4px', display: 'block' }}>Glucose Test Type</label>
                <select
                  value={sugarType}
                  onChange={e => setSugarType(e.target.value)}
                  style={{ width: '100%', height: '40px', padding: '0 10px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: '#fff', fontSize: '0.85rem' }}
                >
                  <option value="Fasting">Fasting (Morning before meal)</option>
                  <option value="Postprandial">Postprandial (2 hrs after meal)</option>
                  <option value="Random">Random / Anytime</option>
                </select>
              </div>
              <div>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.825rem', marginBottom: '4px', display: 'block' }}>Body Temp (°F)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 98.6"
                  value={logTemp}
                  onChange={e => setLogTemp(e.target.value)}
                  style={{ width: '100%', height: '40px', padding: '0 10px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: '#fff', fontSize: '0.85rem' }}
                />
              </div>
              <div>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.825rem', marginBottom: '4px', display: 'block' }}>Weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 70"
                  value={logWeight}
                  onChange={e => setLogWeight(e.target.value)}
                  style={{ width: '100%', height: '40px', padding: '0 10px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: '#fff', fontSize: '0.85rem' }}
                />
              </div>
            </div>

            {/* Symptom Check-in Box */}
            <div style={{ padding: '14px', backgroundColor: '#ffffff', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e40af', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <TrendingUp size={16} /> Symptom Check-in & Severity Rating
              </label>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input
                  type="text"
                  placeholder="Symptom experienced today (optional, e.g. Headache, Fatigue, Dizziness)"
                  value={logSymptomName}
                  onChange={e => setLogSymptomName(e.target.value)}
                  style={{ width: '100%', height: '40px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.85rem' }}
                />

                <div>
                  <div className="flex-between" style={{ fontSize: '0.825rem', fontWeight: 600, marginBottom: '6px' }}>
                    <span>Severity Scale (0 = None, 10 = Emergency/Severe): <strong>{logSeverity} / 10</strong></span>
                    <span style={{ color: logSeverity >= 7 ? '#dc2626' : logSeverity >= 4 ? '#d97706' : '#16a34a', fontWeight: 700 }}>
                      {logSeverity === 0 ? 'No Symptoms' : logSeverity >= 7 ? 'Severe Alert' : logSeverity >= 4 ? 'Moderate' : 'Mild'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={logSeverity}
                    onChange={e => setLogSeverity(Number(e.target.value))}
                    style={{ width: '100%', accentColor: logSeverity >= 7 ? '#ef4444' : logSeverity >= 4 ? '#f59e0b' : '#10b981', cursor: 'pointer' }}
                  />
                </div>

                <input
                  type="text"
                  placeholder="Additional clinician notes or dietary context..."
                  value={logNotes}
                  onChange={e => setLogNotes(e.target.value)}
                  style={{ width: '100%', height: '38px', padding: '0 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.825rem' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '6px' }}>
              <button type="button" className="btn btn-ghost" style={{ padding: '8px 16px' }} onClick={() => setShowLogForm(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" style={{ padding: '10px 22px', fontWeight: 700, backgroundColor: '#2563eb' }}>
                ✓ Save Readings & Check-in
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── 5. Metric Selection Navigation ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '16px' }}>
        {[
          { id: 'bp_hr', label: 'Blood Pressure & HR', icon: Heart, color: '#e11d48', sub: 'Systolic / Diastolic' },
          { id: 'sugar', label: 'Blood Sugar / Glucose', icon: Droplets, color: '#2563eb', sub: 'Fasting / Postprandial' },
          { id: 'temp_weight', label: 'Body Weight & Temp', icon: Scale, color: '#16a34a', sub: 'kg / °F Trends' },
          { id: 'symptoms', label: 'Symptom Severity', icon: TrendingUp, color: '#d97706', sub: '1-10 Scale Watcher' }
        ].map(item => (
          <div
            key={item.id}
            onClick={() => setSelectedMetric(item.id)}
            style={{
              padding: '14px 16px',
              backgroundColor: selectedMetric === item.id ? '#f1f5f9' : '#ffffff',
              border: `2px solid ${selectedMetric === item.id ? item.color : 'var(--border)'}`,
              borderRadius: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              transition: 'var(--transition)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
            }}
          >
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: `${item.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.color, flexShrink: 0 }}>
              <item.icon size={22} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>{item.label}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{item.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── 6. Interactive Visual Trend Chart & Statistics Card ── */}
      <div className="card" style={{ marginBottom: '20px', padding: '20px' }}>
        <div className="flex-between" style={{ marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              📊 {chartData.title}
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Displaying {chartData.totalCount} recorded data points over the last {timeRange} days
            </span>
          </div>

          {/* Statistical Summary Pills */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span className="badge badge-primary" style={{ padding: '6px 10px', fontSize: '0.78rem' }}>
              <strong>Avg:</strong> {chartData.avgVal} {chartData.yLabel.split('/')[0]}
            </span>
            <span className="badge badge-success" style={{ padding: '6px 10px', fontSize: '0.78rem' }}>
              <strong>Min:</strong> {chartData.minVal} | <strong>Max:</strong> {chartData.maxVal}
            </span>
            <span className="badge" style={{ backgroundColor: chartData.trend === 'Rising' ? '#fef3c7' : '#e0f2fe', color: chartData.trend === 'Rising' ? '#b45309' : '#0369a1', padding: '6px 10px', fontSize: '0.78rem', fontWeight: 700 }}>
              Trend: {chartData.trend === 'Rising' ? '📈 Rising' : chartData.trend === 'Decreasing' ? '📉 Falling' : '➡️ Stable'}
            </span>
          </div>
        </div>

        {/* Shaded Clinical Zone Guidance Note */}
        <div style={{ padding: '8px 12px', backgroundColor: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', color: '#166534', fontSize: '0.78rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shield size={15} style={{ flexShrink: 0, color: '#10b981' }} />
          <span>
            <strong>Clinical Safety Zone:</strong> Green highlighted region indicates healthy clinical target range ({chartData.safeMin} – {chartData.safeMax} {chartData.yLabel}).
          </span>
        </div>

        {/* SVG Custom Interactive Bar/Trend Visualizer */}
        {chartData.pts.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px 10px' }}>
            <Activity size={36} style={{ color: 'var(--text-muted)', marginBottom: '10px' }} />
            <h4>No readings logged for this timeframe</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Click "+ Log Vitals & Check-in" above to add your first {selectedMetric === 'symptoms' ? 'symptom rating' : 'vital reading'}!
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Horizontal Bar Visualizer */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '380px', overflowY: 'auto', paddingRight: '4px' }}>
              {chartData.pts.map((pt, i) => {
                const val = Number(pt.val1 || 0);
                const isAbove = val > chartData.safeMax;
                const isBelow = val < chartData.safeMin && val > 0;
                const isNormal = !isAbove && !isBelow;

                // Percent of bar relative to max + 20%
                const maxRange = Math.max(chartData.maxVal, chartData.safeMax) * 1.2 || 100;
                const widthPct = Math.min(100, Math.round((val / maxRange) * 100));

                return (
                  <div
                    key={i}
                    style={{
                      padding: '10px 14px',
                      backgroundColor: isAbove ? '#fef2f2' : isBelow ? '#fffbeb' : '#f8fafc',
                      border: `1px solid ${isAbove ? '#fca5a5' : isBelow ? '#fde68a' : 'var(--border)'}`,
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      transition: 'var(--transition)'
                    }}
                  >
                    <div style={{ width: '85px', fontSize: '0.825rem', fontWeight: 700, color: 'var(--text-secondary)', flexShrink: 0 }}>
                      📅 {pt.label}
                    </div>

                    {/* Progress Bar & Number */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div className="flex-between" style={{ fontSize: '0.85rem' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                          {pt.name ? `${pt.name}: ` : ''}{pt.val1 ? `${pt.val1}` : '—'} 
                          {pt.diastolic ? ` / ${pt.diastolic}` : ''} 
                          {pt.val2 ? ` (HR: ${pt.val2} BPM / Temp: ${pt.val2}°F)` : ''} 
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}> {chartData.yLabel.split('/')[0]}</span>
                          {pt.type ? ` [${pt.type}]` : ''}
                        </span>

                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '2px 8px',
                          borderRadius: '10px',
                          backgroundColor: isAbove ? '#f87171' : isBelow ? '#fbbf24' : '#10b981',
                          color: '#fff'
                        }}>
                          {isAbove ? '▲ High / Alert' : isBelow ? '▼ Low Range' : '● In Range'}
                        </span>
                      </div>

                      <div style={{ width: '100%', height: '10px', backgroundColor: '#e2e8f0', borderRadius: '5px', overflow: 'hidden', position: 'relative' }}>
                        <div
                          style={{
                            width: `${widthPct}%`,
                            height: '100%',
                            backgroundColor: isAbove ? '#ef4444' : isBelow ? '#f59e0b' : '#10b981',
                            transition: 'width 0.5s ease'
                          }}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ color: 'var(--danger)', padding: '4px', minHeight: '28px' }}
                      onClick={() => onDeleteVital && pt.raw && pt.raw.id ? onDeleteVital(pt.raw.id) : null}
                      title="Delete log entry"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── 7. Clinical Range Education Roster ── */}
      <div className="card">
        <h3 className="section-title">
          <Info style={{ color: 'var(--primary)' }} />
          Standard Clinical Safe Range Benchmarks
        </h3>
        <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
          Reference medical guidelines utilized by your AI Health Assistant to evaluate physiological trends:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
          {Object.entries(CLINICAL_RANGES).map(([k, info]) => (
            <div key={k} style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div className="flex-between" style={{ marginBottom: '4px' }}>
                <strong style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>{info.name}</strong>
                <span className="badge badge-success" style={{ fontSize: '0.72rem', fontWeight: 700 }}>
                  Safe: {info.min} – {info.max}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.35 }}>
                {info.advice}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
