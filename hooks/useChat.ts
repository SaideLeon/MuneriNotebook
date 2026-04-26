import { useAppStore } from '@/store/app-store';
import { Message, Source } from '@/types';
import { useActivity } from './useActivity';

export function useChat() {
  const { 
    messages, 
    addMessage, 
    setIsLoading, 
    isLoading, 
    sources, 
    selectedNotebook 
  } = useAppStore();
  const { logActivity } = useActivity();

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content
    };

    addMessage(userMessage);
    setIsLoading(true);

    try {
      const selectedSources = sources.filter(s => s.selected && s.data);
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parts: [
            ...selectedSources.map(s => {
              if (s.type === 'pdf') {
                return {
                  inlineData: {
                    mimeType: 'application/pdf',
                    data: s.data!
                  }
                };
              } else {
                try {
                  const decodedText = decodeURIComponent(escape(atob(s.data!)));
                  return {
                    text: `Conteúdo da fonte "${s.name}":\n${decodedText}`
                  };
                } catch(e) {
                   return { text: `Erro na fonte: ${s.name}` };
                }
              }
            }),
            {
              text: `
                Você é o assistente inteligente do Muneri Notebooks.
                Contexto do notebook atual: ${selectedNotebook?.title}.
                
                Responda à pergunta do usuário com base nas fontes PDF/Texto fornecidas. 
                REGRAS CRÍTICAS:
                1. Sempre que usar informação de uma fonte, adicione uma citação no formato [Doc X, pg Y] (ou apenas [Doc X] para texto) imediatamente após a frase relevante.
                2. Use uma linguagem clara e informativa.
                
                Pergunta: ${content}
              `
            }
          ]
        })
      });

      const text = await response.text();

      // Extract citation IDs using regex
      const citationMatches = text.match(/\[Doc (\d+)(?:, pg (\d+))?\]/g);
      const uniqueCitations = citationMatches 
        ? Array.from(new Set(citationMatches.map(m => parseInt(m.match(/\[Doc (\d+)/)![1]))))
        : [];

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: text,
        citations: uniqueCitations
      };

      addMessage(assistantMessage);
      logActivity('message_sent', content.slice(0, 40));
    } catch (error) {
      console.error("Error generating response:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSummarizeDocument = async (sourceId: string) => {
    const source = sources.find(s => s.id === sourceId);
    if (!source || !source.data || isLoading) return;

    setIsLoading(true);
    addMessage({
      id: crypto.randomUUID(),
      role: 'user',
      content: `Resuma o documento: ${source.name}`
    });

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parts: [
            source.type === 'pdf' 
              ? { inlineData: { mimeType: 'application/pdf', data: source.data } }
              : { text: `Resuma este texto:\n${decodeURIComponent(escape(atob(source.data)))}` },
            { text: "Forneça um resumo executivo conciso deste documento. Destaque os pontos principais em tópicos." }
          ]
        })
      });
      
      const text = await response.text();

      addMessage({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: text
      });
      logActivity('document_summarized', source.name);
    } catch (error) {
      console.error("Error summarizing document:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return { handleSendMessage, handleSummarizeDocument };
}
