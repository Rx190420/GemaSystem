import { Component } from 'react'
import ServerError from '../pages/errors/ServerError'

// Class component because React's error-boundary hook (getDerivedStateFromError /
// componentDidCatch) has no function-component equivalent yet.
export default class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('Uncaught render error:', error, info)
  }

  render() {
    if (this.state.hasError) return <ServerError />
    return this.props.children
  }
}
