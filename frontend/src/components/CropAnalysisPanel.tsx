import React, { useState } from 'react';
import { Camera, Upload, Loader2, CheckCircle2, AlertCircle, ChevronUp, ChevronDown } from 'lucide-react';
import type { GridCell, ImageAnalysisResult, StressLevel } from '../types';
import { analyzeImage } from '../services/mlApi';

interface CropAnalysisPanelProps {
  selectedCell: GridCell | null;
  onAnalysisComplete: (result: ImageAnalysisResult) => void;
}

export const CropAnalysisPanel: React.FC<CropAnalysisPanelProps> = ({ selectedCell, onAnalysisComplete }) => {
  const [expanded, setExpanded] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImageAnalysisResult | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      setResult(null);
      setError(null);
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const res = await analyzeImage(file, selectedCell?.cell_id);
      setResult(res);
      onAnalysisComplete(res);
      setExpanded(true);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze image');
    } finally {
      setLoading(false);
    }
  };

  const getLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'low': return '#34d399'; // green
      case 'moderate': return '#fbbf24'; // amber
      case 'high': return '#f97316'; // orange
      case 'critical': return '#ef4444'; // red
      default: return '#94a3b8';
    }
  };

  const renderStressLevel = (name: string, data: StressLevel) => {
    const color = getLevelColor(data.level);
    const progressWidth = `${Math.min(Math.round(data.confidence * 100), 100)}%`;

    return (
      <div key={name} className="measurement-card" style={{ marginBottom: '0.4rem', borderLeft: `2px solid ${color}` }}>
        <div className="meas-header">
          <span className="meas-title" style={{ color: '#f8fafc', textTransform: 'capitalize' }}>{name} Stress</span>
          <span className="stress-level-pill" style={{ backgroundColor: `${color}33`, color, border: `1px solid ${color}66` }}>
            {data.level.toUpperCase()}
          </span>
        </div>
        
        <div className="stress-bar-container">
          <span className="stress-bar-label">Confidence: {(data.confidence * 100).toFixed(2)}%</span>
          <div className="stress-bar">
            <div className="stress-bar-fill" style={{ width: progressWidth, backgroundColor: color }} />
          </div>
        </div>

        {data.possible_conditions && data.possible_conditions.length > 0 && (
          <div style={{ marginTop: '0.3rem', fontSize: '0.6rem', color: '#cbd5e1' }}>
            <span style={{ color: '#94a3b8' }}>Conditions: </span>
            {data.possible_conditions.join(', ')}
          </div>
        )}
        
        {data.evidence && data.evidence.length > 0 && (
          <div style={{ marginTop: '0.3rem', fontSize: '0.6rem', color: '#cbd5e1' }}>
            <span style={{ color: '#94a3b8' }}>Evidence: </span>
            {data.evidence.join(', ')}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="card">
      <div className="card-header card-header-clickable" onClick={() => setExpanded(!expanded)}>
        <span className="card-title">
          <Camera className="icon-sm" style={{ color: '#10b981' }} /> 
          Crop Analysis
        </span>
        {expanded ? <ChevronUp className="icon-xs" /> : <ChevronDown className="icon-xs" />}
      </div>
      
      {expanded && (
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          
          <label className="file-upload-zone">
            <input 
              type="file" 
              accept=".jpg,.jpeg,.png,.webp" 
              style={{ display: 'none' }} 
              onChange={handleFileChange}
            />
            {previewUrl ? (
              <img src={previewUrl} alt="Preview" className="image-preview" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
                <Upload className="icon-md" style={{ color: '#94a3b8' }} />
                <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Click to upload crop image</span>
              </div>
            )}
          </label>

          {file && !result && (
            <button 
              className="upload-btn" 
              onClick={handleAnalyze} 
              disabled={loading}
            >
              {loading ? <Loader2 className="icon-xs animate-spin" /> : <Camera className="icon-xs" />}
              {loading ? 'Analyzing Image...' : 'Analyze Image'}
            </button>
          )}

          {error && (
            <div className="warning-banner" style={{ background: 'rgba(239, 68, 68, 0.12)', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#fca5a5' }}>
              <AlertCircle className="icon-sm" />
              {error}
            </div>
          )}

          {result && (
            <div className="fade-in">
              <div className="inspector-meta-box" style={{ justifyContent: 'space-between', marginBottom: '0.6rem', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <CheckCircle2 className="icon-sm" style={{ color: '#10b981' }} />
                  <div>
                    <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Detected Crop</div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#f8fafc', textTransform: 'capitalize' }}>
                      {result.crop.name} <span style={{ fontSize: '0.65rem', color: '#34d399', fontWeight: 400 }}>({(result.crop.confidence * 100).toFixed(2)}%)</span>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '0.65rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Stress Assessment
              </div>
              
              <div className="custom-scrollbar" style={{ maxHeight: '200px', overflowY: 'auto', paddingRight: '0.2rem' }}>
                {Object.entries(result.stress).map(([key, data]) => renderStressLevel(key, data))}
              </div>
              
              <button 
                className="btn-secondary" 
                style={{ width: '100%', marginTop: '0.6rem', justifyContent: 'center' }}
                onClick={() => {
                  setFile(null);
                  setPreviewUrl(null);
                  setResult(null);
                }}
              >
                Analyze Another Image
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
