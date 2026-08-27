import { describe, expect, it } from 'vitest'
import { partitionRefreshModels } from '../src/model-refresh.js'

describe('partitionRefreshModels', () => {
  it('keeps text models and removes Anthropic duplicates from OpenAI', () => {
    const result = partitionRefreshModels(
      { data: [
        { id: 'shared', name: 'Shared', output_modalities: ['text'] },
        { id: 'openai-only', display_name: 'OpenAI only', output_modalities: ['text'], context_length: 1000 },
        { id: 'image', output_modalities: ['image'] },
      ] },
      { data: [
        { id: 'shared', display_name: 'Shared Anthropic', output_modalities: ['text'], capabilities: { reasoning: true } },
      ] },
    )
    expect(result.anthropicModels).toHaveLength(1)
    expect(result.anthropicModels[0]?.reasoningEfforts?.medium).toBe('medium')
    expect(result.openaiOnlyModels.map(model => model.id)).toEqual(['openai-only'])
  })
})
