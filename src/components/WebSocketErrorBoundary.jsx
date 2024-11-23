import React from 'react';
import { Alert, AlertIcon, AlertTitle, AlertDescription } from '@chakra-ui/react';

class WebSocketErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('WebSocket Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Alert status="error">
          <AlertIcon />
          <AlertTitle>Connection Error</AlertTitle>
          <AlertDescription>
            Failed to establish real-time connection. Please refresh the page.
          </AlertDescription>
        </Alert>
      );
    }

    return this.props.children;
  }
}

export default WebSocketErrorBoundary; 