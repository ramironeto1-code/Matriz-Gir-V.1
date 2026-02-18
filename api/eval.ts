
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
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const { description, macroprocess, businessLine, userExistingControl } = req.body;

  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    return res.status(500).json({ 
      message: 'API_KEY não configurada no ambiente da Vercel. Por favor, adicione-a em Settings > Environment Variables.' 
    });
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { 
        parts: [{ 
          text: `Você é um Auditor de Riscos Sênior (GECOR). Analise este fato sob a ótica da Resolução 4557 do BCB:
          
          FATO: ${description}
          MACROPROCESSO: ${macroprocess}
          LINHA DE NEGÓCIO: ${businessLine}
          CONTROLE EXISTENTE: ${userExistingControl || 'Nenhum'}
          
          Gere um parecer técnico completo em JSON, incluindo obrigatoriamente um Plano de Ação com controles Preventivo, Detectivo e Corretivo.` 
        }] 
      },
      config: {
        systemInstruction: "Sua resposta deve ser estritamente JSON. Utilize terminologia técnica bancária brasileira.",
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
        temperature: 0.1
      }
    });

    const result = response.text;
    if (!result) throw new Error("O motor de IA retornou uma resposta vazia.");

    try {
      const parsed = JSON.parse(result);
      return res.status(200).json(parsed);
    } catch (parseError) {
      console.error("Erro ao analisar JSON da IA:", result);
      throw new Error("A IA retornou um JSON malformado.");
    }

  } catch (error: any) {
    console.error("[API-ERROR]", error);
    return res.status(500).json({ 
      message: 'Falha no motor de IA', 
      details: error.message 
    });
  }
}
