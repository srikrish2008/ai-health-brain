import React, { useState, useMemo, useEffect } from 'react';
import {
  Shield, AlertTriangle, Download, FileText, Printer, Phone,
  User, Heart, Activity, Pill, Stethoscope, Clock, CheckCircle2,
  Edit3, Share2, AlertCircle, Calendar, Droplets, MapPin
} from 'lucide-react';
import { normalizeEmergencyContact } from '../utils/emergencyContact';

export default function EmergencyTab({ profile, symptoms = [], visits = [], vaultFiles = [], vitals = [], saveProfile }) {
  const [activeView, setActiveView] = useState('card'); // 'card' or 'report'
  const [showEditEmergency, setShowEditEmergency] = useState(false);

  // Compute normalized emergency contact for display
  const currentEmergencyContact = useMemo(() => {
    return normalizeEmergencyContact(profile?.emergencyContact);
  }, [profile?.emergencyContact]);

  // Form states for editable emergency profile fields
  const [contactName, setContactName] = useState(currentEmergencyContact.name);
  const [contactRelation, setContactRelation] = useState(currentEmergencyContact.relation || 'Spouse / Partner');
  const [contactPhone, setContactPhone] = useState(currentEmergencyContact.phone);
  const [doctorName, setDoctorName] = useState(profile?.primaryDoctor?.name || '');
  const [doctorSpecialty, setDoctorSpecialty] = useState(profile?.primaryDoctor?.specialty || 'General Practitioner / Family Med');
  const [doctorPhone, setDoctorPhone] = useState(profile?.primaryDoctor?.phone || '');
  const [doctorHospital, setDoctorHospital] = useState(profile?.primaryDoctor?.hospital || '');
  const [organDonor, setOrganDonor] = useState(profile?.organDonor || 'Yes');
  const [saving, setSaving] = useState(false);

  // Sync state whenever profile updates
  useEffect(() => {
    const ec = normalizeEmergencyContact(profile?.emergencyContact);
    setContactName(ec.name);
    setContactRelation(ec.relation || 'Spouse / Partner');
    setContactPhone(ec.phone);
    setDoctorName(profile?.primaryDoctor?.name || '');
    setDoctorSpecialty(profile?.primaryDoctor?.specialty || 'General Practitioner / Family Med');
    setDoctorPhone(profile?.primaryDoctor?.phone || '');
    setDoctorHospital(profile?.primaryDoctor?.hospital || '');
    setOrganDonor(profile?.organDonor || 'Yes');
  }, [profile]);

  // Compute patient age
  const age = useMemo(() => {
    if (!profile?.dateOfBirth) return 'N/A';
    const dob = new Date(profile.dateOfBirth);
    return Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000));
  }, [profile?.dateOfBirth]);

  // Handle saving emergency details to Firestore profile
  const handleSaveEmergencyInfo = async (e) => {
    e.preventDefault();
    if (!saveProfile) return;
    setSaving(true);
    try {
      await saveProfile({
        ...profile,
        emergencyContact: { name: contactName.trim(), relation: contactRelation.trim(), phone: contactPhone.trim() },
        primaryDoctor: { name: doctorName.trim(), specialty: doctorSpecialty.trim(), phone: doctorPhone.trim(), hospital: doctorHospital.trim() },
        organDonor
      });
      setShowEditEmergency(false);
    } catch (err) {
      console.error('Failed to update emergency details:', err);
    } finally {
      setSaving(false);
    }
  };

  // Generate self-contained HTML report and open print window
  const handleExportPDFReport = () => {
    const reportWindow = window.open('', '_blank', 'width=850,height=1100,menubar=yes,scrollbars=yes');
    if (!reportWindow) {
      alert('Please allow pop-ups for this site to generate and print your medical report.');
      return;
    }

    const currentDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    
    // Build HTML representation
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Clinical Consultation Health Report - ${profile?.name || 'Patient'}</title>
  <style>
    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1e293b; line-height: 1.5; padding: 30px; margin: 0; }
    .header { border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-end; }
    .header h1 { color: #1e3a8a; font-size: 24px; margin: 0 0 5px 0; text-transform: uppercase; letter-spacing: 0.5px; }
    .header .subtitle { font-size: 13px; color: #64748b; font-weight: 600; }
    .meta-box { text-align: right; font-size: 13px; color: #475569; }
    .section { margin-bottom: 30px; page-break-inside: avoid; }
    .section-title { font-size: 16px; font-weight: 800; color: #1e3a8a; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 0.5px; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 15px; }
    .card { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px 15px; }
    .label { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 3px; }
    .val { font-size: 15px; font-weight: 700; color: #0f172a; }
    .alert-box { background: #fef2f2; border: 1px solid #fca5a5; border-left: 5px solid #dc2626; padding: 12px; border-radius: 6px; margin-bottom: 15px; color: #991b1b; }
    .table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
    .table th { background: #e2e8f0; color: #1e293b; text-align: left; padding: 10px 12px; font-weight: 700; border: 1px solid #cbd5e1; }
    .table td { padding: 10px 12px; border: 1px solid #cbd5e1; vertical-align: top; }
    .badge { display: inline-block; padding: 2px 8px; font-size: 11px; font-weight: 700; border-radius: 12px; background: #e2e8f0; }
    .badge-danger { background: #fee2e2; color: #b91c1c; }
    .badge-success { background: #dcfce7; color: #15803d; }
    .footer { margin-top: 50px; border-top: 1px solid #cbd5e1; padding-top: 15px; font-size: 11px; color: #64748b; text-align: center; }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
    .print-btn { background: #2563eb; color: white; border: none; padding: 10px 20px; font-size: 14px; font-weight: 700; border-radius: 6px; cursor: pointer; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .print-btn:hover { background: #1d4ed8; }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">🖨️ Print Report / Save as PDF</button>

  <div class="header">
    <div>
      <h1>Clinical Health & Medical Record Summary</h1>
      <div class="subtitle">AI HEALTH BRAIN PATIENT EXPORT REPORT</div>
    </div>
    <div class="meta-box">
      <strong>Generated:</strong> ${currentDate}<br/>
      <strong>Record ID:</strong> ${profile?.email || 'Patient File'}
    </div>
  </div>

  <!-- Section 1: Patient Demographics & Emergency Contacts -->
  <div class="section">
    <div class="section-title">1. Patient Demographics & Emergency Details</div>
    <div class="grid">
      <div class="card">
        <div class="label">Patient Name</div>
        <div class="val">${profile?.name || 'Anonymous Patient'}</div>
      </div>
      <div class="card">
        <div class="label">Blood Group</div>
        <div class="val" style="color: #dc2626;">${profile?.bloodType || 'Unspecified'}</div>
      </div>
      <div class="card">
        <div class="label">Age & Gender</div>
        <div class="val">${age !== 'N/A' ? `${age} Years Old` : 'N/A'} (${profile?.gender || 'Not specified'})</div>
      </div>
    </div>
    <div class="grid">
      <div class="card">
        <div class="label">Height / Weight</div>
        <div class="val">${profile?.height || '—'} cm / ${profile?.weight || '—'} kg</div>
      </div>
      <div class="card">
        <div class="label">Emergency Contact</div>
        <div class="val">${currentEmergencyContact?.name || 'None Set'} (${currentEmergencyContact?.relation || '—'})<br/>📞 ${currentEmergencyContact?.phone || 'No phone provided'}</div>
      </div>
      <div class="card">
        <div class="label">Primary Physician</div>
        <div class="val">Dr. ${profile?.primaryDoctor?.name || 'None Set'} (${profile?.primaryDoctor?.specialty || '—'})<br/>🏥 ${profile?.primaryDoctor?.hospital || '—'} | 📞 ${profile?.primaryDoctor?.phone || '—'}</div>
      </div>
    </div>
  </div>

  <!-- Section 2: Severe Allergies & Chronic Conditions -->
  <div class="section">
    <div class="section-title">2. Clinical Alerts: Allergies & Medical Conditions</div>
    <div class="alert-box">
      <strong>🚨 Known Drug & Food Allergies:</strong><br/>
      ${(profile?.allergies && profile?.allergies.length > 0) ? profile.allergies.map(a => `• ${a}`).join('<br/>') : 'No known severe allergies recorded on profile.'}
    </div>
    <div class="card">
      <strong>🩺 Active Medical Conditions & History:</strong><br/>
      ${(profile?.conditions && profile?.conditions.length > 0) ? profile.conditions.map(c => `• ${c}`).join('<br/>') : 'No chronic conditions recorded.'}
      <br/><br/>
      <strong>Family History & Lifestyle Factors:</strong> Sleep: ${profile?.averageSleepHours || '—'} hrs/night | Smoking: ${profile?.smokingStatus || 'No'} | Alcohol: ${profile?.alcoholConsumption || 'No'}
    </div>
  </div>

  <!-- Section 3: Active Medications -->
  <div class="section">
    <div class="section-title">3. Active Medications & Reminder Schedule</div>
    <table class="table">
      <thead>
        <tr>
          <th>Medication Name</th>
          <th>Dosage & Instructions</th>
          <th>Frequency & Schedule</th>
        </tr>
      </thead>
      <tbody>
        ${(profile?.currentMedications && profile.currentMedications.length > 0) ? profile.currentMedications.map(m => `
          <tr>
            <td style="font-weight:700;">${m.name}</td>
            <td>${m.dose || 'Standard'} (${m.notes || 'No specific instruction'})</td>
            <td>${m.frequency} [⏰ ${(m.schedules || []).join(', ') || 'Standard Daily'}]</td>
          </tr>
        `).join('') : '<tr><td colspan="3">No routine medications logged.</td></tr>'}
      </tbody>
    </table>
  </div>

  <!-- Section 4: Recent Vitals & Physiological Trend -->
  <div class="section">
    <div class="section-title">4. Recent Vitals & Clinical Range Watcher Logs</div>
    <table class="table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Blood Pressure & HR</th>
          <th>Blood Sugar (Glucose)</th>
          <th>Weight & Temp</th>
          <th>Clinical Status</th>
        </tr>
      </thead>
      <tbody>
        ${(vitals && vitals.length > 0) ? vitals.slice(0, 8).map(v => {
          let d = v.date || (v.timestamp?.toDate ? v.timestamp.toDate().toLocaleDateString() : 'Recent');
          let bpHr = `${v.systolic ? `${v.systolic}/${v.diastolic || 80} mmHg` : '—'} ${v.heartRate ? `(HR: ${v.heartRate} bpm)` : ''}`;
          let glu = v.bloodSugar ? `${v.bloodSugar} mg/dL [${v.sugarType || 'Random'}]` : '—';
          let wtTemp = `${v.weight ? `${v.weight} kg` : '—'} ${v.temperature ? `| ${v.temperature}°F` : ''}`;
          
          let flag = 'Normal Range';
          let flagClass = 'badge-success';
          if ((v.systolic && Number(v.systolic) >= 130) || (v.bloodSugar && Number(v.bloodSugar) >= 126) || (v.temperature && Number(v.temperature) >= 100.4)) {
            flag = 'High / Out of Range';
            flagClass = 'badge-danger';
          }
          return `
            <tr>
              <td><strong>${d}</strong></td>
              <td>${bpHr}</td>
              <td>${glu}</td>
              <td>${wtTemp}</td>
              <td><span class="badge ${flagClass}">${flag}</span></td>
            </tr>
          `;
        }).join('') : '<tr><td colspan="5">No vitals logs recorded for this reporting period.</td></tr>'}
      </tbody>
    </table>
  </div>

  <!-- Section 5: Symptom Progression & Doctor Visit Logs -->
  <div class="section">
    <div class="section-title">5. Symptom Timeline & Physician Visit History</div>
    <table class="table">
      <thead>
        <tr>
          <th>Date & Record Type</th>
          <th>Summary & Diagnosis</th>
          <th>Severity / Specialty</th>
          <th>Clinical Notes</th>
        </tr>
      </thead>
      <tbody>
        ${[...(symptoms || []).slice(0, 5).map(s => ({ type: 'Symptom Log', date: s.date || (s.loggedAt?.toDate ? s.loggedAt.toDate().toLocaleDateString() : 'Recent'), title: s.symptom || s.symptomName, sev: `Severity: ${s.severity}/10`, notes: s.notes || s.duration || 'None' })),
          ...(visits || []).slice(0, 5).map(v => ({ type: 'Doctor Visit', date: v.visitDate || 'Recent', title: `Dr. ${v.doctorName}`, sev: v.specialty || 'General', notes: v.diagnosis || v.notes || 'Regular Consultation' }))]
        .sort((a,b) => new Date(b.date) - new Date(a.date))
        .map(row => `
          <tr>
            <td><strong>${row.date}</strong><br/><span style="color:#64748b; font-size:11px;">${row.type}</span></td>
            <td style="font-weight:700;">${row.title}</td>
            <td>${row.sev}</td>
            <td>${row.notes}</td>
          </tr>
        `).join('') || '<tr><td colspan="4">No recent symptoms or clinician visits logged.</td></tr>'}
      </tbody>
    </table>
  </div>

  <!-- Section 6: AI Lab Analyses & Vault Summary -->
  <div class="section">
    <div class="section-title">6. Health Vault & AI Lab Report Analyses Summary</div>
    <table class="table">
      <thead>
        <tr>
          <th>Analysis Date</th>
          <th>Report / Scan Title</th>
          <th>AI Evaluation Status</th>
          <th>Key Findings & Actionable Explanation</th>
        </tr>
      </thead>
      <tbody>
        ${(profile?.aiInsights && profile.aiInsights.length > 0) ? profile.aiInsights.map(i => `
          <tr>
            <td><strong>${i.date || 'Recent'}</strong></td>
            <td style="font-weight:700;">${i.title || 'Lab Report'}</td>
            <td><span class="badge ${i.status === 'Abnormal Flagged' ? 'badge-danger' : 'badge-success'}">${i.status}</span></td>
            <td>${i.summary}</td>
          </tr>
        `).join('') : '<tr><td colspan="4">No automated lab report evaluations stored on profile.</td></tr>'}
      </tbody>
    </table>
  </div>

  <div class="footer">
    ⚠️ <strong>MEDICAL & LEGAL DISCLAIMER:</strong> This consultation summary report is generated automatically by AI Health Brain from self-reported wellness tracking, user-uploaded laboratory files, and simulated medication reminders. It is intended strictly for personal reference and facilitate clinician consultation. It does not constitute a legal diagnostic prescription or emergency medical dispatch directive. Always verify clinical findings with a certified healthcare provider.
  </div>
</body>
</html>
    `;

    reportWindow.document.open();
    reportWindow.document.write(htmlContent);
    reportWindow.document.close();
    
    // Auto trigger print after rendering
    setTimeout(() => {
      reportWindow.focus();
      reportWindow.print();
    }, 400);
  };

  return (
    <div style={{ paddingBottom: '40px' }}>
      {/* ── 1. Medical Disclaimer Banner ── */}
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
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
        }}
      >
        <AlertTriangle size={22} style={{ color: '#d97706', flexShrink: 0 }} />
        <div style={{ fontSize: '0.78rem', color: '#92400e', lineHeight: 1.45 }}>
          <strong>EMERGENCY & RECORD DISCLAIMER:</strong> This digital emergency health card and physician report export is compiled from personal wellness tracking for informational reference. In a medical emergency, immediately contact local emergency services (911 or urgent ambulance dispatch) or seek emergency medical care.
        </div>
      </div>

      {/* ── 2. Top Header & View Switcher ── */}
      <div className="card" style={{ marginBottom: '20px', padding: '16px' }}>
        <div className="flex-between" style={{ flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)', margin: 0 }}>
              <Shield style={{ color: '#dc2626' }} /> Emergency Health ID & Doctor Report Export
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '4px 0 0' }}>
              Instant high-contrast lockscreen emergency card for first responders & printable consultation reports.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', width: '100%', maxWidth: '380px' }}>
            <button
              type="button"
              className={`btn ${activeView === 'card' ? 'btn-danger' : 'btn-ghost'}`}
              style={{ flex: 1, padding: '10px 12px', fontSize: '0.825rem', fontWeight: 700, borderRadius: '8px', backgroundColor: activeView === 'card' ? '#dc2626' : 'transparent', color: activeView === 'card' ? '#fff' : 'var(--text-secondary)' }}
              onClick={() => setActiveView('card')}
            >
              🆘 Emergency ID Card
            </button>
            <button
              type="button"
              className={`btn ${activeView === 'report' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ flex: 1, padding: '10px 12px', fontSize: '0.825rem', fontWeight: 700, borderRadius: '8px', backgroundColor: activeView === 'report' ? '#2563eb' : 'transparent', color: activeView === 'report' ? '#fff' : 'var(--text-secondary)' }}
              onClick={() => setActiveView('report')}
            >
              📋 Doctor Export Report
            </button>
          </div>
        </div>
      </div>

      {/* ── VIEW 1: HIGH-CONTRAST EMERGENCY ID POCKET CARD ── */}
      {activeView === 'card' && (
        <div>
          {/* Action Row */}
          <div className="flex-between" style={{ marginBottom: '16px', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ padding: '8px 16px', fontSize: '0.85rem', fontWeight: 600 }}
              onClick={() => setShowEditEmergency(!showEditEmergency)}
            >
              <Edit3 size={16} /> {showEditEmergency ? '✕ Cancel Editing' : '✏️ Edit Emergency & Physician Info'}
            </button>
            
            <button
              type="button"
              className="btn btn-primary"
              style={{ padding: '8px 18px', fontSize: '0.85rem', fontWeight: 700, backgroundColor: '#dc2626', borderColor: '#b91c1c' }}
              onClick={handleExportPDFReport}
            >
              <Printer size={16} /> 🖨️ Print Pocket Card / Full Report
            </button>
          </div>

          {/* Editable Form Modal / Dropdown */}
          {showEditEmergency && (
            <div className="card" style={{ marginBottom: '20px', backgroundColor: '#f8fafc', border: '2px solid #94a3b8', padding: '18px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ✏️ Configure Emergency Responder Details
              </h3>
              <form onSubmit={handleSaveEmergencyInfo} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  <div>
                    <label className="form-label">Primary Emergency Contact Name</label>
                    <input type="text" placeholder="e.g. Jane Doe" value={contactName} onChange={e => setContactName(e.target.value)} style={{ width: '100%', height: '38px', padding: '0 12px', borderRadius: '6px', border: '1px solid var(--border)' }} />
                  </div>
                  <div>
                    <label className="form-label">Relationship to Patient</label>
                    <input type="text" placeholder="e.g. Spouse / Mother / Brother" value={contactRelation} onChange={e => setContactRelation(e.target.value)} style={{ width: '100%', height: '38px', padding: '0 12px', borderRadius: '6px', border: '1px solid var(--border)' }} />
                  </div>
                  <div>
                    <label className="form-label">Emergency Phone Number</label>
                    <input type="tel" placeholder="e.g. +1 (555) 019-2831" value={contactPhone} onChange={e => setContactPhone(e.target.value)} style={{ width: '100%', height: '38px', padding: '0 12px', borderRadius: '6px', border: '1px solid var(--border)' }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  <div>
                    <label className="form-label">Primary Physician Name</label>
                    <input type="text" placeholder="e.g. Robert Smith" value={doctorName} onChange={e => setDoctorName(e.target.value)} style={{ width: '100%', height: '38px', padding: '0 12px', borderRadius: '6px', border: '1px solid var(--border)' }} />
                  </div>
                  <div>
                    <label className="form-label">Clinic / Hospital / Specialty</label>
                    <input type="text" placeholder="e.g. Memorial Hospital Cardiology" value={doctorSpecialty} onChange={e => setDoctorSpecialty(e.target.value)} style={{ width: '100%', height: '38px', padding: '0 12px', borderRadius: '6px', border: '1px solid var(--border)' }} />
                  </div>
                  <div>
                    <label className="form-label">Physician Phone / Extension</label>
                    <input type="tel" placeholder="e.g. +1 (555) 902-1100" value={doctorPhone} onChange={e => setDoctorPhone(e.target.value)} style={{ width: '100%', height: '38px', padding: '0 12px', borderRadius: '6px', border: '1px solid var(--border)' }} />
                  </div>
                  <div>
                    <label className="form-label">Organ Donor Status</label>
                    <select value={organDonor} onChange={e => setOrganDonor(e.target.value)} style={{ width: '100%', height: '38px', padding: '0 12px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                      <option value="Yes - Registered">Yes - Registered</option>
                      <option value="No">No</option>
                      <option value="Undecided">Undecided</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
                  <button type="button" className="btn btn-ghost" onClick={() => setShowEditEmergency(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? 'Saving...' : '✓ Save Emergency Details'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* High Contrast Medical Card */}
          <div
            style={{
              background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
              borderRadius: '20px',
              color: '#ffffff',
              boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
              overflow: 'hidden',
              border: '3px solid #dc2626',
              marginBottom: '20px',
              maxWidth: '680px',
              margin: '0 auto 24px auto'
            }}
          >
            {/* Red Header Bar */}
            <div style={{ backgroundColor: '#dc2626', padding: '16px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dc2626', fontWeight: 900, fontSize: '1.4rem' }}>
                  🏥
                </div>
                <div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, letterSpacing: '0.8px', textTransform: 'uppercase', lineHeight: 1.1 }}>
                    Emergency Medical ID
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#fee2e2', fontWeight: 600 }}>
                    AI HEALTH BRAIN VERIFIED FIRST RESPONDER TAG
                  </div>
                </div>
              </div>

              <div style={{ backgroundColor: '#ffffff', color: '#dc2626', padding: '6px 14px', borderRadius: '16px', fontWeight: 900, fontSize: '1.4rem', boxShadow: '0 2px 6px rgba(0,0,0,0.2)', textAlign: 'center' }}>
                {profile?.bloodType || 'O+'}
                <div style={{ fontSize: '0.6rem', color: '#475569', textTransform: 'uppercase', fontWeight: 700, marginTop: '-2px' }}>Blood Group</div>
              </div>
            </div>

            {/* Patient Name & Demographics Bar */}
            <div style={{ padding: '22px 24px', borderBottom: '1px solid #334155' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#ffffff', marginBottom: '6px' }}>
                {profile?.name || 'Patient Record'}
              </div>
              <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', fontSize: '0.9rem', color: '#cbd5e1', fontWeight: 600 }}>
                <span>🎂 DOB: {profile?.dateOfBirth || 'Not stated'} ({age !== 'N/A' ? `${age} yrs` : '—'})</span>
                <span>👤 Gender: {profile?.gender || 'Unspecified'}</span>
                <span>❤️ Organ Donor: <strong>{profile?.organDonor || 'Yes - Registered'}</strong></span>
              </div>
            </div>

            {/* Critical Red Alert Box: Severe Allergies */}
            <div style={{ padding: '18px 24px', backgroundColor: '#7f1d1d', borderBottom: '1px solid #991b1b', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
              <AlertCircle size={26} style={{ color: '#fca5a5', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', fontWeight: 800, color: '#fca5a5', letterSpacing: '0.5px' }}>
                  ⚠️ Severe Drug & Dietary Allergies / Contraindications
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ffffff', marginTop: '4px', lineHeight: 1.4 }}>
                  {(profile?.allergies && profile?.allergies.length > 0) ? profile.allergies.join(' • ') : 'NO KNOWN SEVERE DRUG OR FOOD ALLERGIES RECORDED'}
                </div>
              </div>
            </div>

            {/* Medical Conditions & Medications Grid */}
            <div style={{ padding: '20px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px', borderBottom: '1px solid #334155' }}>
              <div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Activity size={16} style={{ color: '#38bdf8' }} /> Active Chronic Medical Conditions
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {(profile?.conditions && profile?.conditions.length > 0) ? profile.conditions.map((c, idx) => (
                    <div key={idx} style={{ fontSize: '0.92rem', fontWeight: 700, color: '#e2e8f0', padding: '6px 10px', backgroundColor: '#334155', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      🩺 {c}
                    </div>
                  )) : <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic' }}>No active chronic conditions recorded</span>}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 800, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Pill size={16} style={{ color: '#4ade80' }} /> Current Prescribed Medications
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {(profile?.currentMedications && profile.currentMedications.length > 0) ? profile.currentMedications.map((m, idx) => (
                    <div key={idx} style={{ padding: '6px 10px', backgroundColor: '#166534', borderRadius: '6px', color: '#ffffff' }}>
                      <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>💊 {m.name} ({m.dose || 'Std'})</div>
                      <div style={{ fontSize: '0.75rem', color: '#dcfce7' }}>Frequency: {m.frequency}</div>
                    </div>
                  )) : <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic' }}>No regular daily routine medications</span>}
                </div>
              </div>
            </div>

            {/* Bottom Contact Footer */}
            <div style={{ padding: '20px 24px', backgroundColor: '#090d16', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
              <div style={{ padding: '12px', backgroundColor: '#1e293b', borderRadius: '10px', border: '1px solid #334155' }}>
                <div style={{ fontSize: '0.75rem', color: '#f87171', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Phone size={14} style={{ color: '#f87171' }} /> Emergency Contact (In case of emergency)
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff' }}>
                  {currentEmergencyContact?.name || 'No Contact Set'} 
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 500 }}> ({currentEmergencyContact?.relation || '—'})</span>
                </div>
                {currentEmergencyContact?.phone && (
                  <a href={`tel:${currentEmergencyContact.phone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '6px', padding: '4px 10px', backgroundColor: '#dc2626', color: '#fff', borderRadius: '6px', fontWeight: 700, fontSize: '0.825rem', textDecoration: 'none' }}>
                    📞 Call: {currentEmergencyContact.phone}
                  </a>
                )}
              </div>

              <div style={{ padding: '12px', backgroundColor: '#1e293b', borderRadius: '10px', border: '1px solid #334155' }}>
                <div style={{ fontSize: '0.75rem', color: '#38bdf8', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Stethoscope size={14} style={{ color: '#38bdf8' }} /> Primary Physician / Healthcare Provider
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: '#ffffff' }}>
                  Dr. {profile?.primaryDoctor?.name || 'No Physician Set'} 
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 500 }}> ({profile?.primaryDoctor?.specialty || 'General'})</span>
                </div>
                {profile?.primaryDoctor?.phone && (
                  <a href={`tel:${profile.primaryDoctor.phone}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '6px', padding: '4px 10px', backgroundColor: '#0284c7', color: '#fff', borderRadius: '6px', fontWeight: 700, fontSize: '0.825rem', textDecoration: 'none' }}>
                    📞 Call Dr: {profile.primaryDoctor.phone}
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── VIEW 2: COMPREHENSIVE DOCTOR CONSULTATION EXPORT REPORT PREVIEW ── */}
      {activeView === 'report' && (
        <div>
          <div className="card" style={{ marginBottom: '20px', padding: '24px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <div className="flex-between" style={{ borderBottom: '2px solid #2563eb', paddingBottom: '16px', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ fontSize: '1.4rem', fontWeight: 900, color: '#1e3a8a', margin: 0, textTransform: 'uppercase' }}>
                  Clinical Medical Record Summary
                </h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  AI HEALTH BRAIN COMPREHENSIVE CONSULTATION REPORT
                </span>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                style={{ padding: '12px 24px', fontWeight: 800, fontSize: '0.95rem', backgroundColor: '#2563eb', boxShadow: '0 4px 10px rgba(37, 99, 235, 0.25)' }}
                onClick={handleExportPDFReport}
              >
                🖨️ Generate & Print PDF Report
              </button>
            </div>

            {/* Section 1: Patient Summary */}
            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1e3a8a', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '12px', textTransform: 'uppercase' }}>
                1. Demographic & Clinical Profile Overview
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '0.875rem' }}>
                <div style={{ padding: '10px 12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700 }}>PATIENT NAME & AGE</div>
                  <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>{profile?.name || 'Anonymous'} ({age !== 'N/A' ? `${age} yrs` : '—'})</strong>
                </div>
                <div style={{ padding: '10px 12px', backgroundColor: '#fef2f2', borderRadius: '8px', border: '1px solid #fca5a5' }}>
                  <div style={{ fontSize: '0.75rem', color: '#b91c1c', fontWeight: 700 }}>BLOOD GROUP & ALLERGIES</div>
                  <strong style={{ fontSize: '0.95rem', color: '#991b1b' }}>{profile?.bloodType || 'O+'} | {(profile?.allergies || []).join(', ') || 'No Allergies'}</strong>
                </div>
                <div style={{ padding: '10px 12px', backgroundColor: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                  <div style={{ fontSize: '0.75rem', color: '#1d4ed8', fontWeight: 700 }}>PRIMARY DOCTOR CONTACT</div>
                  <strong style={{ fontSize: '0.95rem', color: '#1e3a8a' }}>Dr. {profile?.primaryDoctor?.name || 'Unspecified'} ({profile?.primaryDoctor?.phone || 'No Phone'})</strong>
                </div>
              </div>
            </div>

            {/* Section 2: Active Regimen */}
            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1e3a8a', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '12px', textTransform: 'uppercase' }}>
                2. Active Medication Schedule & Clinical Adherence
              </h4>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1', textAlign: 'left' }}>
                      <th style={{ padding: '10px' }}>Medication Name</th>
                      <th style={{ padding: '10px' }}>Dosage & Regimen Notes</th>
                      <th style={{ padding: '10px' }}>Frequency & Reminder Times</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(profile?.currentMedications && profile.currentMedications.length > 0) ? profile.currentMedications.map((m, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: '10px', fontWeight: 700 }}>💊 {m.name}</td>
                        <td style={{ padding: '10px' }}>{m.dose} ({m.notes || 'Standard compliance'})</td>
                        <td style={{ padding: '10px' }}>{m.frequency} <strong>[⏰ {(m.schedules || []).join(', ') || '08:00 AM'}]</strong></td>
                      </tr>
                    )) : <tr><td colSpan={3} style={{ padding: '12px', textAlign: 'center', color: '#64748b' }}>No routine medications currently recorded.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section 3: Vitals & Symptoms Roster */}
            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1e3a8a', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '12px', textTransform: 'uppercase' }}>
                3. Vitals & Symptom Severity Log Summary (Recent 10 Entries)
              </h4>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1', textAlign: 'left' }}>
                      <th style={{ padding: '10px' }}>Date</th>
                      <th style={{ padding: '10px' }}>Blood Pressure & HR</th>
                      <th style={{ padding: '10px' }}>Blood Sugar (mg/dL)</th>
                      <th style={{ padding: '10px' }}>Weight & Temp</th>
                      <th style={{ padding: '10px' }}>Clinical Range Evaluation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(vitals && vitals.length > 0) ? vitals.slice(0, 10).map((v, idx) => {
                      let d = v.date || (v.timestamp?.toDate ? v.timestamp.toDate().toLocaleDateString() : 'Recent');
                      let bpHr = `${v.systolic ? `${v.systolic}/${v.diastolic || 80} mmHg` : '—'} ${v.heartRate ? `(HR: ${v.heartRate} bpm)` : ''}`;
                      let glu = v.bloodSugar ? `${v.bloodSugar} [${v.sugarType || 'Random'}]` : '—';
                      let wtTemp = `${v.weight ? `${v.weight} kg` : '—'} ${v.temperature ? `| ${v.temperature}°F` : ''}`;
                      
                      let isHigh = (v.systolic && Number(v.systolic) >= 130) || (v.bloodSugar && Number(v.bloodSugar) >= 126) || (v.temperature && Number(v.temperature) >= 100.4);
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: isHigh ? '#fff5f5' : 'transparent' }}>
                          <td style={{ padding: '10px', fontWeight: 700 }}>📅 {d}</td>
                          <td style={{ padding: '10px' }}>{bpHr}</td>
                          <td style={{ padding: '10px' }}>{glu}</td>
                          <td style={{ padding: '10px' }}>{wtTemp}</td>
                          <td style={{ padding: '10px' }}>
                            <span className={`badge ${isHigh ? 'badge-danger' : 'badge-success'}`} style={{ fontWeight: 700 }}>
                              {isHigh ? '▲ High / Out of Range' : '● Normal Range'}
                            </span>
                          </td>
                        </tr>
                      );
                    }) : <tr><td colSpan={5} style={{ padding: '12px', textAlign: 'center', color: '#64748b' }}>No vitals readings logged in current period.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Section 4: AI Lab Insights */}
            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#1e3a8a', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '12px', textTransform: 'uppercase' }}>
                4. AI Lab Report & Scan Analytical Findings
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {(profile?.aiInsights && profile.aiInsights.length > 0) ? profile.aiInsights.slice(0, 6).map((i, idx) => (
                  <div key={idx} style={{ padding: '12px', backgroundColor: '#f8fafc', border: '1px solid var(--border)', borderRadius: '8px' }}>
                    <div className="flex-between" style={{ marginBottom: '4px' }}>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>🔬 {i.title || 'Analyzed Report'} ({i.date || 'Recent'})</strong>
                      <span className={`badge ${i.status === 'Abnormal Flagged' ? 'badge-danger' : 'badge-success'}`}>
                        {i.status}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      {i.summary}
                    </p>
                  </div>
                )) : <span className="text-muted" style={{ fontSize: '0.85rem', display: 'block' }}>No analyzed lab reports or scans stored on profile yet.</span>}
              </div>
            </div>

            <div style={{ marginTop: '28px', textAlign: 'center' }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ padding: '12px 30px', fontWeight: 800, fontSize: '1rem', backgroundColor: '#2563eb' }}
                onClick={handleExportPDFReport}
              >
                🖨️ Open Full Printable Report / Save to PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
