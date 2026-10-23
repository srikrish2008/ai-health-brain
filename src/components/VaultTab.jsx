import React, { useState, useMemo } from 'react';
import { auth } from '../firebase';
import {
  Upload, Search, FileText, Image as ImageIcon, AlertTriangle, Pill,
  Activity, Stethoscope, Trash2, Eye, Download, Plus, X, Filter,
  File, CheckCircle, Shield, Calendar, Clock
} from 'lucide-react';

const CATEGORIES = [
  'Lab Reports',
  'Prescriptions',
  'Scans',
  'Doctor Notes',
  'Emergency Info'
];

function detectCategory(filename = '', mimeType = '') {
  const lower = filename.toLowerCase();
  if (lower.includes('rx') || lower.includes('prescrip') || lower.includes('med') || lower.includes('dosage')) {
    return 'Prescriptions';
  }
  if (lower.includes('lab') || lower.includes('blood') || lower.includes('test') || lower.includes('report') || lower.includes('panel') || lower.includes('cbc') || lower.includes('thyroid') || lower.includes('urine')) {
    return 'Lab Reports';
  }
  if (lower.includes('scan') || lower.includes('xray') || lower.includes('x-ray') || lower.includes('mri') || lower.includes('ct') || lower.includes('ultrasound') || lower.includes('dicom')) {
    return 'Scans';
  }
  if (lower.includes('emergency') || lower.includes('ice') || lower.includes('blood group') || lower.includes('card') || lower.includes('insurance')) {
    return 'Emergency Info';
  }
  return 'Doctor Notes';
}

function getCategoryColor(category) {
  switch (category) {
    case 'Lab Reports': return 'primary';
    case 'Prescriptions': return 'success';
    case 'Scans': return 'warning';
    case 'Emergency Info': return 'danger';
    case 'Doctor Notes': default: return 'secondary';
  }
}

function getCategoryIcon(category) {
  switch (category) {
    case 'Lab Reports': return Activity;
    case 'Prescriptions': return Pill;
    case 'Scans': return ImageIcon;
    case 'Emergency Info': return AlertTriangle;
    case 'Doctor Notes': default: return FileText;
  }
}

function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// ── Upload Modal ────────────────────────────────────────────────────────────

function UploadModal({ onAddVaultFile, onClose }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Lab Reports');
  const [documentDate, setDocumentDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  
  const [uploading, setUploading] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [uploadError, setUploadError] = useState('');

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setSelectedFile(file);
    const autoCat = detectCategory(file.name, file.type);
    setCategory(autoCat);
    const nameWithoutExt = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    setTitle(nameWithoutExt);
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError('Please select a file to upload.');
      return;
    }

    setUploading(true);
    setUploadError('');
    setProgressText('Generating security signature...');

    try {
      // 1. Get Firebase Auth token
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Not logged in.');
      const idToken = await currentUser.getIdToken();

      // 2. Fetch signature from backend
      const sigResponse = await fetch('/api/upload-signature', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!sigResponse.ok) {
        throw new Error('Failed to authorize upload signature with backend.');
      }

      const sigData = await sigResponse.json();
      const { signature, timestamp, apiKey, cloudName, folder } = sigData;

      // 3. Upload directly to Cloudinary
      setProgressText('Uploading file securely to Cloudinary...');
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('api_key', apiKey);
      formData.append('timestamp', timestamp);
      formData.append('signature', signature);
      formData.append('folder', folder);

      const cloudResponse = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
        {
          method: 'POST',
          body: formData
        }
      );

      if (!cloudResponse.ok) {
        const errJson = await cloudResponse.json();
        throw new Error(errJson.error?.message || 'Cloudinary upload failed.');
      }

      const cloudData = await cloudResponse.json();
      setProgressText('Saving file metadata to Health Vault...');

      // 4. Save metadata to Firestore via parent hook
      await onAddVaultFile({
        title: title.trim() || selectedFile.name,
        category: category,
        fileUrl: cloudData.secure_url,
        cloudinaryId: cloudData.public_id,
        fileType: cloudData.format || selectedFile.type,
        fileSize: cloudData.bytes || selectedFile.size,
        documentDate: documentDate,
        notes: notes.trim(),
      });

      setUploading(false);
      onClose();
    } catch (err) {
      console.error('Upload Error:', err);
      setUploadError(err.message || 'An error occurred during upload.');
      setUploading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-sheet">
        <div className="modal-header">
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800 }}>Upload to Health Vault</h2>
          <button type="button" className="btn btn-ghost" style={{ padding: '8px', minHeight: '40px' }} onClick={onClose} disabled={uploading}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleUploadSubmit} className="modal-body">
          {uploadError && (
            <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
              <AlertTriangle size={16} />
              <span>{uploadError}</span>
            </div>
          )}

          {/* File Picker */}
          <div className="form-group">
            <label>Select File (PDF, Prescription image, Scan, Report)</label>
            <div
              style={{
                border: '2px dashed var(--border)',
                borderRadius: 'var(--radius)',
                padding: '24px 16px',
                textAlign: 'center',
                backgroundColor: 'var(--bg-sidebar)',
                cursor: 'pointer',
                transition: 'var(--transition)'
              }}
              onClick={() => document.getElementById('vault-file-input').click()}
            >
              <Upload size={32} style={{ color: 'var(--primary)', marginBottom: '8px' }} />
              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                {selectedFile ? selectedFile.name : 'Tap to browse or select a file'}
              </div>
              {selectedFile ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  {formatBytes(selectedFile.size)} · {selectedFile.type || 'Document'}
                </div>
              ) : (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Supports PDF, PNG, JPG, JPEG, WEBP files
                </div>
              )}
              <input
                id="vault-file-input"
                type="file"
                accept="image/*,application/pdf,.doc,.docx"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
            </div>
          </div>

          {selectedFile && (
            <>
              <div className="form-group">
                <label>Document Title</label>
                <input
                  type="text"
                  placeholder="e.g. Blood Test Results Jan 2026"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="subform-grid">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Category (Auto-detected)</label>
                  <select value={category} onChange={e => setCategory(e.target.value)}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Document Date</label>
                  <input
                    type="date"
                    value={documentDate}
                    onChange={e => setDocumentDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '12px' }}>
                <label>Notes / Doctor Advice (optional)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Prescribed by Dr. Sharma, take twice daily after meals..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>
            </>
          )}

          {uploading ? (
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div className="spinner" style={{ margin: '0 auto 8px' }} />
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                {progressText}
              </p>
            </div>
          ) : (
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '8px' }}
              disabled={!selectedFile}
            >
              <Upload size={16} /> Save to Health Vault
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

// ── Preview Modal ────────────────────────────────────────────────────────────

function PreviewModal({ file, onClose }) {
  if (!file) return null;
  const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes((file.fileType || '').toLowerCase()) ||
    (file.fileUrl || '').match(/\.(jpg|jpeg|png|webp|gif)/i);

  return (
    <div className="modal-overlay">
      <div className="modal-sheet" style={{ maxHeight: '95vh' }}>
        <div className="modal-header">
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 800 }}>{file.title}</h2>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {file.category} · {file.documentDate || 'No date'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <a
              href={file.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
              style={{ padding: '6px 12px', minHeight: '36px', fontSize: '0.8rem', textDecoration: 'none' }}
            >
              <Download size={14} /> Open Original
            </a>
            <button type="button" className="btn btn-ghost" style={{ padding: '6px', minHeight: '36px' }} onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9', padding: '16px' }}>
          {isImage ? (
            <img
              src={file.fileUrl}
              alt={file.title}
              style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: '8px', objectFit: 'contain', boxShadow: 'var(--shadow)' }}
            />
          ) : (
            <div style={{ width: '100%', height: '70vh', display: 'flex', flexDirection: 'column' }}>
              <iframe
                src={`https://docs.google.com/viewer?url=${encodeURIComponent(file.fileUrl)}&embedded=true`}
                title={file.title}
                style={{ width: '100%', height: '100%', border: 'none', borderRadius: '8px', backgroundColor: '#fff' }}
              />
            </div>
          )}

          {file.notes && (
            <div style={{ width: '100%', marginTop: '12px', padding: '12px', backgroundColor: 'var(--bg-card)', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Notes</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{file.notes}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Vault Tab Component ─────────────────────────────────────────────────

export default function VaultTab({ vaultFiles, onAddVaultFile, onDeleteVaultFile }) {
  const [showUpload, setShowUpload] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [dateFilter, setDateFilter] = useState('');

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const filteredFiles = useMemo(() => {
    return vaultFiles.filter(file => {
      // Category filter
      if (activeCategory !== 'All' && file.category !== activeCategory) {
        return false;
      }
      // Date filter
      if (dateFilter && file.documentDate !== dateFilter) {
        return false;
      }
      // Search query (title, notes, fileType)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = (file.title || '').toLowerCase().includes(q);
        const notesMatch = (file.notes || '').toLowerCase().includes(q);
        const categoryMatch = (file.category || '').toLowerCase().includes(q);
        return titleMatch || notesMatch || categoryMatch;
      }
      return true;
    });
  }, [vaultFiles, activeCategory, dateFilter, searchQuery]);

  return (
    <div>
      {showUpload && (
        <UploadModal
          onAddVaultFile={onAddVaultFile}
          onClose={() => setShowUpload(false)}
        />
      )}

      {previewFile && (
        <PreviewModal
          file={previewFile}
          onClose={() => setPreviewFile(null)}
        />
      )}

      {/* Header Banner */}
      <div className="flex-between" style={{ marginBottom: '16px' }}>
        <div>
          <h2 className="section-title" style={{ marginBottom: '2px' }}>
            <Shield style={{ color: 'var(--primary)' }} />
            Health Vault
          </h2>
          <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
            Secure Cloudinary storage for prescriptions, labs, scans & notes
          </p>
        </div>
        <button
          className="btn btn-primary"
          style={{ padding: '10px 16px', minHeight: '42px', fontSize: '0.875rem' }}
          onClick={() => setShowUpload(true)}
        >
          <Plus size={16} /> Upload
        </button>
      </div>

      {/* Search & Date Filter Bar */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search
            size={16}
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
          />
          <input
            type="text"
            placeholder="Search by document name, category, notes..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '36px', height: '42px' }}
          />
        </div>

        <input
          type="date"
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value)}
          style={{ width: '135px', height: '42px', fontSize: '0.8rem', padding: '0 8px' }}
          title="Filter by document date"
        />

        {dateFilter && (
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: '8px', minHeight: '42px', color: 'var(--text-muted)' }}
            onClick={() => setDateFilter('')}
            title="Clear date filter"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Category Tabs */}
      <div className="chip-row" style={{ marginBottom: '16px', marginTop: 0 }}>
        {['All', ...CATEGORIES].map(cat => (
          <button
            key={cat}
            type="button"
            className={`chip ${activeCategory === cat ? 'chip-active' : ''}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Files List / Grid */}
      {filteredFiles.length === 0 ? (
        <div className="empty-state">
          <FileText size={48} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
          <h3>No documents found</h3>
          <p>
            {searchQuery || activeCategory !== 'All' || dateFilter
              ? 'No documents match your current search or category filter.'
              : 'Upload your lab reports, prescriptions, and scans to keep them securely organized in your Cloudinary vault.'}
          </p>
          <button className="btn btn-primary" style={{ marginTop: '16px' }} onClick={() => setShowUpload(true)}>
            <Plus size={16} /> Upload First Document
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredFiles.map(file => {
            const IconComponent = getCategoryIcon(file.category);
            const color = getCategoryColor(file.category);

            return (
              <div
                key={file.id}
                className="card"
                style={{
                  marginBottom: 0,
                  borderLeft: `4px solid var(--${color})`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px'
                }}
              >
                {/* Category Icon */}
                <div
                  className="stat-icon"
                  style={{
                    backgroundColor: `var(--${color}-light)`,
                    color: `var(--${color})`,
                    width: '42px',
                    height: '42px',
                    borderRadius: '12px'
                  }}
                >
                  <IconComponent size={20} />
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {file.title}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    <span className={`tag tag-${color}`} style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
                      {file.category}
                    </span>
                    {file.documentDate && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}>
                        <Calendar size={12} /> {formatDate(file.documentDate)}
                      </span>
                    )}
                    {file.fileSize && (
                      <span style={{ color: 'var(--text-muted)' }}>
                        · {formatBytes(file.fileSize)}
                      </span>
                    )}
                  </div>

                  {file.notes && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {file.notes}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                  <button
                    className="btn btn-ghost"
                    style={{ padding: '8px', minHeight: '38px', color: 'var(--primary)' }}
                    onClick={() => setPreviewFile(file)}
                    title="View Document"
                  >
                    <Eye size={18} />
                  </button>

                  <a
                    href={file.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost"
                    style={{ padding: '8px', minHeight: '38px', color: 'var(--text-secondary)' }}
                    title="Download / Open"
                  >
                    <Download size={18} />
                  </a>

                  <button
                    className="btn btn-ghost"
                    style={{ padding: '8px', minHeight: '38px', color: 'var(--danger)' }}
                    onClick={() => onDeleteVaultFile(file.id)}
                    title="Delete File"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
