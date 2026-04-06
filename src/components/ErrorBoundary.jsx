import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const { title = 'Произошла ошибка', fullPage = false } = this.props;

    const content = (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7 text-red-500" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">{title}</h2>
          <p className="text-sm text-gray-500 max-w-sm">
            {this.state.error?.message || 'Неожиданная ошибка. Попробуйте обновить страницу.'}
          </p>
        </div>
        <button
          onClick={() => this.setState({ hasError: false, error: null })}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <RefreshCw size={15} />
          Попробовать снова
        </button>
      </div>
    );

    if (fullPage) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          {content}
        </div>
      );
    }

    return <div className="card">{content}</div>;
  }
}
