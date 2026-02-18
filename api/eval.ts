
import { GoogleGenAI, Type } from "@google/genai";

const analysisSchema = {
  type: Type.OBJECT,
  properties: {
    risks: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING },
          justification: { type: Type.STRING },
          probability: { type: Type.INTEGER },
          impact: { type: Type.INTEGER },
          normativeCitation: { type: Type.STRING }
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

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { description, macroprocess, businessLine, userExistingControl, rasPdfBase64 } = req.body;

  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API_KEY não configurada no servidor.' });
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const parts: any[] = [{ text: `Realize uma auditoria técnica GIR completa para o fato: ${description}. Macroprocesso: ${macroprocess}. Linha: ${businessLine}. Considere controles existentes: ${userExistingControl || 'N/A'}. Gere obrigatoriamente 3 controles (Preventivo, Detectivo, Corretivo).` }];
    
    if (rasPdfBase64) {
      parts.push({ inlineData: { mimeType: "application/pdf", data: rasPdfBase64 } });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts },
      config: {
        systemInstruction: "Você é um auditor de riscos bancários sênior. Sua análise deve ser baseada na Resolução 4557 do BCB. Forneça controles práticos e detalhados. Responda APENAS em JSON.",
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
        temperature: 0.1
      }
    });

    const jsonStr = response.text?.trim();
    if (!jsonStr) throw new Error("Resposta vazia da IA.");

    return res.status(200).json(JSON.parse(jsonStr));

  } catch (error: any) {
    console.error("[API-ERROR]", error);
    return res.status(500).json({ 
      error: 'Erro no Motor de IA', 
      message: error.message || 'Erro de processamento'
    });
  }
}
