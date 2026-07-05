import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-3 bg-neutral-50 p-6 text-center dark:bg-neutral-950">
          <p className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            문제가 발생했어요
          </p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{this.state.error.message}</p>
          <button
            onClick={() => location.reload()}
            className="rounded-full bg-purple-600 px-4 py-2 text-sm font-medium text-white"
          >
            새로고침
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
