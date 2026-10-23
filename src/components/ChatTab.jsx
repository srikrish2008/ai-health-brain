import React, { useState, useRef, useEffect } from 'react';
import { auth } from '../firebase';
import {
  Bot, Send, AlertTriangle, Paperclip, X, User as UserIcon,
  Sparkles, CheckCircle2, PlusCircle, Activity, Heart, Shield,
  FileText, HelpCircle, ArrowUpRight, Check, Pill
} from 'lucide-react';

export default function ChatTab({ profile, symptoms = [], visits = [], vaultFiles = [], vitals = [], onLogSymptom }) {
  const [messages, setMessages] = useState([
    {
      id: 'welcome-msg',
      role: 'assistant',
      text: `Hello! I am your **AI Health Assistant**. I have complete access to your Health Brain profile, logged symptoms, medication list, and uploaded lab vault for fully personalized context.\n\nHow can I support your wellness today? Feel free to ask about your lab reports, medications, or share any symptoms you are experiencing.`,
      timestamp: new Date()
    }
  ]);
  
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedVaultDoc, setSelectedVaultDoc] = useState(null);
  const [loggedSymptomsMap, setLoggedSymptomsMap] = useState({}); // tracking confirmed logged symptoms by message id

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Construct intelligent system prompt with user's full medical profile
  const buildSystemInstruction = () => {
    const dob = profile?.dateOfBirth || 'Not specified';
    const gender = profile?.gender || 'Not specified';
    const bloodType = profile?.bloodType || 'Not specified';
    const height = profile?.height ? `${profile.height} cm/in` : 'Not recorded';
    const weight = profile?.weight ? `${profile.weight} kg/lbs` : 'Not recorded';

    const conds = (profile?.conditions || []).join(', ') || 'None reported';
    const allergies = (profile?.allergies || []).join(', ') || 'None reported';
    const meds = (profile?.currentMedications || [])
      .map(m => `${m.name || 'Medication'} (Dose: ${m.dose || 'N/A'}, Frequency: ${m.frequency || 'N/A'}, Times: ${(m.schedules || []).join(', ') || '08:00 AM'}${m.instructions ? `, Instructions: ${m.instructions}` : ''})`).join('\n• ') || 'None currently active';
    const pastMeds = (profile?.pastMedications || [])
      .map(m => `${m.name} (for ${m.reason || 'condition'})`).join('; ') || 'None';
    const familyHist = (profile?.familyHistory || []).join(', ') || 'None reported';

    // Check today's medication adherence record
    const todayStr = new Date().toISOString().split('T')[0];
    const todayLogs = profile?.medicationLogs?.[todayStr] || {};
    const adherenceSummary = Object.entries(todayLogs).length > 0
      ? Object.entries(todayLogs).map(([key, status]) => `• ${key.replace('_', ' at time slot ')}: Marked as [${status.toUpperCase()}] today`).join('\n')
      : 'No medication doses marked as taken or missed yet today.';

    // Check saved AI drug interaction screening reports
    const interactionReport = profile?.drugInteractions 
      ? `Status: ${profile.drugInteractions.safetyLevel} (Checked on ${profile.drugInteractions.analyzedAt || 'recently'})\nSummary: ${profile.drugInteractions.summary}\nInteractions Identified: ${JSON.stringify(profile.drugInteractions.interactions || [])}\nAllergy Conflicts: ${JSON.stringify(profile.drugInteractions.allergyWarnings || [])}`
      : 'No recent automated drug interaction check performed yet.';

    const recentSymptoms = (symptoms || []).slice(0, 6).map(s => {
      let d = s.date || 'Recent';
      if (s.loggedAt?.toDate) d = s.loggedAt.toDate().toLocaleDateString();
      return `• [${d}] ${s.symptom || s.symptomName || 'Symptom'}: Severity ${s.severity || 'N/A'}, Duration ${s.duration || 'N/A'}, Notes: ${s.notes || ''}`;
    }).join('\n') || 'No recent symptoms recorded.';

    const recentVisits = (visits || []).slice(0, 4).map(v => {
      let d = v.visitDate || 'Recent';
      return `• [${d}] Dr. ${v.doctorName || 'Doctor'} (${v.specialty || 'General'}): Diagnosis/Notes: ${v.notes || v.diagnosis || ''}`;
    }).join('\n') || 'No doctor visit logs.';

    const aiAnalyses = (profile?.aiInsights || []).slice(0, 6).map(i => {
      return `• [${i.date}] "${i.title}" (Status: ${i.status}): ${i.summary}`;
    }).join('\n') || 'No lab reports analyzed yet.';

    const vaultDocsList = (vaultFiles || []).slice(0, 10).map(v => {
      return `• [${v.category}] "${v.title}" (Uploaded on ${v.documentDate || 'unknown date'})`;
    }).join('\n') || 'No documents currently in Health Vault.';

    const recentVitals = (vitals || []).slice(0, 6).map(v => {
      let d = v.date || (v.timestamp?.toDate ? v.timestamp.toDate().toLocaleDateString() : 'Recent');
      let bp = v.systolic ? `BP: ${v.systolic}/${v.diastolic || '80'} mmHg` : '';
      let hr = v.heartRate ? `HR: ${v.heartRate} BPM` : '';
      let glu = v.bloodSugar ? `Glucose: ${v.bloodSugar} mg/dL (${v.sugarType || 'Random'})` : '';
      let tmp = v.temperature ? `Temp: ${v.temperature} °F` : '';
      let wt = v.weight ? `Weight: ${v.weight} kg` : '';
      return `• [${d}] ${[bp, hr, glu, tmp, wt].filter(Boolean).join(' | ')}`;
    }).join('\n') || 'No recent vital check-ins logged yet.';

    return `
You are AI Health Brain, an empathetic, highly knowledgeable, and clear conversational health companion.
You are chatting with your patient. Always communicate clearly, in a compassionate and reassuring tone.
Use markdown bullet points, bold text for key medical terms, and concise paragraphs so your advice is clean and easy to scan on mobile devices.

=== PATIENT HEALTH BRAIN PROFILE ===
• Basic Info: DOB: ${dob}, Gender: ${gender}, Blood Type: ${bloodType}, Height: ${height}, Weight: ${weight}
• Medical Conditions: ${conds}
• Allergies: ${allergies}
• Active Medication Regimen & Reminders:
• ${meds}
• Past Medications: ${pastMeds}
• Family History: ${familyHist}
• Lifestyle: Sleep: ${profile?.averageSleepHours || 'N/A'} hrs/night, Smoking: ${profile?.smokingStatus || 'No'}, Alcohol: ${profile?.alcoholConsumption || 'No'}, Exercise: ${profile?.exerciseFrequency || 'Moderate'}

=== RECENT VITALS & CLINICAL MONITORING HISTORY ===
${recentVitals}

=== TODAY'S MEDICATION ADHERENCE TRACKING (${todayStr}) ===
${adherenceSummary}

=== KNOWN DRUG INTERACTION & ALLERGY SCREENING ===
${interactionReport}

=== PATIENT SYMPTOMS LOGGED (FROM SYMPTOMS TAB) ===
${recentSymptoms}

=== DOCTOR VISIT LOGS ===
${recentVisits}

=== ANALYZED LAB REPORTS & HEALTH VAULT CONTEXT ===
${aiAnalyses}
${vaultDocsList}

=== CRITICAL BEHAVIOR & GUIDANCE ===
1. PERSONALIZED INSIGHTS: Continually incorporate the patient's existing profile, known allergies, active medication time schedules, adherence logs, or past lab results when answering questions to provide tailored medical awareness and synergy.
2. MEDICATION SUPPORT: If the user asks about taking medications or missed doses, refer explicitly to their active regimen, today's adherence checklist status, and remind them of any drug-drug or drug-allergy interactions identified.
3. CONVERSATIONAL SYMPTOM DETECTION: If the user mentions experiencing a new symptom or experiencing pain/discomfort in this message (e.g., headache, fever, nausea, cough, dizziness, fatigue), acknowledge their discomfort with empathy and give safe care guidance. AT THE VERY END OF YOUR RESPONSE, append a structured code block exactly in this format on a new line so the app interface can prompt them to log it:
<symptom_log>{"symptom": "Name of Symptom", "severity": "Mild | Moderate | Severe", "duration": "Duration if mentioned or 'Recently started'", "notes": "Brief context from chat"}</symptom_log>
4. MEDICAL DISCLAIMER & SAFETY: Remind the user appropriately that you provide educational health insights only and do not replace a licensed physician or clinical pharmacology prescription. If symptoms sound urgent (e.g. chest pain, severe shortness of breath), strongly urge immediate emergency medical care.
    `.trim();
  };

  const parseMessageContent = (text = '') => {
    let cleanText = text;
    let symptomToLog = null;
    const regex = /<symptom_log>([\s\S]*?)<\/symptom_log>/i;
    const match = text.match(regex);

    if (match && match[1]) {
      try {
        symptomToLog = JSON.parse(match[1].trim());
        cleanText = text.replace(regex, '').trim();
      } catch (err) {
        console.error('Failed to parse symptom_log JSON:', match[1], err);
      }
    }
    return { cleanText, symptomToLog };
  };

  const handleSendMessage = async (customPrompt = null) => {
    const textToSend = customPrompt || input;
    if (!textToSend.trim() && !selectedVaultDoc) return;

    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: textToSend,
      attachment: selectedVaultDoc ? {
        id: selectedVaultDoc.id,
        title: selectedVaultDoc.title,
        category: selectedVaultDoc.category,
        url: selectedVaultDoc.fileUrl,
        type: selectedVaultDoc.fileType
      } : null,
      timestamp: new Date()
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    if (!customPrompt) setInput('');
    const currentAttachment = selectedVaultDoc;
    setSelectedVaultDoc(null);
    setLoading(true);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Please sign in to chat.');
      const idToken = await currentUser.getIdToken();

      // Format conversation history for Gemini (excluding first intro message if desired, or map cleanly)
      const historyPayload = updatedMessages
        .filter(m => m.id !== 'welcome-msg')
        .slice(0, -1) // exclude latest message which goes into prompt
        .map(m => ({
          role: m.role,
          text: m.text + (m.attachment ? ` [Attached document: ${m.attachment.title}]` : '')
        }));

      let fileDataPayload = null;
      if (currentAttachment && currentAttachment.url) {
        fileDataPayload = {
          url: currentAttachment.url,
          mimeType: currentAttachment.type || 'application/pdf'
        };
      }

      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: userMessage.text || (currentAttachment ? `Please examine this attached document "${currentAttachment.title}" and explain what it reveals about my health.` : 'Hello'),
          systemInstruction: buildSystemInstruction(),
          history: historyPayload.length > 0 ? historyPayload : undefined,
          fileData: fileDataPayload
        })
      });

      if (!response.ok) {
        let errMessage = 'Server error while generating response.';
        try {
          const errData = await response.json();
          errMessage = errData.error || errData.details || errMessage;
        } catch {
          const text = await response.text();
          if (text) errMessage = `Server returned status ${response.status}: ${text.slice(0, 150)}`;
        }
        throw new Error(errMessage);
      }

      const data = await response.json();
      const assistantText = data.text || 'I apologize, but I encountered an error interpreting that request. How else may I assist you?';

      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          text: assistantText,
          timestamp: new Date()
        }
      ]);
    } catch (err) {
      console.error('Chat Error:', err);
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          text: `⚠️ **Connection Error**: ${err.message || 'Unable to connect to AI server.'}\n\nPlease verify your network or server status and try sending your message again.`,
          isError: true,
          timestamp: new Date()
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmLogSymptom = async (msgId, symptomData) => {
    if (!onLogSymptom) return;
    try {
      await onLogSymptom({
        symptomName: symptomData.symptom || 'Reported Symptom',
        symptom: symptomData.symptom || 'Reported Symptom',
        severity: symptomData.severity || 'Moderate',
        duration: symptomData.duration || 'Recently started',
        notes: symptomData.notes || 'Logged via AI Health Assistant chat',
        date: new Date().toISOString().split('T')[0]
      });
      setLoggedSymptomsMap(prev => ({ ...prev, [msgId]: true }));
    } catch (err) {
      console.error('Error recording symptom from chat:', err);
    }
  };

  const quickPrompts = [
    { text: 'Review my recent vitals trend and let me know if any blood pressure or glucose reading needs attention', icon: Activity },
    { text: 'Check my medication schedule and review for potential drug or allergy interactions', icon: Pill },
    { text: 'Review my health profile and give 3 targeted lifestyle suggestions', icon: Sparkles },
    { text: 'Summarize my latest lab reports and check if anything needs attention', icon: FileText }
  ];

  return (
    <div className="chat-container" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 150px)', minHeight: '520px' }}>
      {/* ── 1. Medical Disclaimer Banner ── */}
      <div
        style={{
          backgroundColor: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: 'var(--radius)',
          padding: '12px 14px',
          marginBottom: '12px',
          display: 'flex',
          gap: '10px',
          alignItems: 'center',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
          flexShrink: 0
        }}
      >
        <AlertTriangle size={20} style={{ color: '#d97706', flexShrink: 0 }} />
        <div style={{ fontSize: '0.78rem', color: '#92400e', lineHeight: 1.4 }}>
          <strong>MEDICAL DISCLAIMER:</strong> This AI Health Assistant provides conversational health information and lifestyle education only. It does <strong>not</strong> provide professional medical diagnosis, treatment, or clinical prescriptions. Consult a licensed doctor for any health decisions or emergencies.
        </div>
      </div>

      {/* Header Badge */}
      <div className="flex-between" style={{ padding: '0 4px', marginBottom: '8px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', fontSize: '0.75rem' }}>
            <Shield size={12} /> Profile & Vault Context Connected
          </span>
        </div>
      </div>

      {/* ── 2. Chat Messages Area ── */}
      <div
        className="card"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          marginBottom: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          backgroundColor: '#f8fafc',
          border: '1px solid var(--border)'
        }}
      >
        {messages.map((msg, index) => {
          const isUser = msg.role === 'user';
          const { cleanText, symptomToLog } = !isUser ? parseMessageContent(msg.text) : { cleanText: msg.text, symptomToLog: null };

          return (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                gap: '10px',
                alignItems: 'flex-start',
                alignSelf: isUser ? 'flex-end' : 'flex-start',
                maxWidth: isUser ? '85%' : '92%',
                flexDirection: isUser ? 'row-reverse' : 'row'
              }}
            >
              {/* Avatar Icon */}
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: isUser ? 'var(--primary)' : '#10b981',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: '0 2px 5px rgba(0,0,0,0.1)'
                }}
              >
                {isUser ? <UserIcon size={16} /> : <Bot size={18} />}
              </div>

              {/* Message Content Box */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                <div
                  style={{
                    backgroundColor: isUser ? 'var(--primary)' : '#ffffff',
                    color: isUser ? '#ffffff' : 'var(--text-primary)',
                    padding: '12px 16px',
                    borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    boxShadow: 'var(--shadow-sm)',
                    border: isUser ? 'none' : '1px solid var(--border)',
                    fontSize: '0.92rem',
                    lineHeight: 1.55,
                    whiteSpace: 'pre-line',
                    wordBreak: 'break-word'
                  }}
                >
                  {/* Attached File Display if User attached one */}
                  {msg.attachment && (
                    <div
                      style={{
                        padding: '8px 10px',
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        borderRadius: '8px',
                        marginBottom: '8px',
                        fontSize: '0.825rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <FileText size={16} />
                      <span style={{ fontWeight: 600 }}>Attached Vault Doc: {msg.attachment.title}</span>
                    </div>
                  )}

                  {cleanText}
                </div>

                {/* ── Conversational Symptom Recording Interactive Card ── */}
                {symptomToLog && (
                  <div
                    style={{
                      padding: '14px',
                      backgroundColor: '#eff6ff',
                      border: '1px solid #bfdbfe',
                      borderRadius: '12px',
                      marginTop: '4px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e40af', fontWeight: 700, fontSize: '0.85rem', marginBottom: '8px' }}>
                      <Activity size={18} style={{ color: '#2563eb' }} />
                      <span>Symptom Detected in Conversation</span>
                    </div>
                    <div style={{ fontSize: '0.825rem', color: '#1e293b', marginBottom: '10px', display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 12px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Symptom:</span> <strong>{symptomToLog.symptom}</strong>
                      <span style={{ color: 'var(--text-muted)' }}>Severity:</span> <strong>{symptomToLog.severity}</strong>
                      <span style={{ color: 'var(--text-muted)' }}>Duration:</span> <strong>{symptomToLog.duration}</strong>
                      {symptomToLog.notes && <><span style={{ color: 'var(--text-muted)' }}>Notes:</span> <span>{symptomToLog.notes}</span></>}
                    </div>

                    {loggedSymptomsMap[msg.id] ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#15803d', fontWeight: 700, fontSize: '0.8rem', padding: '6px 12px', backgroundColor: '#dcfce7', borderRadius: '8px', border: '1px solid #86efac' }}>
                        <CheckCircle2 size={16} /> Successfully logged to your Health Brain Symptoms record!
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ padding: '8px 14px', fontSize: '0.8rem', minHeight: '34px', backgroundColor: '#2563eb' }}
                        onClick={() => handleConfirmLogSymptom(msg.id, symptomToLog)}
                      >
                        <PlusCircle size={15} /> Save to Symptoms Record
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Loading Bubble */}
        {loading && (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', margin: '8px 0' }}>
            <div
              style={{
                width: '32px', height: '32px', borderRadius: '50%',
                backgroundColor: '#10b981', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <Bot size={18} />
            </div>
            <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--border)', padding: '10px 16px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }} />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>AI Health Brain is thinking...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ── 3. Quick Suggestions (When conversation has only intro) ── */}
      {messages.length <= 1 && !loading && (
        <div style={{ marginBottom: '12px', flexShrink: 0 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
            Suggested Health Topics
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '8px' }}>
            {quickPrompts.map((qp, idx) => {
              const QPIcon = qp.icon;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(qp.text)}
                  style={{
                    padding: '10px 12px',
                    backgroundColor: '#ffffff',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    transition: 'var(--transition)',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                  }}
                  onMouseOver={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                  onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <QPIcon size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {qp.text}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Selected Document Indicator */}
      {selectedVaultDoc && (
        <div
          style={{
            padding: '8px 12px',
            backgroundColor: '#f1f5f9',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.825rem', color: 'var(--text-primary)' }}>
            <FileText size={16} style={{ color: 'var(--primary)' }} />
            <span>Attaching report: <strong>{selectedVaultDoc.title}</strong> ({selectedVaultDoc.category})</span>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: '4px', minHeight: '28px' }}
            onClick={() => setSelectedVaultDoc(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── 4. Input Controls Bar ── */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
        {/* Vault Document Selector Dropdown */}
        {vaultFiles && vaultFiles.length > 0 && (
          <div style={{ position: 'relative' }}>
            <select
              title="Attach a report or scan from Health Vault"
              onChange={e => {
                const doc = vaultFiles.find(v => v.id === e.target.value);
                if (doc) setSelectedVaultDoc(doc);
                e.target.value = '';
              }}
              style={{
                width: '42px',
                height: '46px',
                padding: '0',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                backgroundColor: 'var(--bg-card)',
                cursor: 'pointer',
                opacity: 0,
                position: 'absolute',
                top: 0,
                left: 0,
                zIndex: 2
              }}
            >
              <option value="">Attach Report...</option>
              {vaultFiles.map(v => (
                <option key={v.id} value={v.id}>
                  [{v.category}] {v.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ width: '46px', height: '46px', padding: 0, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              title="Attach report from Health Vault"
            >
              <Paperclip size={20} style={{ color: 'var(--primary)' }} />
            </button>
          </div>
        )}

        <input
          type="text"
          placeholder="Ask a health question, log a symptom, or discuss a test report..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          disabled={loading}
          style={{
            flex: 1,
            height: '46px',
            borderRadius: '10px',
            fontSize: '0.92rem',
            padding: '0 16px'
          }}
        />

        <button
          type="button"
          className="btn btn-primary"
          style={{ width: '46px', height: '46px', padding: 0, borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          onClick={() => handleSendMessage()}
          disabled={loading || (!input.trim() && !selectedVaultDoc)}
          aria-label="Send Message"
        >
          <Send size={18} />
        </button>
      </div>

      <footer style={{ marginTop: '12px', textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', flexShrink: 0 }}>
        <p style={{ margin: 0 }}>⚠️ <strong>Medical Disclaimer:</strong> AI responses are for informational purposes only. Do not use as a substitute for professional medical advice.</p>
      </footer>
    </div>
  );
}
