
import { GoogleGenAI, Type } from "@google/genai";

const analysisSchema = {
  type: Type.OBJECT,
  properties: {
    risks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, description: "Tipo de risco baseado na Resolução 4557" },
          justification: { type: Type.STRING, description: "Justificativa técnica da tipificação" },
          probability: { type: Type.INTEGER, description: "Probabilidade (1 a 5)" },
          impact: { type: Type.INTEGER, description: "Impacto (1 a 5)" },
          normativeCitation: { type: Type.STRING, description: "Referência à 4557 ou normas correlatas" }
        },
        required: ["type", "justification", "probability", "impact", "normativeCitation"]
      }
    },
    suggestedControl: { type: Type.STRING },
    mitigationSuggested: { type: Type.STRING },
    mitigationControls: {
      type: Type.ARRAY,
      description: "Três tipos de controles sugeridos: Preventivo, Detectivo e Corretivo.",
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, enum: ["Preventivo", "Detectivo", "Corretivo"] },
          title: { type: Type.STRING },
          description: { type: Type.STRING }
        },
        required: ["type", "title", "description"]
      }
    },
    controlEffectiveness: { type: Type.INTEGER },
    rasStatus: { type: Type.STRING, enum: ["Dentro", "Alerta", "Fora"] },
    rasJustification: { type: Type.STRING },
    rasSource: { type: Type.STRING },
    crossLineImpacts: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { businessLineId: { type: Type.STRING }, reason: { type: Type.STRING } },
        required: ["businessLineId", "reason"]
      }
    },
    resolution4557Reference: { type: Type.STRING }
  },
  required: ["risks", "suggestedControl", "mitigationSuggested", "mitigationControls", "controlEffectiveness", "rasStatus", "rasJustification", "rasSource", "crossLineImpacts", "resolution4557Reference"]
};

export const analyzeOccurrence = async (
  description: string, 
  macroprocess: string, 
  businessLine: string, 
  userExistingControl?: string
) => {
  // Inicialização correta com parâmetro nomeado conforme diretrizes
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ 
        parts: [{ 
          text: `Auditoria GIR - Resolução 4557:
          Fato: ${description}
          Macroprocesso: ${macroprocess}
          Linha: ${businessLine}
          Controle Atual: ${userExistingControl || 'N/A'}
          
          Gere uma análise técnica JSON completa incluindo o Plano de Ação com 3 controles (Preventivo, Detectivo e Corretivo).` 
        }] 
      }],
      config: {
        systemInstruction: "Você é o Motor de Riscos GECOR. Sua saída deve ser RIGOROSAMENTE JSON. Use terminologia bancária brasileira.",
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
        temperature: 0.1
      }
    });

    const result = response.text;
    if (!result) throw new Error("Resposta nula do motor de IA.");
    return JSON.parse(result);

  } catch (error: any) {
    console.error("[GEMINI] Erro na requisição:", error);
    throw new Error(error.message || "Falha na comunicação com a inteligência artificial.");
  }
};
