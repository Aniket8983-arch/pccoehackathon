const API_BASE = '';

export interface ImageAnalysisResult {
  crop: { name: string; confidence: number };
  predictions: Array<{ class_name: string; confidence: number }>;
  stress: {
    disease: { level: string; confidence: number; possible_conditions: string[] };
    water: { level: string; confidence: number; evidence: string[] };
    heat: { level: string; confidence: number; evidence: string[] };
    nutrient: { level: string; confidence: number; possible_conditions: string[] };
    pest: { level: string; confidence: number; possible_conditions: string[] };
  };
}

export interface SoilParameter {
  value: number | string | null;
  unit: string;
  status: string;
  reference_range: string;
}

export interface SoilAnalysisResult {
  parameters: Record<string, SoilParameter>;
  extraction_method: string;
  confidence: string;
}

export interface FullAnalysisResult {
  analysis_id: string;
  timestamp: string;
  farm: any;
  cell: any;
  image_prediction: ImageAnalysisResult | null;
  soil_report: SoilAnalysisResult | null;
  stress_assessment: Record<string, any>;
  recommendations: string[];
}

export async function analyzeImage(file: File, cellId?: string): Promise<ImageAnalysisResult> {
  const formData = new FormData();
  formData.append('file', file);
  if (cellId) formData.append('cell_id', cellId);
  const res = await fetch(`${API_BASE}/api/ml/analyze-image`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function analyzeSoil(file: File): Promise<SoilAnalysisResult> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/api/ml/analyze-soil`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function runFullAnalysis(imageResult: any, soilResult: any, cellId: string): Promise<FullAnalysisResult> {
  const res = await fetch(`${API_BASE}/api/ml/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_result: imageResult, soil_result: soilResult, cell_id: cellId })
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getModelStatus(): Promise<any> {
  const res = await fetch(`${API_BASE}/api/ml/model-status`);
  return res.json();
}
