import React, { useState, useMemo } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Droplets, ThermometerSun, Bug, Sprout, Activity } from 'lucide-react';
import type { GridData, StressType, GridCell } from '../types';

interface StressAnalysisPanelProps {
  gridData: GridData | null;
  activeStressType: StressType;
  onStressTypeChange: (type: StressType) => void;
  onSelectCell: (cell: GridCell) => void;
}

export const StressAnalysisPanel: React.FC<StressAnalysisPanelProps> = ({
  gridData,
  activeStressType,
  onStressTypeChange,
  onSelectCell
}) => {
  const [expanded, setExpanded] = useState(true);

  const stats = useMemo(() => {
    if (!gridData || activeStressType === 'none') return null;
    
    const stressKey = `stress_${activeStressType}` as keyof GridCell;
    const cells = gridData.cells.filter(c => c.valid && c[stressKey]);
    
    let critical = 0, high = 0, moderate = 0, low = 0;
    const topAffected: { cell: GridCell; score: number }[] = [];

    cells.forEach(c => {
      const s = c[stressKey] as any;
      if (!s) return;
      if (s.level === 'Critical') critical++;
      else if (s.level === 'High') high++;
      else if (s.level === 'Moderate') moderate++;
      else low++;

      if (s.score > 30) {
        topAffected.push({ cell: c, score: s.score });
      }
    });

    topAffected.sort((a, b) => b.score - a.score);

    return {
      critical, high, moderate, low,
      top10: topAffected.slice(0, 10),
      totalAffectedArea: (critical + high + moderate) * 100 // roughly 100m^2 per cell
    };
  }, [gridData, activeStressType]);

  const getThemeColor = (type: StressType) => {
    switch (type) {
      case 'water': return '#3b82f6'; // Blue
      case 'heat': return '#f97316'; // Orange
      case 'disease': return '#ef4444'; // Red
      case 'vegetation': return '#a855f7'; // Purple
      default: return '#10b981'; // Green
    }
  };

  const getLabel = (type: StressType) => {
    switch (type) {
      case 'overall': return 'Overall Risk';
      case 'water': return 'Water Stress';
      case 'heat': return 'Heat Stress';
      case 'disease': return 'Disease Risk';
      case 'vegetation': return 'Vegetation Stress';
      default: return 'None';
    }
  };

  const getIcon = (type: StressType) => {
    switch (type) {
      case 'overall': return <Activity className="icon-xs" />;
      case 'water': return <Droplets className="icon-xs" />;
      case 'heat': return <ThermometerSun className="icon-xs" />;
      case 'disease': return <Bug className="icon-xs" />;
      case 'vegetation': return <Sprout className="icon-xs" />;
      default: return null;
    }
  };

  return (
    <div className="card" style={{ borderLeft: activeStressType !== 'none' ? `3px solid ${getThemeColor(activeStressType)}` : undefined }}>
      <div className="card-header card-header-clickable" onClick={() => setExpanded(!expanded)}>
        <span className="card-title"><AlertTriangle className="icon-sm" style={{ color: activeStressType !== 'none' ? getThemeColor(activeStressType) : '#f43f5e' }} /> Stress Analysis</span>
        {expanded ? <ChevronUp className="icon-xs" /> : <ChevronDown className="icon-xs" />}
      </div>
      
      {expanded && (
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        
        {/* Layer Selector */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
          {(['none', 'overall', 'water', 'heat', 'disease', 'vegetation'] as StressType[]).map(type => (
            <button
              key={type}
              onClick={() => onStressTypeChange(type)}
              style={{
                flex: type === 'none' ? '1 1 100%' : '1 1 45%',
                padding: '0.35rem 0.5rem',
                fontSize: '0.65rem',
                fontWeight: activeStressType === type ? 600 : 500,
                color: activeStressType === type ? '#fff' : '#94a3b8',
                background: activeStressType === type ? getThemeColor(type) : 'rgba(255,255,255,0.05)',
                border: '1px solid',
                borderColor: activeStressType === type ? getThemeColor(type) : 'rgba(255,255,255,0.1)',
                borderRadius: '0.3rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.3rem',
                transition: 'all 0.2s'
              }}
            >
              {type !== 'none' && getIcon(type)}
              {getLabel(type)}
            </button>
          ))}
        </div>

        {stats && activeStressType !== 'none' && (
          <div style={{ animation: 'fadeIn 0.3s' }}>
            
            {/* Summary */}
            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem' }}>
              <div className="mini-stat" style={{ flex: 1, borderColor: 'rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.1)' }}>
                <div className="mini-stat-val" style={{ color: '#ef4444' }}>{stats.critical}</div>
                <div className="mini-stat-lbl">Critical Cells</div>
              </div>
              <div className="mini-stat" style={{ flex: 1, borderColor: 'rgba(249, 115, 22, 0.3)', background: 'rgba(249, 115, 22, 0.1)' }}>
                <div className="mini-stat-val" style={{ color: '#f97316' }}>{stats.high}</div>
                <div className="mini-stat-lbl">High Risk</div>
              </div>
              <div className="mini-stat" style={{ flex: 1 }}>
                <div className="mini-stat-val" style={{ color: '#a78bfa' }}>{stats.totalAffectedArea.toLocaleString()} m²</div>
                <div className="mini-stat-lbl">Affected Area</div>
              </div>
            </div>

            {/* Most Affected Locations */}
            <div style={{ marginTop: '0.6rem' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Most Affected Locations
              </div>
              
              {stats.top10.length === 0 ? (
                <div style={{ fontSize: '0.65rem', color: '#64748b', fontStyle: 'italic', textAlign: 'center', padding: '0.5rem' }}>
                  No significant risk detected.
                </div>
              ) : (
                <div style={{ maxHeight: '140px', overflowY: 'auto', paddingRight: '0.2rem' }} className="custom-scrollbar">
                  <table style={{ width: '100%', fontSize: '0.65rem', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#1e293b' }}>
                      <tr style={{ color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        <th style={{ padding: '0.2rem', fontWeight: 500 }}>Cell</th>
                        <th style={{ padding: '0.2rem', fontWeight: 500 }}>Risk</th>
                        <th style={{ padding: '0.2rem', fontWeight: 500 }}>Lat / Lon</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.top10.map((item, idx) => (
                        <tr 
                          key={item.cell.cell_id} 
                          onClick={() => onSelectCell(item.cell)}
                          style={{ 
                            borderBottom: '1px solid rgba(255,255,255,0.04)',
                            cursor: 'pointer',
                            background: idx % 2 === 0 ? 'rgba(0,0,0,0)' : 'rgba(255,255,255,0.02)',
                            transition: 'background 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 0 ? 'rgba(0,0,0,0)' : 'rgba(255,255,255,0.02)'}
                        >
                          <td style={{ padding: '0.3rem 0.2rem', color: '#38bdf8', fontFamily: 'monospace' }}>{item.cell.cell_id}</td>
                          <td style={{ padding: '0.3rem 0.2rem', color: item.score >= 80 ? '#ef4444' : '#f97316', fontWeight: 600 }}>{item.score}</td>
                          <td style={{ padding: '0.3rem 0.2rem', color: '#cbd5e1', fontFamily: 'monospace', fontSize: '0.6rem' }}>
                            {item.cell.center_lat.toFixed(4)}, {item.cell.center_lon.toFixed(4)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Distribution */}
            <div style={{ marginTop: '0.6rem' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 600, color: '#e2e8f0', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Stress Distribution
              </div>
              <div style={{ display: 'flex', height: '0.6rem', width: '100%', borderRadius: '0.3rem', overflow: 'hidden', background: 'rgba(255,255,255,0.1)' }}>
                {stats.critical > 0 && <div style={{ width: `${(stats.critical / (gridData?.metadata.valid_cells || 1)) * 100}%`, background: '#ef4444' }} title={`Critical: ${stats.critical}`} />}
                {stats.high > 0 && <div style={{ width: `${(stats.high / (gridData?.metadata.valid_cells || 1)) * 100}%`, background: '#f97316' }} title={`High: ${stats.high}`} />}
                {stats.moderate > 0 && <div style={{ width: `${(stats.moderate / (gridData?.metadata.valid_cells || 1)) * 100}%`, background: '#f59e0b' }} title={`Moderate: ${stats.moderate}`} />}
                {stats.low > 0 && <div style={{ width: `${(stats.low / (gridData?.metadata.valid_cells || 1)) * 100}%`, background: '#34d399' }} title={`Low/None: ${stats.low}`} />}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.55rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                <span>Crit: {stats.critical}</span>
                <span>High: {stats.high}</span>
                <span>Mod: {stats.moderate}</span>
              </div>
            </div>

          </div>
        )}
      </div>
      )}
    </div>
  );
};
