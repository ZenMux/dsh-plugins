import { describe, expect, it } from 'vitest'
import {
  partitionLanguageModels,
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
        id: 'openai/openai-only-test',
        display_name: 'OpenAI Only',
        context_length: 64000,
        input_modalities: ['text'],
        output_modalities: ['text'],
        capabilities: { reasoning: false },
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
  const anthropicPayload = { data: [payload.data[0]] }

  it('keeps only text-output models and maps DSH-supported input modalities', () => {
    expect(selectLanguageModels(payload)).toEqual([{
      id: 'openai/gpt-test',
      name: "OpenAI: Tester's Model",
      contextWindow: 128000,
      maxTokens: undefined,
      input: ['text', 'image'],
      reasoning: true,
    }, {
      id: 'openai/openai-only-test',
      name: 'OpenAI Only',
      contextWindow: 64000,
      maxTokens: undefined,
      input: ['text'],
      reasoning: false,
    }])
  })

  it('prefers Anthropic for shared models and leaves only the remainder on OpenAI', () => {
    expect(partitionLanguageModels(payload, anthropicPayload)).toEqual({
      anthropicModels: [selectLanguageModels(payload)[0]],
      openaiOnlyModels: [selectLanguageModels(payload)[1]],
      totalUnique: 2,
    })
  })

  it('renders safe YAML and replaces only the generated marker body', () => {
    const catalog = renderCatalog(selectLanguageModels(payload))
    expect(catalog).toContain("name: 'OpenAI: Tester''s Model'")
    expect(catalog).toContain('reasoningEfforts:')
    expect(replaceGeneratedCatalog([
      'before',
      '          # test-catalog:start',
      '          - id: stale',
      '          # test-catalog:end',
      'after',
      '',
    ].join('\n'), catalog, '          # test-catalog:start', '          # test-catalog:end')).toBe([
      'before',
      '          # test-catalog:start',
      catalog,
      '          # test-catalog:end',
      'after',
      '',
    ].join('\n'))
  })
})
