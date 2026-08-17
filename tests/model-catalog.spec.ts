import { describe, expect, it } from 'vitest'
import {
  renderCatalog,
  replaceGeneratedCatalog,
  selectLanguageModels,
} from '../scripts/sync-zenmux-models.mjs'

describe('ZenMux /models catalog generation', () => {
  const payload = {
    data: [
      {
        id: 'openai/gpt-test',
        display_name: "OpenAI: Tester's Model",
        context_length: 128000,
        input_modalities: ['text', 'image'],
        output_modalities: ['text'],
        capabilities: { reasoning: true },
      },
      {
        id: 'openai/text-embedding-test',
        display_name: 'Embedding',
        context_length: 8192,
        input_modalities: ['text'],
        output_modalities: ['embeddings'],
      },
    ],
  }

  it('keeps only text-output models and maps DSH-supported input modalities', () => {
    expect(selectLanguageModels(payload)).toEqual([{
      id: 'openai/gpt-test',
      name: "OpenAI: Tester's Model",
      contextWindow: 128000,
      maxTokens: undefined,
      input: ['text', 'image'],
      reasoning: true,
    }])
  })

  it('renders safe YAML and replaces only the generated marker body', () => {
    const catalog = renderCatalog(selectLanguageModels(payload))
    expect(catalog).toContain("name: 'OpenAI: Tester''s Model'")
    expect(catalog).toContain('reasoningEfforts:')
    expect(replaceGeneratedCatalog([
      'before',
      '          # zenmux-model-catalog:start',
      '          - id: stale',
      '          # zenmux-model-catalog:end',
      'after',
      '',
    ].join('\n'), catalog)).toBe([
      'before',
      '          # zenmux-model-catalog:start',
      catalog,
      '          # zenmux-model-catalog:end',
      'after',
      '',
    ].join('\n'))
  })
})
