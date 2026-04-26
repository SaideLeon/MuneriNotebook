import { useAppStore } from '@/store/app-store';
import { Source } from '@/types';
import { useState } from 'react';

export function useSuggestions() {
  const { setIsLoading } = useAppStore();
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);

  const generateSuggestions = async (currentSources: Source[]) => {
    const activeSources = currentSources.filter(s => s.selected && s.data);
    if (activeSources.length === 0) {
      setSuggestedQuestions([]);
      return;
    }

    setIsGeneratingSuggestions(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parts: [
            ...activeSources.slice(0, 3).map(s => {
              if (s.type === 'pdf') {
                return {
                  inlineData: { mimeType: 'application/pdf', data: s.data! }
                };
              } else {
                return { text: `Fonte: ${s.name}\n${decodeURIComponent(escape(atob(s.data!)))}` };
              }
            }),
            {
              text: `
                Com base nos documentos fornecidos, gere 3 perguntas curtas e instigantes que um estudante poderia fazer para explorar o conteúdo.
                Retorne APENAS as perguntas, uma por linha, sem números, sem aspas.
              `
            }
          ]
        })
      });
      
      const text = await response.text();
      const questions = text.split('\n')
        .map(q => q.trim())
        .filter(q => q.length > 5 && q.includes('?'))
        .slice(0, 3);
      setSuggestedQuestions(questions);
    } catch (error) {
      console.error("Error generating suggestions:", error);
    } finally {
      setIsGeneratingSuggestions(false);
    }
  };

  return { suggestedQuestions, isGeneratingSuggestions, generateSuggestions };
}
