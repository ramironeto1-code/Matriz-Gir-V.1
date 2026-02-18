
import { AIAnalysis } from "../types";

/**
 * Proxy de comunicação com a API Serverless da Vercel.
 */
export const analyzeOccurrence = async (
  description: string, 
  macroprocess: string, 
  businessLine: string, 
  userExistingControl?: string
): Promise<AIAnalysis> => {
  try {
    const response = await fetch('/api/eval', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        description,
        macroprocess,
        businessLine,
        userExistingControl
      }),
    });

    const contentType = response.headers.get("content-type");
    
    // Se não for OK e não for JSON, é provável que seja um erro de configuração da Vercel (404/500 HTML)
    if (!response.ok) {
      if (contentType && contentType.includes("application/json")) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Erro ${response.status}: ${response.statusText}`);
      } else {
        const text = await response.text();
        console.error("Erro do Servidor (HTML):", text);
        throw new Error(`Servidor indisponível (${response.status}). Verifique se as funções da Vercel foram implantadas corretamente.`);
      }
    }

    if (!contentType || !contentType.includes("application/json")) {
      throw new Error("O servidor retornou um formato inesperado (não-JSON).");
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error("[GIR-PROXY-ERROR]", error);
    throw new Error(error.message || "Falha na conexão com o servidor de IA.");
  }
};
