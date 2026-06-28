import type { Rule } from './rule.types.ts'

export const STORAGE_KEY = 'gqlmock:rules'

export async function getRules(): Promise<Rule[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY)

  return (result[STORAGE_KEY] as Rule[] | undefined) ?? []
}

export async function setRules(rules: Rule[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: rules })
}

export function onRulesChanged(callback: (rules: Rule[]) => void): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ): void => {
    if (areaName !== 'local') {
      return
    }

    const change = changes[STORAGE_KEY]

    if (!change) {
      return
    }

    callback((change.newValue as Rule[] | undefined) ?? [])
  }

  chrome.storage.onChanged.addListener(listener)

  return () => {
    chrome.storage.onChanged.removeListener(listener)
  }
}
