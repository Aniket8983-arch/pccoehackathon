import React, { useState } from 'react';
import { FileText, Upload, Loader2, ChevronUp, ChevronDown, CheckCircle2, AlertCircle } from 'lucide-react';
import type { SoilAnalysisResult, SoilParameter } from '../types';
import { analyzeSoil } from '../services/mlApi';

interface SoilReportPanelProps {
  onAnalysisComplete: (result: SoilAnalysisResult) => void;
}

export const SoilReportPanel: React.FC<SoilReportPanelProps> = ({ onAnalysisComplete }) => {
  const [expanded, setExpanded] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SoilAnalysisResult | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
      setError(null);
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const res = await analyzeSoil(file);
      setResult(res);
      onAnalysisComplete(res);
      setExpanded(true);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze soil report');
    } finally {
      setLoading(false);
    }
  };

  const getStatusClass = (status: string) => {
    switch (status.toLowerCase()) {
      case 'adequate':
      case 'high':
      case 'optimal':
        return 'soil-status-good';
      case 'medium':
      case 'moderate':
        return 'soil-status-medium';
      case 'low':
      case 'deficient':
      case 'poor':
        return 'soil-status-poor';
      default:
        return '';
    }
  };

  return (
    <div className="card">
      <div className="card-header card-header-clickable" onClick={() => setExpanded(!expanded)}>
        <span className="card-title">
          <FileText className="icon-sm" style={{ color: '#f59e0b' }} /> 
          Soil Report Analysis
        </span>
        {expanded ? <ChevronUp className="icon-xs" /> : <ChevronDown className="icon-xs" />}
      </div>
      
      {expanded && (
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          
          <label className="file-upload-zone" style={{ borderColor: 'rgba(245, 158, 11, 0.3)' }}>
            <input 
              type="file" 
              accept=".pdf,.png,.jpg,.jpeg,.csv,.xlsx" 
              style={{ display: 'none' }} 
              onChange={handleFileChange}
            />
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
              <Upload className="icon-md" style={{ color: '#f59e0b' }} />
              <span style={{ fontSize: '0.7rem', color: file ? '#f8fafc' : '#94a3b8' }}>
                {file ? file.name : 'Upload Soil Report (PDF/Image)'}
              </span>
            </div>
          </label>

          {file && !result && (
            <button 
              className="upload-btn" 
              style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
              onClick={handleAnalyze} 
              disabled={loading}
            >
              {loading ? <Loader2 className="icon-xs animate-spin" /> : <FileText className="icon-xs" />}
              {loading ? 'Extracting Data...' : 'Analyze Report'}
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>
                  Extracted via <span style={{ color: '#38bdf8', textTransform: 'uppercase' }}>{result.extraction_method}</span>
                </div>
                <div style={{ fontSize: '0.65rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  <CheckCircle2 className="icon-xs" />
                  {result.confidence} Confidence
                </div>
              </div>

              <div className="custom-scrollbar" style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '0.4rem' }}>
                <table className="soil-table">
                  <thead style={{ position: 'sticky', top: 0, background: '#1e293b' }}>
                    <tr>
                      <th>Parameter</th>
                      <th>Value</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(result.parameters).map(([key, param]: [string, SoilParameter]) => (
                      <tr key={key}>
                        <td style={{ textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</td>
                        <td style={{ fontFamily: 'monospace' }}>
                          {param.value !== null ? `${param.value} ${param.unit}` : <span style={{ color: '#64748b' }}>N/A</span>}
                        </td>
                        <td className={getStatusClass(param.status)}>
                          {param.status !== 'Unknown' ? param.status : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <button 
                className="btn-secondary" 
                style={{ width: '100%', marginTop: '0.6rem', justifyContent: 'center' }}
                onClick={() => {
                  setFile(null);
                  setResult(null);
                }}
              >
                Upload Another Report
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
