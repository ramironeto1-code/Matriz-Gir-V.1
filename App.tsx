
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BUSINESS_LINES } from './constants';
import { Occurrence, BusinessLine, Macroprocess, AIAnalysis, MitigationControl } from './types';
import { analyzeOccurrence } from './services/geminiService';
import { RiskDashboard } from './components/RiskDashboard';
import { 
  getRiskLevelData, 
  calculateLiquidRisk, 
  EFFICACY_LABELS,
  EFFICACY_REDUCTION_MAP
} from './utils';
import { 
  LayoutDashboard, 
  ShieldAlert, 
  Loader2, 
  Database,
  Sparkles,
  Trash2,
  History,
  Download,
  CheckCircle2,
  FileText,
  BrainCircuit,
  Plus,
  Edit3,
  Eraser,
  Save,
  X,
  RefreshCw,
  ClipboardCheck,
  PieChart,
  BarChart3,
  Scale,
  ShieldCheck,
  AlertTriangle,
  ExternalLink
} from 'lucide-react';

const PERSISTENCE_VERSION = 'GIR_V2_PROD_STABLE';

const generateUniqueId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const EditableControlCard: React.FC<{ 
  control: MitigationControl; 
  onDelete: () => void;
  onUpdate: (updated: MitigationControl) => void;
}> = ({ control, onDelete, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(control.title);
  const [editDesc, setEditDesc] = useState(control.description);
  const [editType, setEditType] = useState(control.type);

  if (isEditing) {
    return (
      <div className="p-4 rounded-2xl border border-slate-700 bg-slate-800 space-y-3">
        <select className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-[10px] font-bold text-slate-300" value={editType} onChange={(e) => setEditType(e.target.value as any)}>
          <option value="Preventivo">Preventivo</option>
          <option value="Detectivo">Detectivo</option>
          <option value="Corretivo">Corretivo</option>
        </select>
        <input className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-[10px] font-bold text-white" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
        <textarea className="w-full bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-[9px] text-slate-300 h-16" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
        <div className="flex gap-2">
          <button type="button" onClick={() => { onUpdate({ title: editTitle, description: editDesc, type: editType }); setIsEditing(false); }} className="flex-1 py-1.5 bg-emerald-600 rounded-lg text-[9px] font-black uppercase flex items-center justify-center gap-1"><Save size={12}/> Salvar</button>
          <button type="button" onClick={() => setIsEditing(false)} className="px-3 py-1.5 bg-slate-700 rounded-lg text-[9px] font-black uppercase"><X size={12}/></button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-2xl border border-slate-800 bg-slate-800/30 group relative">
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button type="button" onClick={() => setIsEditing(true)} className="p-1 hover:text-blue-400 text-slate-500"><Edit3 size={12} /></button>
        <button type="button" onClick={onDelete} className="p-1 hover:text-red-500 text-slate-500"><Trash2 size={12} /></button>
      </div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[7px] font-black uppercase px-2 py-1 bg-slate-800 rounded text-slate-400">{control.type}</span>
      </div>
      <h5 className="text-[10px] font-black text-slate-200 uppercase mb-1">{control.title}</h5>
      <p className="text-[9px] text-slate-400 leading-tight italic line-clamp-2">"{control.description}"</p>
    </div>
  );
};

export const App: React.FC = () => {
  const [occurrences, setOccurrences] = useState<Occurrence[]>(() => {
    try {
      const stable = localStorage.getItem(PERSISTENCE_VERSION);
      return stable ? JSON.parse(stable) : [];
    } catch { return []; }
  });

  const [activeTab, setActiveTab] = useState<'dashboard' | 'matrix' | 'history' | 'governance'>('dashboard');
  const [selectedLine, setSelectedLine] = useState<BusinessLine>(BUSINESS_LINES[0]);
  const [description, setDescription] = useState('');
  const [existingControl, setExistingControl] = useState('');
  const [controlEffectiveness, setControlEffectiveness] = useState<number>(3);
  const [selectedMacro, setSelectedMacro] = useState<Macroprocess | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [tempAnalysis, setTempAnalysis] = useState<AIAnalysis | null>(null);
  const [manualProb, setManualProb] = useState<number>(3);
  const [manualImpact, setManualImpact] = useState<number>(3);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(PERSISTENCE_VERSION, JSON.stringify(occurrences));
  }, [occurrences]);

  const handleDelete = useCallback((id: string) => {
    if (!id) return;
    setOccurrences(prev => {
      const updated = prev.filter(occ => String(occ.id) !== String(id));
      localStorage.setItem(PERSISTENCE_VERSION, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearForm = () => {
    if (editingId) {
      if (window.confirm("Atenção: Você está revisando um fato gravado. Ao limpar este formulário, o registro original será EXCLUÍDO automaticamente da matriz. Confirmar?")) {
        handleDelete(editingId);
      } else { return; }
    }
    setDescription('');
    setExistingControl('');
    setControlEffectiveness(3);
    setManualProb(3);
    setManualImpact(3);
    setTempAnalysis(null);
    setSelectedMacro(null);
    setEditingId(null);
  };

  const handleDiscardRevision = () => {
    if (editingId && window.confirm("Descartar revisão? Isso excluirá o registro original da matriz.")) {
      handleDelete(editingId);
      setEditingId(null);
      setTempAnalysis(null);
      setDescription('');
      setExistingControl('');
    } else if (!editingId) {
      setTempAnalysis(null);
    }
  };

  const handleRiskEvaluation = async () => {
    if (!description.trim() || !selectedMacro) {
      alert("Por favor, preencha a descrição e selecione o macroprocesso.");
      return;
    }
    
    setIsAnalyzing(true);
    try {
      const result = await analyzeOccurrence(description, selectedMacro.name, selectedLine.name, existingControl);
      setTempAnalysis(result);
      if (result.risks?.length > 0) {
        setManualProb(result.risks[0].probability);
        setManualImpact(result.risks[0].impact);
      }
    } catch (e: any) { 
      alert(`Falha na análise: ${e.message}`); 
    } finally { 
      setIsAnalyzing(false); 
    }
  };

  const handleConfirmRegistration = () => {
    if (!tempAnalysis || !selectedMacro) return;
    const newOcc: Occurrence = {
      id: editingId || generateUniqueId(),
      businessLineId: selectedLine.id,
      macroprocessId: selectedMacro.id,
      description,
      date: new Date().toLocaleDateString('pt-BR'),
      analysis: {
        ...tempAnalysis,
        existingControl,
        controlEffectiveness,
        risks: tempAnalysis.risks.map(r => ({ ...r, probability: manualProb as any, impact: manualImpact as any }))
      }
    };

    setOccurrences(prev => {
      const filtered = editingId ? prev.filter(o => o.id !== editingId) : prev;
      return [newOcc, ...filtered];
    });

    setEditingId(null);
    setDescription('');
    setExistingControl('');
    setTempAnalysis(null);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleReanalyze = (occ: Occurrence) => {
    setEditingId(occ.id);
    const line = BUSINESS_LINES.find(l => l.id === occ.businessLineId) || BUSINESS_LINES[0];
    setSelectedLine(line);
    setSelectedMacro(line.macroprocesses.find(m => m.id === occ.macroprocessId) || null);
    setDescription(occ.description);
    setExistingControl(occ.analysis?.existingControl || '');
    setControlEffectiveness(occ.analysis?.controlEffectiveness || 3);
    setManualProb(occ.analysis?.risks?.[0]?.probability || 3);
    setManualImpact(occ.analysis?.risks?.[0]?.impact || 3);
    setTempAnalysis(null);
    setActiveTab('matrix');
  };

  const handleExportExcel = () => {
    const data = occurrences.map(o => {
      const inherent = (Number(o.analysis?.risks?.[0]?.probability || 3) + Number(o.analysis?.risks?.[0]?.impact || 3)) / 2;
      const liquid = calculateLiquidRisk(inherent, o.analysis?.controlEffectiveness || 3);
      const line = BUSINESS_LINES.find(l => l.id === o.businessLineId);
      const macro = line?.macroprocesses.find(m => m.id === o.macroprocessId);
      
      return {
        'Data': o.date,
        'Linha de Negócio': line?.name,
        'Macroprocesso': macro?.name,
        'Fato Gerador': o.description,
        'Risco Inerente': inherent.toFixed(2),
        'Eficácia': EFFICACY_LABELS[o.analysis?.controlEffectiveness || 3],
        'Score Líquido': liquid.toFixed(2),
        'Criticidade': getRiskLevelData(liquid).label,
        'Status RAS': o.analysis?.rasStatus,
        'Plano de Ação': o.analysis?.mitigationControls?.map(c => `${c.type}: ${c.title}`).join(' | ')
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Base GIR");
    XLSX.writeFile(wb, `Matriz_GIR_Auditoria_${Date.now()}.xlsx`);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(22);
    doc.setTextColor(2, 6, 23); // dark-950
    doc.text('Relatório Executivo GIR', 14, 25);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 32);
    doc.text(`Resolução BCB nº 4.557`, pageWidth - 50, 32);

    // Sumário Executivo
    const total = occurrences.length;
    const alertRas = occurrences.filter(o => o.analysis?.rasStatus === 'Fora').length;
    const avgScore = occurrences.length > 0 
      ? occurrences.reduce((acc, curr) => acc + calculateLiquidRisk((Number(curr.analysis?.risks?.[0]?.probability || 3) + Number(curr.analysis?.risks?.[0]?.impact || 3)) / 2, curr.analysis?.controlEffectiveness || 3), 0) / occurrences.length
      : 0;

    autoTable(doc, {
      startY: 40,
      head: [['Métrica', 'Valor']],
      body: [
        ['Total de Ocorrências Auditadas', total.toString()],
        ['Fatos com Alerta RAS (Apetite Excedido)', alertRas.toString()],
        ['Score Líquido Médio Global', avgScore.toFixed(2)],
        ['Status de Conformidade Global', avgScore > 3.4 ? 'CRÍTICO' : 'ESTÁVEL']
      ],
      theme: 'grid',
      headStyles: { fillStyle: 'F', fillColor: [30, 41, 59] }
    });

    // Detalhamento por Ocorrência
    doc.addPage();
    doc.text('Detalhamento da Matriz de Riscos', 14, 20);

    const bodyData = occurrences.map(o => {
      const line = BUSINESS_LINES.find(l => l.id === o.businessLineId)?.name || '';
      const score = calculateLiquidRisk((Number(o.analysis?.risks?.[0]?.probability || 3) + Number(o.analysis?.risks?.[0]?.impact || 3)) / 2, o.analysis?.controlEffectiveness || 3);
      return [
        o.date,
        line,
        o.description.substring(0, 50) + '...',
        score.toFixed(2),
        o.analysis?.rasStatus || 'N/A'
      ];
    });

    autoTable(doc, {
      startY: 25,
      head: [['Data', 'Linha', 'Fato', 'Score Líq.', 'Status RAS']],
      body: bodyData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [2, 6, 23] }
    });

    doc.save(`Relatorio_Executivo_GIR_${Date.now()}.pdf`);
  };

  // Cálculos para a Governança
  const govStats = useMemo(() => {
    const total = occurrences.length;
    if (total === 0) return { avgLiquid: 0, alertCount: 0, avgMitigation: 0, linePerformance: [] };

    const avgLiquid = occurrences.reduce((acc, curr) => {
      const inh = (Number(curr.analysis?.risks?.[0]?.probability || 3) + Number(curr.analysis?.risks?.[0]?.impact || 3)) / 2;
      return acc + calculateLiquidRisk(inh, curr.analysis?.controlEffectiveness || 3);
    }, 0) / total;

    const alertCount = occurrences.filter(o => o.analysis?.rasStatus === 'Fora').length;
    
    const avgMitigation = occurrences.reduce((acc, curr) => {
      return acc + (EFFICACY_REDUCTION_MAP[curr.analysis?.controlEffectiveness || 3] || 0.5) * 100;
    }, 0) / total;

    const linePerformance = BUSINESS_LINES.map(line => {
      const lineOccs = occurrences.filter(o => o.businessLineId === line.id);
      const lineAvgLiquid = lineOccs.length > 0 
        ? lineOccs.reduce((acc, curr) => acc + calculateLiquidRisk((Number(curr.analysis?.risks?.[0]?.probability || 3) + Number(curr.analysis?.risks?.[0]?.impact || 3)) / 2, curr.analysis?.controlEffectiveness || 3), 0) / lineOccs.length
        : 0;
      return {
        name: line.name,
        count: lineOccs.length,
        avgLiquid: lineAvgLiquid,
        status: lineAvgLiquid > 3.4 ? 'Crítico' : lineAvgLiquid > 2.6 ? 'Alerta' : 'Controlado'
      };
    });

    return { avgLiquid, alertCount, avgMitigation, linePerformance };
  }, [occurrences]);

  return (
    <div className="flex min-h-screen bg-dark-950 text-slate-100 font-inter">
      <div className="w-72 bg-[#0a0f1d] border-r border-slate-800 fixed h-full p-6 flex flex-col gap-6 z-20">
        <div className="flex items-center gap-3 mb-4">
           <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-900/40"><ShieldAlert className="text-white" size={24} /></div>
           <h1 className="text-xl font-black tracking-tighter">MATRIZ GIR</h1>
        </div>
        <nav className="flex flex-col gap-1">
           <button type="button" onClick={() => setActiveTab('dashboard')} className={`p-3 rounded-xl flex items-center gap-3 font-bold ${activeTab === 'dashboard' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}><LayoutDashboard size={18}/> Dashboard</button>
           <button type="button" onClick={() => setActiveTab('matrix')} className={`p-3 rounded-xl flex items-center gap-3 font-bold ${activeTab === 'matrix' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}><Sparkles size={18}/> Análise</button>
           <button type="button" onClick={() => setActiveTab('history')} className={`p-3 rounded-xl flex items-center gap-3 font-bold ${activeTab === 'history' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}><History size={18}/> Histórico</button>
           <button type="button" onClick={() => setActiveTab('governance')} className={`p-3 rounded-xl flex items-center gap-3 font-bold ${activeTab === 'governance' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}><Database size={18}/> Governança</button>
        </nav>
      </div>

      <main className="ml-72 p-10 w-full relative">
        {saveSuccess && (
          <div className="fixed top-10 right-10 bg-emerald-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-bounce z-50">
            <CheckCircle2 size={24} /> <span className="font-black text-xs uppercase">Matriz Atualizada!</span>
          </div>
        )}

        <div className={activeTab === 'dashboard' ? 'block' : 'hidden'}><RiskDashboard occurrences={occurrences} /></div>

        {activeTab === 'matrix' && (
          <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div className="space-y-6">
                   <div className="flex items-center justify-between">
                      <h2 className="text-2xl font-black uppercase">{editingId ? 'Revisar Fato' : 'Nova Auditoria'}</h2>
                      <button type="button" onClick={clearForm} className="text-[10px] font-black uppercase text-slate-500 hover:text-red-400 flex items-center gap-2">
                        <Eraser size={14}/> {editingId ? 'Excluir da Matriz' : 'Limpar'}
                      </button>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <select className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-sm" value={selectedLine.id} onChange={e => setSelectedLine(BUSINESS_LINES.find(l => l.id === e.target.value) || BUSINESS_LINES[0])}>
                        {BUSINESS_LINES.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                      <select className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-sm" value={selectedMacro?.id || ''} onChange={e => setSelectedMacro(selectedLine.macroprocesses.find(m => m.id === e.target.value) || null)}>
                         <option value="">Macroprocesso...</option>
                         {selectedLine.macroprocesses.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                   </div>
                   <textarea className="w-full p-4 bg-slate-900 border border-slate-800 rounded-2xl h-32 text-sm" placeholder="Fato Gerador..." value={description} onChange={e => setDescription(e.target.value)} />
                   <textarea className="w-full p-4 bg-slate-900 border border-slate-800 rounded-2xl h-24 text-sm" placeholder="Controles Atuais..." value={existingControl} onChange={e => setExistingControl(e.target.value)} />
                   <div className="grid grid-cols-2 gap-4 bg-slate-900/50 p-6 rounded-3xl border border-slate-800">
                      <div><label className="text-[9px] font-black text-slate-600 uppercase mb-2 block">Probabilidade</label>
                        <select className="w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-sm" value={manualProb} onChange={e => setManualProb(Number(e.target.value))}>{[1,2,3,4,5].map(v => <option key={v} value={v}>Nível {v}</option>)}</select>
                      </div>
                      <div><label className="text-[9px] font-black text-slate-600 uppercase mb-2 block">Impacto</label>
                        <select className="w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-sm" value={manualImpact} onChange={e => setManualImpact(Number(e.target.value))}>{[1,2,3,4,5].map(v => <option key={v} value={v}>Nível {v}</option>)}</select>
                      </div>
                      <div className="col-span-2"><label className="text-[9px] font-black text-slate-600 uppercase mb-2 block">Eficácia Unidade</label>
                        <select className="w-full p-3 bg-slate-900 border border-slate-800 rounded-xl text-sm font-bold" value={controlEffectiveness} onChange={e => setControlEffectiveness(Number(e.target.value))}>
                           {Object.keys(EFFICACY_LABELS).map(k => <option key={k} value={k}>{EFFICACY_LABELS[Number(k)]}</option>)}
                        </select>
                      </div>
                   </div>
                   <button type="button" onClick={handleRiskEvaluation} disabled={isAnalyzing} className="w-full py-4 bg-blue-600 font-black text-xs uppercase rounded-2xl flex items-center justify-center gap-2">
                      {isAnalyzing ? <><Loader2 className="animate-spin" size={18} /> Processando...</> : <><BrainCircuit size={18}/> Avaliar com IA</>}
                   </button>
                </div>
                <div>{tempAnalysis ? (
                  <div className="bg-[#0a0f1d] p-8 rounded-[40px] border border-slate-800 space-y-6 shadow-2xl animate-in slide-in-from-right duration-500">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                      <span className="text-[10px] font-black uppercase text-blue-400">Auditoria Técnica</span>
                      <div className={`px-4 py-1 text-[9px] font-black rounded-full border ${tempAnalysis.rasStatus === 'Fora' ? 'text-red-500 border-red-500' : 'text-emerald-400 border-emerald-500'}`}>RAS: {tempAnalysis.rasStatus}</div>
                    </div>
                    <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 text-center">
                      <p className="text-[8px] font-black text-slate-600 uppercase mb-1">Score Líquido</p>
                      <p className="text-4xl font-black">{calculateLiquidRisk((manualProb+manualImpact)/2, controlEffectiveness).toFixed(2)}</p>
                    </div>
                    <div className="space-y-3">
                      <p className="text-[9px] font-black text-slate-500 uppercase">Plano de Ação Recomendado</p>
                      <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {tempAnalysis.mitigationControls.map((ctrl, i) => (
                          <EditableControlCard key={i} control={ctrl} onDelete={() => {}} onUpdate={() => {}} />
                        ))}
                      </div>
                    </div>
                    <div className="pt-4 space-y-3">
                      <button type="button" onClick={handleConfirmRegistration} className="w-full py-4 bg-emerald-600 font-black text-xs uppercase rounded-2xl">Confirmar e Gravar</button>
                      <button type="button" onClick={handleDiscardRevision} className="w-full py-2 text-slate-500 text-[9px] font-black uppercase">{editingId ? 'Remover e Descartar' : 'Descartar'}</button>
                    </div>
                  </div>
                ) : <div className="h-full border-2 border-dashed border-slate-800 rounded-[40px] flex items-center justify-center opacity-30 p-10 text-center text-[10px] font-black uppercase">Aguardando fato gerador...</div>}</div>
             </div>
          </div>
        )}

        {activeTab === 'governance' && (
          <div className="max-w-7xl mx-auto space-y-8 animate-in zoom-in duration-500">
             {/* Header Executivo */}
             <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-900 p-10 rounded-[48px] border border-slate-800 shadow-2xl">
                <div>
                   <h2 className="text-3xl font-black uppercase tracking-tighter">Relatório de Governança GIR</h2>
                   <p className="text-sm text-slate-500 mt-1 font-medium italic">Consolidado institucional sob diretrizes da Resolução BCB 4.557</p>
                </div>
                <div className="flex gap-3">
                   <button type="button" onClick={handleExportExcel} className="px-6 py-4 bg-slate-800 font-black text-[10px] uppercase rounded-2xl flex items-center gap-2 hover:bg-slate-700 transition-colors"><Download size={16}/> Excel</button>
                   <button type="button" onClick={handleExportPDF} className="px-6 py-4 bg-blue-600 font-black text-[10px] uppercase rounded-2xl flex items-center gap-2 hover:bg-blue-500 transition-colors"><FileText size={16}/> PDF Executivo</button>
                </div>
             </div>

             {/* KPIs de Performance Institucional */}
             <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-slate-900/50 p-8 rounded-[36px] border border-slate-800/50 backdrop-blur-sm group hover:border-blue-500/30 transition-all">
                   <div className="p-3 bg-blue-600/10 rounded-xl w-fit mb-4 text-blue-500"><BarChart3 size={24}/></div>
                   <p className="text-[10px] font-black text-slate-600 uppercase mb-1">Score Médio Global</p>
                   <p className="text-4xl font-black text-slate-100">{govStats.avgLiquid.toFixed(2)}</p>
                   <div className="mt-4 flex items-center gap-2">
                      <div className={`h-1.5 flex-1 rounded-full bg-slate-800 overflow-hidden`}>
                         <div className={`h-full ${getRiskLevelData(govStats.avgLiquid).color}`} style={{ width: `${(govStats.avgLiquid/5)*100}%` }}></div>
                      </div>
                      <span className="text-[9px] font-black uppercase text-slate-500">{getRiskLevelData(govStats.avgLiquid).label}</span>
                   </div>
                </div>

                <div className="bg-slate-900/50 p-8 rounded-[36px] border border-slate-800/50 backdrop-blur-sm group hover:border-red-500/30 transition-all">
                   <div className="p-3 bg-red-600/10 rounded-xl w-fit mb-4 text-red-500"><AlertTriangle size={24}/></div>
                   <p className="text-[10px] font-black text-slate-600 uppercase mb-1">Alertas RAS (Apetite)</p>
                   <p className="text-4xl font-black text-red-500">{govStats.alertCount}</p>
                   <p className="text-[9px] text-slate-500 mt-2 font-bold uppercase italic">Excederam Limites Normativos</p>
                </div>

                <div className="bg-slate-900/50 p-8 rounded-[36px] border border-slate-800/50 backdrop-blur-sm group hover:border-emerald-500/30 transition-all">
                   <div className="p-3 bg-emerald-600/10 rounded-xl w-fit mb-4 text-emerald-500"><ShieldCheck size={24}/></div>
                   <p className="text-[10px] font-black text-slate-600 uppercase mb-1">Eficácia de Mitigação</p>
                   <p className="text-4xl font-black text-emerald-500">{govStats.avgMitigation.toFixed(1)}%</p>
                   <p className="text-[9px] text-slate-500 mt-2 font-bold uppercase italic">Redução Média de Exposição</p>
                </div>

                <div className="bg-slate-900/50 p-8 rounded-[36px] border border-slate-800/50 backdrop-blur-sm group hover:border-slate-500/30 transition-all">
                   <div className="p-3 bg-slate-600/10 rounded-xl w-fit mb-4 text-slate-400"><Scale size={24}/></div>
                   <p className="text-[10px] font-black text-slate-600 uppercase mb-1">Status 4.557</p>
                   <p className="text-3xl font-black text-slate-100">{govStats.avgLiquid < 3.4 ? 'CONFORME' : 'ATENÇÃO'}</p>
                   <p className="text-[9px] text-slate-500 mt-2 font-bold uppercase italic">Governança Corporativa</p>
                </div>
             </div>

             {/* Tabela de Performance por Linha de Negócio */}
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-slate-900 p-10 rounded-[48px] border border-slate-800 shadow-xl">
                   <div className="flex justify-between items-center mb-8">
                      <h3 className="text-xl font-black uppercase tracking-tight">Análise de Performance GIR</h3>
                      <button className="text-[10px] font-black text-blue-500 uppercase flex items-center gap-1">Ver todos <ExternalLink size={12}/></button>
                   </div>
                   <div className="overflow-x-auto">
                      <table className="w-full border-collapse">
                         <thead>
                            <tr className="border-b border-slate-800 text-left">
                               <th className="pb-4 text-[10px] font-black text-slate-600 uppercase">Linha de Negócio</th>
                               <th className="pb-4 text-[10px] font-black text-slate-600 uppercase text-center">Volume</th>
                               <th className="pb-4 text-[10px] font-black text-slate-600 uppercase text-center">Score Líquido</th>
                               <th className="pb-4 text-[10px] font-black text-slate-600 uppercase text-right">Status Governança</th>
                            </tr>
                         </thead>
                         <tbody>
                            {govStats.linePerformance.map((lp, i) => (
                               <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-950/50 transition-colors">
                                  <td className="py-5 font-bold text-sm text-slate-300">{lp.name}</td>
                                  <td className="py-5 text-center font-black text-slate-400">{lp.count}</td>
                                  <td className="py-5 text-center font-black text-slate-100">{lp.avgLiquid.toFixed(2)}</td>
                                  <td className="py-5 text-right">
                                     <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase ${lp.status === 'Crítico' ? 'bg-red-600/10 text-red-500 border border-red-500/20' : lp.status === 'Alerta' ? 'bg-yellow-400/10 text-yellow-500 border border-yellow-400/20' : 'bg-emerald-600/10 text-emerald-500 border border-emerald-500/20'}`}>
                                        {lp.status}
                                     </span>
                                  </td>
                               </tr>
                            ))}
                         </tbody>
                      </table>
                   </div>
                </div>

                {/* Pilares Resolução 4557 */}
                <div className="bg-slate-900 p-10 rounded-[48px] border border-slate-800 shadow-xl">
                   <h3 className="text-xl font-black uppercase tracking-tight mb-8">Conformidade 4.557</h3>
                   <div className="space-y-6">
                      {[
                         { label: 'RAS (Apetite)', status: govStats.alertCount === 0 },
                         { label: 'GIR (Integração)', status: occurrences.length > 0 },
                         { label: 'Eficácia Controles', status: govStats.avgMitigation > 70 },
                         { label: 'Auditoria TI', status: occurrences.some(o => o.description.toLowerCase().includes('ti') || o.description.toLowerCase().includes('tecnologia')) },
                         { label: 'Capital/Liquidez', status: true }
                      ].map((item, idx) => (
                         <div key={idx} className="flex items-center justify-between p-4 bg-slate-950 rounded-2xl border border-slate-800/50">
                            <span className="text-xs font-bold text-slate-400">{item.label}</span>
                            {item.status ? <CheckCircle2 size={18} className="text-emerald-500" /> : <X size={18} className="text-red-500" />}
                         </div>
                      ))}
                   </div>
                   <div className="mt-8 p-6 bg-blue-600/5 rounded-3xl border border-blue-500/10">
                      <p className="text-[9px] font-bold text-slate-500 uppercase leading-relaxed italic">
                        "As instituições devem manter estrutura de gerenciamento de riscos compatível com a natureza do modelo de negócio e complexidade das operações." - Art. 3º Res. 4557
                      </p>
                   </div>
                </div>
             </div>

             {/* Impactos Transversais Detalhados */}
             <div className="bg-slate-900 p-10 rounded-[48px] border border-slate-800 shadow-xl">
                <h3 className="text-xl font-black uppercase tracking-tight mb-8">Análise de Impactos Transversais (Risco de Contágio)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {occurrences.filter(o => o.analysis?.crossLineImpacts && o.analysis.crossLineImpacts.length > 0).slice(0, 6).map((o, idx) => (
                      <div key={idx} className="bg-slate-950 p-6 rounded-3xl border border-slate-800 hover:border-blue-500/30 transition-all">
                         <div className="flex items-center justify-between mb-4">
                            <span className="text-[9px] font-black text-slate-600 uppercase italic">ID: {o.id.substring(0, 8)}</span>
                            <span className="p-2 bg-blue-600/10 rounded-lg text-blue-500"><Sparkles size={14}/></span>
                         </div>
                         <p className="text-xs font-bold text-slate-300 line-clamp-2 mb-4 leading-relaxed">"{o.description}"</p>
                         <div className="pt-4 border-t border-slate-800">
                            <p className="text-[8px] font-black text-slate-600 uppercase mb-2">Linhas Impactadas:</p>
                            <div className="flex flex-wrap gap-2">
                               {o.analysis?.crossLineImpacts.map((cl, cidx) => (
                                  <span key={cidx} className="px-3 py-1 bg-slate-900 rounded-full text-[8px] font-black text-blue-400 border border-blue-400/10">
                                     {BUSINESS_LINES.find(bl => bl.id === cl.businessLineId)?.name || cl.businessLineId}
                                  </span>
                               ))}
                            </div>
                         </div>
                      </div>
                   ))}
                   {occurrences.filter(o => o.analysis?.crossLineImpacts && o.analysis.crossLineImpacts.length > 0).length === 0 && (
                      <div className="col-span-3 py-10 text-center opacity-30">
                         <p className="text-[10px] font-black uppercase tracking-widest">Nenhum impacto transversal detectado nos fatos atuais</p>
                      </div>
                   )}
                </div>
             </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="max-w-6xl mx-auto space-y-4 animate-in fade-in duration-500">
             <div className="flex justify-between items-center mb-4"><h2 className="text-2xl font-black uppercase">Histórico da Matriz</h2></div>
             {occurrences.length === 0 ? (
               <div className="py-20 text-center opacity-30">
                  <History size={48} className="mx-auto mb-4" />
                  <p className="text-sm font-black uppercase">O histórico está vazio.</p>
               </div>
             ) : (
               occurrences.map(occ => {
                 const liq = calculateLiquidRisk((Number(occ.analysis?.risks?.[0]?.probability || 3) + Number(occ.analysis?.risks?.[0]?.impact || 3))/2, occ.analysis?.controlEffectiveness || 3);
                 return (
                   <div key={occ.id} className="bg-slate-900 p-6 rounded-3xl border border-slate-800 flex items-center justify-between hover:border-slate-700 transition-all">
                      <div className="flex items-center gap-6 truncate">
                         <div className={`w-3 h-3 rounded-full ${getRiskLevelData(liq).color}`}></div>
                         <div className="truncate"><p className="text-[9px] font-black text-slate-600 uppercase mb-1">{occ.date} • {BUSINESS_LINES.find(l => l.id === occ.businessLineId)?.name}</p>
                            <p className="text-sm font-bold text-slate-200 truncate max-w-2xl">{occ.description}</p>
                         </div>
                      </div>
                      <div className="flex items-center gap-4">
                         <div className="text-right mr-4"><p className="text-[8px] font-black text-slate-600 uppercase">Score</p><p className="text-lg font-black">{liq.toFixed(2)}</p></div>
                         <div className="flex gap-2">
                           <button type="button" onClick={() => handleReanalyze(occ)} className="p-3 text-slate-500 hover:text-blue-400 rounded-xl"><RefreshCw size={20}/></button>
                           <button type="button" onClick={() => handleDelete(occ.id)} className="p-3 text-slate-500 hover:text-red-500 rounded-xl"><Trash2 size={20}/></button>
                         </div>
                      </div>
                   </div>
                 )
               })
             )}
          </div>
        )}
      </main>
    </div>
  );
};
