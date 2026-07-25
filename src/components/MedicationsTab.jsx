import React, { useState, useMemo } from 'react';
import { auth } from '../firebase';
import {
  Pill, Clock, CheckCircle2, XCircle, AlertTriangle, Shield,
  Sparkles, Plus, Trash2, Calendar, ChevronLeft, ChevronRight,
  Info, Activity, RefreshCw, Check
} from 'lucide-react';

export default function MedicationsTab({ profile, saveProfile }) {
  const [activeSubTab, setActiveSubTab] = useState('checklist'); // 'checklist' | 'manage'
  
  // Daily checklist date tracker
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);

  // New Medication Form State
  const [medName, setMedName] = useState('');
  const [medDose, setMedDose] = useState('');
  const [medFreq, setMedFreq] = useState('Once Daily');
  const [medInstructions, setMedInstructions] = useState('');
  const [selectedTimes, setSelectedTimes] = useState(['08:00 AM']);
  const [customTimeInput, setCustomTimeInput] = useState('');

  // AI Interaction Analysis State
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiReport, setAiReport] = useState(profile?.drugInteractions || null);

  // Standard prescription schedule slots
  const presetTimes = [
    { label: 'Morning (08:00 AM)', value: '08:00 AM' },
    { label: 'Lunch (01:00 PM)', value: '01:00 PM' },
    { label: 'Evening (06:00 PM)', value: '06:00 PM' },
    { label: 'Bedtime (09:30 PM)', value: '09:30 PM' }
  ];

  // Current active meds from profile
  const currentMedications = useMemo(() => profile?.currentMedications || [], [profile]);
  const medicationLogs = useMemo(() => profile?.medicationLogs || {}, [profile]);

  // Generate today's schedule items from active medications
  const todaySchedule = useMemo(() => {
    const items = [];
    currentMedications.forEach((med, idx) => {
      const medId = med.id || med.name.toLowerCase().replace(/\s+/g, '_') + `_${idx}`;
      const schedules = (med.schedules && med.schedules.length > 0) ? med.schedules : ['08:00 AM'];
      
      schedules.forEach(time => {
        const logKey = `${medId}_${time}`;
        const status = medicationLogs[selectedDate]?.[logKey] || 'pending'; // 'taken', 'missed', 'pending'
        items.push({
          key: logKey,
          medId,
          medName: med.name || 'Unnamed Med',
          dose: med.dose || 'Standard dose',
          frequency: med.frequency || 'Daily',
          time,
          instructions: med.instructions || '',
          status
        });
      });
    });

    // Sort chronologically by approximate hour
    return items.sort((a, b) => {
      const parseTime = (str) => {
        const match = str.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (!match) return 12 * 60;
        let h = parseInt(match[1], 10);
        let m = parseInt(match[2], 10);
        const ampm = match[3].toUpperCase();
        if (ampm === 'PM' && h < 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        return h * 60 + m;
      };
      return parseTime(a.time) - parseTime(b.time);
    });
  }, [currentMedications, medicationLogs, selectedDate]);

  // Calculate daily progress stats
  const stats = useMemo(() => {
    if (todaySchedule.length === 0) return { taken: 0, total: 0, percent: 0 };
    const taken = todaySchedule.filter(i => i.status === 'taken').length;
    const total = todaySchedule.length;
    return { taken, total, percent: Math.round((taken / total) * 100) };
  }, [todaySchedule]);

  // Toggle adherence status in Profile
  const handleToggleStatus = async (itemKey, newStatus) => {
    const currentDayLogs = { ...(medicationLogs[selectedDate] || {}) };
    if (currentDayLogs[itemKey] === newStatus) {
      delete currentDayLogs[itemKey]; // reset to pending
    } else {
      currentDayLogs[itemKey] = newStatus;
    }

    const updatedLogs = {
      ...medicationLogs,
      [selectedDate]: currentDayLogs
    };

    await saveProfile({ medicationLogs: updatedLogs });
  };

  // Add new medicine to profile
  const handleAddMedication = async (e) => {
    e.preventDefault();
    if (!medName.trim()) return;

    const newMed = {
      id: `${Date.now()}`,
      name: medName.trim(),
      dose: medDose.trim() || 'Not specified',
      frequency: medFreq,
      instructions: medInstructions.trim(),
      schedules: selectedTimes.length > 0 ? selectedTimes : ['08:00 AM'],
      since: new Date().toISOString().split('T')[0]
    };

    const updatedMeds = [...currentMedications, newMed];
    await saveProfile({ currentMedications: updatedMeds });

    // Reset form
    setMedName('');
    setMedDose('');
    setMedInstructions('');
    setSelectedTimes(['08:00 AM']);
    setCustomTimeInput('');
    setActiveSubTab('checklist');
  };

  // Delete medicine from profile
  const handleDeleteMedication = async (medToDelete) => {
    if (!window.confirm(`Are you sure you want to remove ${medToDelete.name} from your medication tracker?`)) return;
    const medId = medToDelete.id || medToDelete.name;
    const updatedMeds = currentMedications.filter(m => (m.id || m.name) !== medId);
    await saveProfile({ currentMedications: updatedMeds });
  };

  // Toggle quick prescription time checkboxes
  const togglePresetTime = (val) => {
    if (selectedTimes.includes(val)) {
      setSelectedTimes(selectedTimes.filter(t => t !== val));
    } else {
      setSelectedTimes([...selectedTimes, val]);
    }
  };

  // Add custom schedule slot
  const handleAddCustomTime = () => {
    if (!customTimeInput.trim()) return;
    if (!selectedTimes.includes(customTimeInput.trim())) {
      setSelectedTimes([...selectedTimes, customTimeInput.trim()]);
    }
    setCustomTimeInput('');
  };

  // Trigger Gemini AI Drug & Allergy Interaction Check
  const handleRunAiCheck = async () => {
    setAiAnalyzing(true);
    setAiError(null);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Please log in to perform interaction check.');
      const idToken = await currentUser.getIdToken();

      const medsList = currentMedications.map(m => `${m.name} (Dose: ${m.dose}, Freq: ${m.frequency})`).join('; ');
      const allergiesList = (profile?.allergies || []).join(', ') || 'No reported drug or dietary allergies';
      const conditionsList = (profile?.conditions || []).join(', ') || 'No chronic conditions recorded';

      if (!medsList) {
        throw new Error('You have no active medications in your list. Add a medication first!');
      }

      const prompt = `
Please perform a rigorous, clinical AI drug-drug, drug-allergy, and drug-condition interaction analysis based on the patient's record below:

Active Medications: ${medsList}
Known Allergies: ${allergiesList}
Chronic Conditions: ${conditionsList}
Past Medications: ${(profile?.pastMedications || []).map(m => m.name).join(', ') || 'None'}

Return ONLY a JSON object exactly matching this structure:
{
  "safetyLevel": "SAFE | CAUTION | WARNING",
  "summary": "2-3 sentence clear summary of overall medication safety and synergy.",
  "interactions": [
    { "drugs": "Drug A + Drug B or Condition", "severity": "Low | Moderate | High", "description": "Explanation of interaction", "advice": "What to ask doctor or observe" }
  ],
  "allergyWarnings": [
    { "medication": "Drug Name", "allergy": "Allergy or sensitive condition", "warning": "Specific clinical risk" }
  ],
  "lifestyleAndFoodTips": ["Practical instructions like take with milk, avoid alcohol or grapefruit, etc."]
}
      `.trim();

      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt,
          jsonMode: true,
          systemInstruction: "You are an AI Clinical Pharmacology Companion specializing in drug-drug interactions, pharmacokinetics, and allergy screening. Provide scientifically clear, educational evaluations in strict JSON format."
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Server error while evaluating interactions.');
      }

      const data = await res.json();
      let parsedReport;
      try {
        parsedReport = JSON.parse(data.text);
      } catch (e) {
        // Strip markdown fences if any
        const cleaned = data.text.replace(/```json|```/g, '').trim();
        parsedReport = JSON.parse(cleaned);
      }

      parsedReport.analyzedAt = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      setAiReport(parsedReport);
      
      // Save directly to user's profile in Firestore
      await saveProfile({ drugInteractions: parsedReport });
    } catch (err) {
      console.error('Interaction Check Error:', err);
      setAiError(err.message || 'Failed to complete AI drug interaction analysis.');
    } finally {
      setAiAnalyzing(false);
    }
  };

  const shiftDate = (deltaDays) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + deltaDays);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

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
          <strong>MEDICAL DISCLAIMER:</strong> This medication tracker and AI drug interaction assistant is for educational health management only and does <strong>not</strong> constitute medical advice, diagnosis, or clinical prescriptions. Always verify medication schedules and potential side effects directly with your physician or pharmacist.
        </div>
      </div>

      {/* ── 2. Header & Top Toggle Bars ── */}
      <div className="card" style={{ marginBottom: '16px', padding: '16px' }}>
        <div className="flex-between" style={{ marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
              <Pill style={{ color: '#2563eb' }} /> Medication Reminders & Tracker
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Track daily doses and screen for drug & allergy interactions with AI Health Assistant.
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '6px', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
            <button
              type="button"
              className={`btn ${activeSubTab === 'checklist' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '6px 14px', fontSize: '0.825rem', minHeight: '34px', borderRadius: '8px' }}
              onClick={() => setActiveSubTab('checklist')}
            >
              <CheckCircle2 size={16} /> Daily Checklist
            </button>
            <button
              type="button"
              className={`btn ${activeSubTab === 'manage' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ padding: '6px 14px', fontSize: '0.825rem', minHeight: '34px', borderRadius: '8px' }}
              onClick={() => setActiveSubTab('manage')}
            >
              <Pill size={16} /> Manage Meds ({currentMedications.length})
            </button>
          </div>
        </div>

        {/* ── 3. AI Interaction Analyzer Section ── */}
        <div
          style={{
            padding: '16px',
            backgroundColor: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '12px',
            position: 'relative'
          }}
        >
          <div className="flex-between" style={{ marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#1e40af', fontSize: '0.92rem' }}>
              <Sparkles size={18} style={{ color: '#2563eb' }} />
              <span>AI Drug & Allergy Interaction Checker</span>
              {aiReport?.safetyLevel && (
                <span className={`badge badge-${aiReport.safetyLevel === 'SAFE' ? 'success' : aiReport.safetyLevel === 'CAUTION' ? 'warning' : 'danger'}`} style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                  {aiReport.safetyLevel === 'SAFE' ? '✓ Checked Safe' : aiReport.safetyLevel}
                </span>
              )}
            </div>
            
            <button
              type="button"
              className="btn btn-primary"
              style={{ padding: '6px 14px', fontSize: '0.8rem', minHeight: '34px', backgroundColor: '#2563eb' }}
              onClick={handleRunAiCheck}
              disabled={aiAnalyzing || currentMedications.length === 0}
            >
              {aiAnalyzing ? <><div className="spinner" style={{ width: '14px', height: '14px' }} /> Checking...</> : aiReport ? <><RefreshCw size={14} /> Re-analyze routine</> : <><Sparkles size={14} /> Check for Interactions</>}
            </button>
          </div>

          <p style={{ fontSize: '0.8rem', color: '#334155', marginBottom: aiReport ? '12px' : '0', lineHeight: 1.4 }}>
            Checks your active prescriptions against known allergies (<strong>{(profile?.allergies || []).join(', ') || 'none'}</strong>) and conditions (<strong>{(profile?.conditions || []).join(', ') || 'none'}</strong>).
          </p>

          {aiError && (
            <div style={{ padding: '10px 12px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', color: '#b91c1c', fontSize: '0.825rem', marginTop: '10px' }}>
              ⚠️ {aiError}
            </div>
          )}

          {/* AI Report Cards */}
          {aiReport && !aiAnalyzing && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px', backgroundColor: '#ffffff', padding: '14px', borderRadius: '10px', border: '1px solid #cbd5e1', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.5, fontWeight: 500, paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>
                <strong>Clinical Summary:</strong> {aiReport.summary}
              </div>

              {/* Interactions Flagged */}
              {aiReport.interactions && aiReport.interactions.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Activity size={14} /> Potential Drug / Condition Interactions
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {aiReport.interactions.map((intx, idx) => (
                      <div key={idx} style={{ padding: '10px', backgroundColor: '#fef2f2', borderLeft: '4px solid #ef4444', borderRadius: '6px', fontSize: '0.825rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#991b1b', marginBottom: '4px' }}>
                          <span>⚡ {intx.drugs}</span>
                          <span style={{ fontSize: '0.75rem', color: '#b91c1c' }}>Severity: {intx.severity}</span>
                        </div>
                        <p style={{ color: '#7f1d1d', marginBottom: '4px' }}>{intx.description}</p>
                        <div style={{ fontSize: '0.78rem', color: '#991b1b', fontWeight: 600 }}>👉 Guidance: {intx.advice}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Allergy Warnings */}
              {aiReport.allergyWarnings && aiReport.allergyWarnings.length > 0 && (
                <div style={{ marginTop: '4px' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#d97706', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={14} /> Drug-Allergy Alerts
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {aiReport.allergyWarnings.map((aw, idx) => (
                      <div key={idx} style={{ padding: '10px', backgroundColor: '#fffbeb', borderLeft: '4px solid #f59e0b', borderRadius: '6px', fontSize: '0.825rem', color: '#92400e' }}>
                        <strong>⚠️ {aw.medication} vs Allergy ({aw.allergy}):</strong> {aw.warning}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Lifestyle & Food Guidance */}
              {aiReport.lifestyleAndFoodTips && aiReport.lifestyleAndFoodTips.length > 0 && (
                <div style={{ marginTop: '4px' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#15803d', textTransform: 'uppercase', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Shield size={14} /> Dietary & Lifestyle Advice
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.825rem', color: '#166534', lineHeight: 1.6 }}>
                    {aiReport.lifestyleAndFoodTips.map((tip, idx) => (
                      <li key={idx}><strong>{tip}</strong></li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── VIEW 1: DAILY CHECKLIST ── */}
      {activeSubTab === 'checklist' && (
        <div className="card">
          {/* Date Bar */}
          <div className="flex-between" style={{ paddingBottom: '14px', borderBottom: '1px solid var(--border)', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Calendar size={20} style={{ color: 'var(--primary)' }} />
              <span style={{ fontSize: '1.05rem', fontWeight: 800 }}>
                {selectedDate === todayStr ? 'Today, ' : ''}
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button type="button" className="btn btn-secondary" style={{ padding: '6px 10px', minHeight: '34px' }} onClick={() => shiftDate(-1)} title="Previous Day">
                <ChevronLeft size={16} />
              </button>
              {selectedDate !== todayStr && (
                <button type="button" className="btn btn-secondary" style={{ padding: '6px 12px', minHeight: '34px', fontSize: '0.8rem' }} onClick={() => setSelectedDate(todayStr)}>
                  Today
                </button>
              )}
              <button type="button" className="btn btn-secondary" style={{ padding: '6px 10px', minHeight: '34px' }} onClick={() => shiftDate(1)} title="Next Day">
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

          {/* Adherence Progress Bar */}
          {todaySchedule.length > 0 && (
            <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid var(--border)', marginBottom: '16px' }}>
              <div className="flex-between" style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px' }}>
                <span>🎯 Daily Adherence Progress</span>
                <span style={{ color: stats.percent === 100 ? '#10b981' : 'var(--primary)' }}>
                  {stats.taken} of {stats.total} Doses Taken ({stats.percent}%)
                </span>
              </div>
              <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${stats.percent}%`, height: '100%', backgroundColor: stats.percent === 100 ? '#10b981' : 'var(--primary)', transition: 'width 0.4s ease' }} />
              </div>
            </div>
          )}

          {/* Schedule List */}
          {todaySchedule.length === 0 ? (
            <div className="empty-state">
              <Pill size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
              <h3>No Medications Scheduled</h3>
              <p style={{ maxWidth: '400px', margin: '0 auto 16px' }}>
                You haven't set up any routine medicines yet. Add your medications and scheduled times to track daily compliance and reminders.
              </p>
              <button className="btn btn-primary" style={{ padding: '10px 18px' }} onClick={() => setActiveSubTab('manage')}>
                <Plus size={16} /> Add Medication Routine
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {todaySchedule.map(item => {
                const isTaken = item.status === 'taken';
                const isMissed = item.status === 'missed';

                return (
                  <div
                    key={item.key}
                    style={{
                      padding: '14px 16px',
                      backgroundColor: isTaken ? '#f0fdf4' : isMissed ? '#fef2f2' : '#ffffff',
                      border: `1px solid ${isTaken ? '#86efac' : isMissed ? '#fca5a5' : 'var(--border)'}`,
                      borderLeft: `5px solid ${isTaken ? '#10b981' : isMissed ? '#ef4444' : 'var(--primary)'}`,
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '12px',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                      transition: 'var(--transition)'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 800, padding: '2px 8px', borderRadius: '12px', backgroundColor: 'var(--bg-hover)', color: 'var(--primary)' }}>
                          <Clock size={12} style={{ display: 'inline', marginRight: '4px' }} /> {item.time}
                        </span>
                        <h4 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, textDecoration: isTaken ? 'line-through' : 'none', color: isTaken ? '#15803d' : 'var(--text-primary)' }}>
                          {item.medName}
                        </h4>
                      </div>
                      
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        <strong>Dose:</strong> {item.dose} · {item.frequency}
                        {item.instructions && <span style={{ marginLeft: '8px', color: 'var(--text-muted)' }}>({item.instructions})</span>}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(item.key, 'taken')}
                        style={{
                          padding: '8px 14px',
                          borderRadius: '8px',
                          border: `1px solid ${isTaken ? '#16a34a' : '#cbd5e1'}`,
                          backgroundColor: isTaken ? '#16a34a' : '#ffffff',
                          color: isTaken ? '#ffffff' : '#334155',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          cursor: 'pointer',
                          transition: 'var(--transition)'
                        }}
                      >
                        <Check size={16} /> {isTaken ? 'Taken ✓' : 'Take'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleStatus(item.key, 'missed')}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: `1px solid ${isMissed ? '#dc2626' : '#cbd5e1'}`,
                          backgroundColor: isMissed ? '#dc2626' : '#ffffff',
                          color: isMissed ? '#ffffff' : '#64748b',
                          fontWeight: 600,
                          fontSize: '0.85rem',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          cursor: 'pointer',
                          transition: 'var(--transition)'
                        }}
                        title="Mark as Missed or Skipped"
                      >
                        <XCircle size={15} /> {isMissed ? 'Missed' : 'Skip'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── VIEW 2: MANAGE MEDICATIONS ── */}
      {activeSubTab === 'manage' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px', alignItems: 'flex-start' }}>
          {/* Add Medicine Form Card */}
          <div className="card">
            <h3 className="section-title">
              <Plus style={{ color: 'var(--primary)' }} />
              Add Medication Routine
            </h3>
            <form onSubmit={handleAddMedication} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px', display: 'block' }}>Medication Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Metformin, Lisinopril, Vitamin D"
                  value={medName}
                  onChange={e => setMedName(e.target.value)}
                  style={{ width: '100%', height: '42px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.9rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px', display: 'block' }}>Dosage</label>
                  <input
                    type="text"
                    placeholder="e.g. 500 mg, 1 tablet"
                    value={medDose}
                    onChange={e => setMedDose(e.target.value)}
                    style={{ width: '100%', height: '42px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.9rem' }}
                  />
                </div>
                <div>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px', display: 'block' }}>Frequency</label>
                  <select
                    value={medFreq}
                    onChange={e => setMedFreq(e.target.value)}
                    style={{ width: '100%', height: '42px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: '#fff', fontSize: '0.9rem' }}
                  >
                    <option value="Once Daily">Once Daily</option>
                    <option value="Twice Daily">Twice Daily (Morning / Evening)</option>
                    <option value="3 Times Daily">3 Times Daily (With Meals)</option>
                    <option value="As Needed (PRN)">As Needed (PRN)</option>
                    <option value="Weekly">Weekly</option>
                  </select>
                </div>
              </div>

              {/* Schedule Slots */}
              <div>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '6px', display: 'block' }}>
                  Scheduled Times / Reminders
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                  {presetTimes.map(pt => (
                    <label
                      key={pt.value}
                      style={{
                        padding: '8px 10px',
                        border: `1px solid ${selectedTimes.includes(pt.value) ? 'var(--primary)' : 'var(--border)'}`,
                        backgroundColor: selectedTimes.includes(pt.value) ? '#eff6ff' : '#ffffff',
                        borderRadius: '8px',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontWeight: selectedTimes.includes(pt.value) ? 700 : 500
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedTimes.includes(pt.value)}
                        onChange={() => togglePresetTime(pt.value)}
                        style={{ accentColor: 'var(--primary)' }}
                      />
                      {pt.label}
                    </label>
                  ))}
                </div>

                {/* Custom time addition */}
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="text"
                    placeholder="Custom Time (e.g. 02:30 PM)"
                    value={customTimeInput}
                    onChange={e => setCustomTimeInput(e.target.value)}
                    style={{ flex: 1, height: '36px', padding: '0 10px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '0.825rem' }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ padding: '0 12px', minHeight: '36px', fontSize: '0.8rem' }}
                    onClick={handleAddCustomTime}
                  >
                    + Add Time
                  </button>
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px', display: 'block' }}>Instructions / Purpose</label>
                <input
                  type="text"
                  placeholder="e.g. For high blood pressure; take after dinner"
                  value={medInstructions}
                  onChange={e => setMedInstructions(e.target.value)}
                  style={{ width: '100%', height: '42px', padding: '0 12px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.9rem' }}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ padding: '12px', fontWeight: 700, fontSize: '0.95rem', marginTop: '4px' }}>
                <Plus size={18} /> Save Medication Routine
              </button>
            </form>
          </div>

          {/* Active Medication Roster Card */}
          <div className="card">
            <h3 className="section-title">
              <Pill style={{ color: '#10b981' }} />
              Active Medication List ({currentMedications.length})
            </h3>
            {currentMedications.length === 0 ? (
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
                No active medications recorded yet. Use the form to set up your regimen!
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {currentMedications.map((med, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '14px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid var(--border)',
                      borderRadius: '10px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '10px'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <h4 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>{med.name}</h4>
                        <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>{med.dose}</span>
                      </div>
                      <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        <strong>Frequency:</strong> {med.frequency}
                        {med.instructions && <div><strong>Instructions:</strong> {med.instructions}</div>}
                      </div>
                      
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {(med.schedules && med.schedules.length > 0 ? med.schedules : ['08:00 AM']).map((time, tIdx) => (
                          <span key={tIdx} style={{ fontSize: '0.75rem', fontWeight: 700, padding: '3px 8px', borderRadius: '12px', backgroundColor: '#e2e8f0', color: '#334155' }}>
                            <Clock size={11} style={{ display: 'inline', marginRight: '3px' }} /> {time}
                          </span>
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ color: 'var(--danger)', padding: '6px', minHeight: '32px' }}
                      onClick={() => handleDeleteMedication(med)}
                      title="Delete Medication"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
