import React, { useState, useMemo } from 'react';
import { auth } from '../firebase';
import {
  Bot, AlertTriangle, FileText, Upload, Sparkles, CheckCircle2,
  AlertCircle, ArrowRight, ShieldCheck, HelpCircle, Activity, Heart,
  Stethoscope, RefreshCw, BookmarkCheck, ChevronDown, Check, Copy, ExternalLink
} from 'lucide-react';

export default function AnalyzerTab({ vaultFiles = [], profile, saveProfile, onAddVaultFile }) {
  // ── Source Selection State ────────────────────────────────────────────────
  const [sourceMode, setSourceMode] = useState('vault'); // 'vault' or 'upload'
  const [selectedVaultId, setSelectedVaultId] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [saveToVault, setSaveToVault] = useState(true);

  // ── Analysis State ────────────────────────────────────────────────────────
  const [analyzing, setAnalyzing] = useState(false);
  const [stepText, setStepText] = useState('');
  const [analysisResult, setAnalysisResult] = useState(null);
  const [error, setError] = useState('');
  const [filterAbnormalOnly, setFilterAbnormalOnly] = useState(false);
  const [profileSynced, setProfileSynced] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);

  // Filter vault files to prioritize reports & scans
  const availableVaultFiles = useMemo(() => {
    return vaultFiles.filter(f => f.fileUrl && (
      f.category === 'Lab Reports' || 
      f.category === 'Scans' || 
      f.category === 'Prescriptions' || 
      f.category === 'Doctor Notes'
    ));
  }, [vaultFiles]);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) setSelectedFile(file);
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        // Remove data:*/*;base64, prefix
        const base64Str = reader.result.split(',')[1];
        resolve(base64Str);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleRunAnalysis = async () => {
    setError('');
    setAnalysisResult(null);
    setProfileSynced(false);

    if (sourceMode === 'vault' && !selectedVaultId) {
      setError('Please select a document from your Health Vault to analyze.');
      return;
    }
    if (sourceMode === 'upload' && !selectedFile) {
      setError('Please select a PDF or image report file to analyze.');
      return;
    }

    setAnalyzing(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Please log in to use AI analysis.');
      const idToken = await currentUser.getIdToken();

      let fileDataPayload = null;
      let docTitleForLog = 'Medical Document Analysis';

      if (sourceMode === 'vault') {
        const docObj = vaultFiles.find(f => f.id === selectedVaultId);
        if (!docObj) throw new Error('Selected file could not be found.');
        docTitleForLog = docObj.title || docObj.category || 'Vault Report';
        setStepText(`Loading "${docTitleForLog}" from Health Vault...`);
        fileDataPayload = {
          url: docObj.fileUrl,
          mimeType: docObj.fileType || 'application/pdf'
        };
      } else {
        docTitleForLog = selectedFile.name;
        setStepText('Reading local document data...');
        const base64Data = await fileToBase64(selectedFile);
        fileDataPayload = {
          base64: base64Data,
          mimeType: selectedFile.type || 'application/pdf'
        };

        // Optionally upload to vault simultaneously
        if (saveToVault && onAddVaultFile) {
          setStepText('Backing up file to Health Vault & Cloudinary...');
          try {
            const sigResponse = await fetch('/api/upload-signature', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${idToken}`,
                'Content-Type': 'application/json'
              }
            });
            if (sigResponse.ok) {
              const { signature, timestamp, apiKey, cloudName, folder } = await sigResponse.json();
              const formData = new FormData();
              formData.append('file', selectedFile);
              formData.append('api_key', apiKey);
              formData.append('timestamp', timestamp);
              formData.append('signature', signature);
              formData.append('folder', folder);

              const cloudResp = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
                method: 'POST', body: formData
              });
              if (cloudResp.ok) {
                const cloudData = await cloudResp.json();
                await onAddVaultFile({
                  title: selectedFile.name.split('.')[0],
                  category: 'Lab Reports',
                  fileUrl: cloudData.secure_url,
                  cloudinaryId: cloudData.public_id,
                  fileType: cloudData.format || selectedFile.type,
                  fileSize: cloudData.bytes || selectedFile.size,
                  documentDate: new Date().toISOString().split('T')[0],
                  notes: 'Uploaded via AI Lab Report Analyzer'
                });
              }
            }
          } catch (uploadErr) {
            console.warn('Silent fallback: background upload failed, proceeding to analysis:', uploadErr);
          }
        }
      }

      setStepText('Gemini AI is analyzing health metrics, reference ranges & clinical meaning...');
      
      const promptText = `
You are an expert clinical medical AI companion assisting a patient. Thoroughly examine this uploaded lab test report, scan, prescription, or medical document.
Extract all numerical health metrics, test biomarkers, or diagnostic findings.
Identify whether each biomarker is within standard healthy adult reference ranges or if it is flagged as low/high/abnormal.
Provide an empathetic, easy-to-understand plain English explanation for every result.
Return your response STRICTLY as a valid JSON object matching this exact structure:
{
  "documentTitle": "String (e.g. Complete Blood Count / Chest X-Ray / Lipid Panel)",
  "documentType": "String (e.g. Blood Test, Radiology Scan, Pathology Report, Prescription)",
  "testDate": "String (YYYY-MM-DD if found on report, otherwise 'Not specified')",
  "summary": "String (2-4 sentences summarizing overall health picture in reassuring plain English)",
  "overallStatus": "String (Must be either 'Normal', 'Needs Attention', or 'Abnormal / Consult Doctor')",
  "metrics": [
    {
      "name": "String (biomarker name e.g. Hemoglobin, Total Cholesterol, Fasting Glucose)",
      "value": "String (measured value with units e.g. 11.2 g/dL)",
      "normalRange": "String (standard normal reference interval e.g. 13.5 - 17.5 g/dL)",
      "status": "String (Must be 'Normal', 'Abnormal - Low', 'Abnormal - High', or 'Borderline')",
      "isAbnormal": boolean (true if outside normal interval),
      "explanation": "String (1-2 clear sentences explaining what this metric does and why this level matters)"
    }
  ],
  "actionableInsights": [
    {
      "category": "String (e.g. Diet, Lifestyle, Follow-up, Hydration, Sleep)",
      "title": "String (short recommendation title)",
      "description": "String (detailed empathetic guidance)"
    }
  ],
  "doctorQuestions": [
    "String (specific question patient should ask their doctor regarding these results)"
  ],
  "profileInsights": {
    "detectedConditions": ["Array of string medical conditions indicated or mentioned e.g. 'Hypercholesterolemia (Suspected)'"],
    "detectedMedications": [
      { "name": "String", "dose": "String", "frequency": "String" }
    ],
    "healthSummaryNote": "String (Concise summary to link to patient Health Brain profile)"
  }
}
      `.trim();

      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prompt: promptText,
          fileData: fileDataPayload,
          jsonMode: true,
          systemInstruction: "You are AI Health Brain, a world-class clinical AI diagnostician and patient education assistant. Output valid JSON only."
        })
      });

      if (!response.ok) {
        let errMessage = 'Server failed to analyze document.';
        try {
          const errJson = await response.json();
          errMessage = errJson.details || errJson.error || errMessage;
        } catch {
          const text = await response.text();
          if (text) errMessage = `Server returned status ${response.status}: ${text.slice(0, 150)}`;
        }
        throw new Error(errMessage);
      }

      const rawData = await response.json();
      let parsed = null;
      try {
        let textToParse = rawData.text || '{}';
        // Clean markdown backticks if present
        textToParse = textToParse.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
        parsed = JSON.parse(textToParse);
      } catch (parseErr) {
        console.error('Failed to parse JSON from Gemini:', rawData.text, parseErr);
        throw new Error('AI output formatting error. Please try running the analysis again.');
      }

      setAnalysisResult(parsed);

      // ── Automatic Health Brain Profile Linking ──
      setStepText('Linking insights & updating Health Brain profile...');
      if (profile && saveProfile && parsed.profileInsights) {
        const updates = {};
        let needsUpdate = false;

        // Merge newly detected conditions
        if (Array.isArray(parsed.profileInsights.detectedConditions) && parsed.profileInsights.detectedConditions.length > 0) {
          const existingConds = profile.conditions || [];
          const newConds = parsed.profileInsights.detectedConditions.filter(
            c => !existingConds.some(existing => existing.toLowerCase() === c.toLowerCase())
          );
          if (newConds.length > 0) {
            updates.conditions = [...existingConds, ...newConds];
            needsUpdate = true;
          }
        }

        // Merge newly detected medications
        if (Array.isArray(parsed.profileInsights.detectedMedications) && parsed.profileInsights.detectedMedications.length > 0) {
          const existingMeds = profile.currentMedications || [];
          const newMeds = parsed.profileInsights.detectedMedications.filter(
            m => !existingMeds.some(existing => existing.name?.toLowerCase() === m.name?.toLowerCase())
          );
          if (newMeds.length > 0) {
            updates.currentMedications = [...existingMeds, ...newMeds.map(m => ({ ...m, since: new Date().toISOString().split('T')[0] }))];
            needsUpdate = true;
          }
        }

        // Append to AI Analysis History in Profile
        const currentInsights = profile.aiInsights || [];
        const logItem = {
          id: Date.now().toString(),
          title: parsed.documentTitle || docTitleForLog,
          date: parsed.testDate !== 'Not specified' ? parsed.testDate : new Date().toISOString().split('T')[0],
          summary: parsed.summary,
          status: parsed.overallStatus || 'Normal',
          note: parsed.profileInsights.healthSummaryNote || 'Analyzed via Lab Analyzer',
          timestamp: new Date().toISOString()
        };
        updates.aiInsights = [logItem, ...currentInsights].slice(0, 20); // keep last 20 analyses
        needsUpdate = true;

        if (needsUpdate) {
          await saveProfile(updates);
          setProfileSynced(true);
        }
      }

      setAnalyzing(false);
    } catch (err) {
      console.error('Analyzer Error:', err);
      setError(err.message || 'An error occurred during AI analysis.');
      setAnalyzing(false);
    }
  };

  const copyToClipboard = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="analyzer-container" style={{ paddingBottom: '32px' }}>
      {/* ── 1. Medical Disclaimer Banner ── */}
      <div
        style={{
          backgroundColor: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: 'var(--radius)',
          padding: '14px 16px',
          marginBottom: '20px',
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-start',
          boxShadow: 'var(--shadow-sm)'
        }}
      >
        <AlertTriangle size={22} style={{ color: '#d97706', flexShrink: 0, marginTop: '2px' }} />
        <div style={{ fontSize: '0.8rem', color: '#92400e', lineHeight: 1.5 }}>
          <strong style={{ display: 'block', marginBottom: '2px', color: '#78350f', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Prominent Medical Disclaimer
          </strong>
          This AI Lab Report Analyzer is for <strong>informational and educational purposes only</strong> and does not constitute professional medical advice, diagnosis, or treatment. Automated AI interpretations can make mistakes. Always seek the definitive counsel of your physician or a qualified healthcare provider regarding any lab report, symptom, or condition.
        </div>
      </div>

      {/* Header */}
      <div className="flex-between" style={{ marginBottom: '16px' }}>
        <div>
          <h2 className="section-title" style={{ marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles style={{ color: 'var(--primary)' }} />
            AI Lab Report Analyzer
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Extract health markers from PDFs & scans, check normal ranges, and auto-sync with your profile.
          </p>
        </div>
      </div>

      {/* ── 2. Document Input Selector Card ── */}
      <div className="card" style={{ padding: '20px', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={18} style={{ color: 'var(--primary)' }} /> 1. Select Report or Scan to Analyze
        </h3>

        {/* Mode switcher tabs */}
        <div style={{ display: 'flex', gap: '6px', padding: '4px', backgroundColor: 'var(--bg-sidebar)', borderRadius: '10px', marginBottom: '16px' }}>
          <button
            type="button"
            className="btn btn-ghost"
            style={{
              flex: 1, minHeight: '38px', fontSize: '0.85rem',
              backgroundColor: sourceMode === 'vault' ? 'var(--bg-card)' : 'transparent',
              color: sourceMode === 'vault' ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: sourceMode === 'vault' ? 700 : 500,
              boxShadow: sourceMode === 'vault' ? 'var(--shadow-sm)' : 'none',
              borderRadius: '8px'
            }}
            onClick={() => setSourceMode('vault')}
          >
            Choose from Health Vault
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            style={{
              flex: 1, minHeight: '38px', fontSize: '0.85rem',
              backgroundColor: sourceMode === 'upload' ? 'var(--bg-card)' : 'transparent',
              color: sourceMode === 'upload' ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: sourceMode === 'upload' ? 700 : 500,
              boxShadow: sourceMode === 'upload' ? 'var(--shadow-sm)' : 'none',
              borderRadius: '8px'
            }}
            onClick={() => setSourceMode('upload')}
          >
            Upload New File
          </button>
        </div>

        {/* Tab Content: Vault Selection */}
        {sourceMode === 'vault' ? (
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ color: 'var(--text-secondary)', fontSize: '0.825rem' }}>Select Document from your Cloudinary Vault</label>
            {availableVaultFiles.length === 0 ? (
              <div style={{ padding: '16px', border: '1px dashed var(--border)', borderRadius: '8px', textAlign: 'center', backgroundColor: '#f8fafc', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No lab reports or scans found in your Health Vault yet. Switch to "Upload New File" above to upload one!
              </div>
            ) : (
              <select
                value={selectedVaultId}
                onChange={e => setSelectedVaultId(e.target.value)}
                style={{ height: '44px', fontWeight: 600, fontSize: '0.9rem' }}
              >
                <option value="">-- Choose a stored medical document --</option>
                {availableVaultFiles.map(doc => (
                  <option key={doc.id} value={doc.id}>
                    [{doc.category}] {doc.title} ({doc.documentDate || 'No date'})
                  </option>
                ))}
              </select>
            )}
          </div>
        ) : (
          /* Tab Content: Local Upload */
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ color: 'var(--text-secondary)', fontSize: '0.825rem' }}>Select PDF Report, Scan, or Prescription Photo</label>
            <div
              style={{
                border: '2px dashed var(--primary)',
                borderRadius: '8px',
                padding: '20px 16px',
                textAlign: 'center',
                backgroundColor: 'var(--bg-sidebar)',
                cursor: 'pointer',
                transition: 'var(--transition)'
              }}
              onClick={() => document.getElementById('analyzer-file-picker').click()}
            >
              <Upload size={28} style={{ color: 'var(--primary)', margin: '0 auto 8px' }} />
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                {selectedFile ? selectedFile.name : 'Tap here to browse for PDF or image scan'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Supports Lab Reports (CBC, Lipid, Thyroid, Liver, Renal), DICOM reports & prescriptions
              </div>
              <input
                id="analyzer-file-picker"
                type="file"
                accept="application/pdf,image/*,.docx"
                style={{ display: 'none' }}
                onChange={handleFileSelect}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                id="saveToVaultChk"
                checked={saveToVault}
                onChange={e => setSaveToVault(e.target.checked)}
              />
              <label htmlFor="saveToVaultChk" style={{ cursor: 'pointer', marginBottom: 0 }}>
                Also securely backup this document into my Health Vault (Cloudinary)
              </label>
            </div>
          </div>
        )}

        {error && (
          <div className="alert alert-danger" style={{ marginTop: '16px', marginBottom: 0 }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {/* Analyze Action Button */}
        <div style={{ marginTop: '20px' }}>
          {analyzing ? (
            <div style={{ padding: '16px', backgroundColor: 'var(--bg-sidebar)', borderRadius: '8px', textAlign: 'center' }}>
              <div className="spinner" style={{ margin: '0 auto 12px' }} />
              <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '4px' }}>
                Analyzing Medical Data...
              </p>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {stepText}
              </p>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              style={{
                width: '100%',
                minHeight: '48px',
                fontSize: '0.95rem',
                fontWeight: 700,
                background: 'linear-gradient(135deg, var(--primary) 0%, #3b82f6 100%)',
                boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)'
              }}
              onClick={handleRunAnalysis}
            >
              <Sparkles size={18} /> Analyze with Gemini AI
            </button>
          )}
        </div>
      </div>

      {/* ── 3. Analysis Results Screen (When available) ── */}
      {analysisResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Executive Summary & Document Header */}
          <div className="card" style={{ padding: '20px', borderTop: '4px solid var(--primary)' }}>
            <div className="flex-between" style={{ marginBottom: '12px', alignItems: 'flex-start' }}>
              <div>
                <span className="badge badge-primary" style={{ textTransform: 'uppercase', marginBottom: '8px', display: 'inline-block', fontSize: '0.7rem' }}>
                  {analysisResult.documentType || 'Lab Test Analysis'}
                </span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {analysisResult.documentTitle || 'Medical Report Summary'}
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Test Date: {analysisResult.testDate || 'Not specified'}
                </p>
              </div>

              {/* Status Chip */}
              <div style={{ textAlign: 'right' }}>
                <span
                  className="badge"
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    backgroundColor: analysisResult.overallStatus?.toLowerCase().includes('normal') ? '#dcfce7' : '#fee2e2',
                    color: analysisResult.overallStatus?.toLowerCase().includes('normal') ? '#15803d' : '#b91c1c',
                    border: `1px solid ${analysisResult.overallStatus?.toLowerCase().includes('normal') ? '#86efac' : '#fca5a5'}`
                  }}
                >
                  {analysisResult.overallStatus?.toLowerCase().includes('normal') ? '✅ ' : '🚨 '}
                  {analysisResult.overallStatus || 'Reviewed'}
                </span>
              </div>
            </div>

            <div style={{ padding: '14px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.92rem', lineHeight: 1.6, color: 'var(--text-primary)' }}>
              <strong style={{ display: 'block', marginBottom: '4px', fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Plain-English Clinical Summary
              </strong>
              {analysisResult.summary}
            </div>

            {/* Profile Integration Confirmation Box */}
            <div style={{ marginTop: '16px', padding: '14px 16px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <ShieldCheck size={26} style={{ color: '#10b981', flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: '0.85rem', color: '#065f46' }}>
                <div style={{ fontWeight: 700, marginBottom: '2px' }}>
                  {profileSynced ? '✅ Automatically Linked to Health Brain Profile' : '⚡ Profile Insights Identified'}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#047857' }}>
                  {profileSynced
                    ? 'Key findings, suspected conditions, and summary logs have been permanently added to your personal Firestore Health Brain records for seamless context in future consultations.'
                    : 'We extracted structured medical context from this report to enrich your permanent Health Brain timeline.'}
                </div>
              </div>
            </div>
          </div>

          {/* Extracted Biomarkers / Metrics Breakdown */}
          <div className="card" style={{ padding: '20px' }}>
            <div className="flex-between" style={{ marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity style={{ color: 'var(--primary)' }} />
                Extracted Health Metrics & Reference Ranges
              </h3>
              
              {/* Filter Tabs */}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  className={`btn ${!filterAbnormalOnly ? 'btn-secondary' : 'btn-ghost'}`}
                  style={{ padding: '4px 10px', minHeight: '32px', fontSize: '0.78rem' }}
                  onClick={() => setFilterAbnormalOnly(false)}
                >
                  All Markers ({analysisResult.metrics?.length || 0})
                </button>
                <button
                  type="button"
                  className={`btn ${filterAbnormalOnly ? 'btn-danger' : 'btn-ghost'}`}
                  style={{ padding: '4px 10px', minHeight: '32px', fontSize: '0.78rem' }}
                  onClick={() => setFilterAbnormalOnly(true)}
                >
                  🚨 Flagged Abnormal ({analysisResult.metrics?.filter(m => m.isAbnormal || !m.status?.toLowerCase().includes('normal')).length || 0})
                </button>
              </div>
            </div>

            {(!analysisResult.metrics || analysisResult.metrics.length === 0) ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                No explicit numerical lab test markers were extracted from this specific document. See the summary and actionable insights for clinical details.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {analysisResult.metrics
                  .filter(m => !filterAbnormalOnly || m.isAbnormal || !m.status?.toLowerCase().includes('normal'))
                  .map((metric, idx) => {
                    const isNormal = metric.status?.toLowerCase().includes('normal') && !metric.isAbnormal;
                    const statusColor = isNormal ? 'success' : 'danger';
                    const badgeBg = isNormal ? '#ecfdf5' : '#fef2f2';
                    const badgeText = isNormal ? '#047857' : '#991b1b';
                    const badgeBorder = isNormal ? '#a7f3d0' : '#fecaca';

                    return (
                      <div
                        key={idx}
                        style={{
                          border: `1px solid ${isNormal ? 'var(--border)' : '#fca5a5'}`,
                          borderLeft: `4px solid ${isNormal ? '#10b981' : '#ef4444'}`,
                          borderRadius: '8px',
                          padding: '14px 16px',
                          backgroundColor: isNormal ? 'var(--bg-card)' : '#fff5f5'
                        }}
                      >
                        <div className="flex-between" style={{ marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                          <div>
                            <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', display: 'block' }}>
                              {metric.name}
                            </span>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                              Normal Range: <strong style={{ color: 'var(--text-primary)' }}>{metric.normalRange || 'Standard'}</strong>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: isNormal ? 'var(--text-primary)' : '#b91c1c' }}>
                                {metric.value}
                              </div>
                            </div>
                            <span
                              style={{
                                padding: '4px 8px',
                                borderRadius: '12px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                backgroundColor: badgeBg,
                                color: badgeText,
                                border: `1px solid ${badgeBorder}`,
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {isNormal ? '✓ Normal' : `⚠️ ${metric.status}`}
                            </span>
                          </div>
                        </div>

                        {metric.explanation && (
                          <div style={{ paddingTop: '8px', borderTop: '1px dashed var(--border)', fontSize: '0.85rem', color: isNormal ? 'var(--text-secondary)' : '#7f1d1d', lineHeight: 1.5 }}>
                            <strong>Why it matters: </strong> {metric.explanation}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Actionable Insights & Guidance */}
          {analysisResult.actionableInsights && analysisResult.actionableInsights.length > 0 && (
            <div className="card" style={{ padding: '20px', backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#14532d', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 style={{ color: '#16a34a' }} />
                Actionable Next Steps & Health Advice
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
                {analysisResult.actionableInsights.map((insight, idx) => (
                  <div key={idx} style={{ backgroundColor: '#ffffff', padding: '14px', borderRadius: '8px', border: '1px solid #dcfce7', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                    <span className="badge" style={{ backgroundColor: '#dcfce7', color: '#15803d', fontSize: '0.7rem', marginBottom: '6px', display: 'inline-block' }}>
                      {insight.category || 'Lifestyle'}
                    </span>
                    <h4 style={{ fontWeight: 700, fontSize: '0.9rem', color: '#166534', marginBottom: '6px' }}>
                      {insight.title}
                    </h4>
                    <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {insight.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Doctor Consult Questions */}
          {analysisResult.doctorQuestions && analysisResult.doctorQuestions.length > 0 && (
            <div className="card" style={{ padding: '20px' }}>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Stethoscope style={{ color: 'var(--primary)' }} />
                Questions to Ask Your Doctor
              </h3>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Bring these pre-formulated questions to your next consultation to ensure thorough discussion of these results:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {analysisResult.doctorQuestions.map((q, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '12px 16px',
                      backgroundColor: 'var(--bg-sidebar)',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px'
                    }}
                  >
                    <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      • {q}
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      style={{ padding: '6px', minHeight: '36px', color: 'var(--primary)', flexShrink: 0 }}
                      onClick={() => copyToClipboard(q, idx)}
                      title="Copy Question"
                    >
                      {copiedIndex === idx ? <Check size={18} style={{ color: '#10b981' }} /> : <Copy size={18} />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 4. Analyzed Timeline History (From Profile) ── */}
      {profile && profile.aiInsights && profile.aiInsights.length > 0 && !analysisResult && (
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookmarkCheck size={18} style={{ color: 'var(--primary)' }} />
            Recent Lab Reports Analyzed in Your Health Brain
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {profile.aiInsights.map(item => (
              <div key={item.id} style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)' }}>
                <div className="flex-between" style={{ marginBottom: '4px' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{item.title}</span>
                  <span className="badge" style={{ fontSize: '0.7rem', backgroundColor: item.status?.toLowerCase().includes('normal') ? '#dcfce7' : '#fee2e2', color: item.status?.toLowerCase().includes('normal') ? '#15803d' : '#b91c1c' }}>
                    {item.status || 'Reviewed'}
                  </span>
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Test Date: {item.date}
                </div>
                <div style={{ fontSize: '0.83rem', color: 'var(--text-secondary)' }}>
                  {item.summary}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Medical Reminder */}
      <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.75rem', color: 'var(--text-muted)', padding: '0 12px' }}>
        <p>🔒 All lab evaluations are processed securely via encrypted Google Gemini API & Cloudinary Vault. Results remain strictly private under your user account.</p>
      </div>
    </div>
  );
}
