
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
  EFFICACY_LABELS 
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
  PieChart
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
    if (!description.trim() || !selectedMacro) return;
    setIsAnalyzing(true);
    try {
      const result = await analyzeOccurrence(description, selectedMacro.name, selectedLine.name, existingControl);
      setTempAnalysis(result);
      if (result.risks?.length > 0) {
        setManualProb(result.risks[0].probability);
        setManualImpact(result.risks[0].impact);
      }
    } catch (e) { alert("Erro ao contatar o motor de IA. Verifique sua chave."); }
    finally { setIsAnalyzing(false); }
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
          <div className="max-w-6xl mx-auto space-y-8 animate-in zoom-in duration-300">
             <div className="flex items-center justify-between"><h2 className="text-3xl font-black uppercase">Governança</h2>
                <button type="button" onClick={handleExportExcel} className="px-6 py-3 bg-slate-800 font-black text-[10px] uppercase rounded-xl flex items-center gap-2"><Download size={16}/> Exportar Excel</button>
             </div>
             <div className="grid grid-cols-4 gap-6">
                <div className="bg-slate-900 p-8 rounded-[32px] border border-slate-800"><p className="text-[10px] font-black text-slate-500 uppercase">Total Eventos</p><p className="text-4xl font-black">{occurrences.length}</p></div>
                <div className="bg-slate-900 p-8 rounded-[32px] border border-slate-800"><p className="text-[10px] font-black text-slate-500 uppercase">Alertas RAS</p><p className="text-4xl font-black text-red-500">{occurrences.filter(o => o.analysis?.rasStatus === 'Fora').length}</p></div>
             </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="max-w-6xl mx-auto space-y-4 animate-in fade-in duration-500">
             <div className="flex justify-between items-center mb-4"><h2 className="text-2xl font-black uppercase">Histórico da Matriz</h2></div>
             {occurrences.map(occ => {
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
             })}
          </div>
        )}
      </main>
    </div>
  );
};
