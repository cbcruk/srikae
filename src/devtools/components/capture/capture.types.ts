export interface CapturedOperation {
  operationName: string
  variables?: Record<string, unknown>
}

export interface CapturedRequest extends CapturedOperation {
  id: string
  url: string
  entry: chrome.devtools.network.Request
}
