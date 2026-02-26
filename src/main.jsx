import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/index.css'

// 错误边界组件 - 捕获渲染错误并提供恢复选项
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
    console.error('🚨 应用崩溃:', error, errorInfo);
  }

  handleClearAndReload = () => {
    // 清除所有本地存储数据
    try {
      localStorage.clear();
      console.log('🗑️ 已清除所有本地数据');
    } catch (e) {
      console.error('清除失败:', e);
    }
    // 重新加载页面
    window.location.reload();
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: '#1a1a2e',
          color: 'white',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{
            maxWidth: '600px',
            textAlign: 'center'
          }}>
            <h1 style={{ fontSize: '24px', marginBottom: '16px', color: '#ff6b6b' }}>
              ⚠️ 应用加载错误
            </h1>
            <p style={{ marginBottom: '24px', color: '#a0a0a0' }}>
              应用在加载保存的数据时遇到问题。这可能是由于数据格式不兼容或数据损坏导致的。
            </p>

            <div style={{
              backgroundColor: '#0d0d1a',
              padding: '16px',
              borderRadius: '8px',
              marginBottom: '24px',
              textAlign: 'left',
              maxHeight: '200px',
              overflow: 'auto'
            }}>
              <p style={{ color: '#ff6b6b', fontSize: '12px', fontFamily: 'monospace' }}>
                {this.state.error && this.state.error.toString()}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
              <button
                onClick={this.handleReload}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#333',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                🔄 重试
              </button>
              <button
                onClick={this.handleClearAndReload}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                🗑️ 清除数据并重新开始
              </button>
            </div>

            <p style={{ marginTop: '24px', fontSize: '12px', color: '#666' }}>
              点击"清除数据并重新开始"将会删除所有保存的场景数据，应用将恢复到初始状态。
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
