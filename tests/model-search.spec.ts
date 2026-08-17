import { describe, expect, it } from 'vitest'
import { filterModelGroups } from '../src/model-search.ts'

const groups = [
  {
    id: 'zenmux-models',
    name: 'ZenMux',
    models: [
      { id: 'openai/gpt-5.6-sol', name: 'OpenAI: GPT-5.6 Sol', description: 'Frontier model' },
      { id: 'deepseek/deepseek-v4-pro', name: 'DeepSeek: DeepSeek V4 Pro' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    models: [{ id: 'claude-opus-5', name: 'Claude Opus 5' }],
  },
]

describe('model selector search', () => {
  it('matches model display names and ids case-insensitively', () => {
    expect(filterModelGroups(groups, 'GPT-5.6')).toEqual([{ ...groups[0], models: [groups[0]!.models[0]] }])
    expect(filterModelGroups(groups, 'deepseek-v4-pro')).toEqual([{ ...groups[0], models: [groups[0]!.models[1]] }])
  })

  it('matches provider names and ids and retains the whole provider group', () => {
    expect(filterModelGroups(groups, 'anthropic')).toEqual([groups[1]])
    expect(filterModelGroups(groups, 'zenmux-models')).toEqual([groups[0]])
  })

  it('returns no groups when no model or provider matches', () => {
    expect(filterModelGroups(groups, 'not-a-model')).toEqual([])
  })
})
