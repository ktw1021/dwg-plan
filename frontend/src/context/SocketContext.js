/**
 * Socket.IO 컨텍스트
 * 실시간 통신을 위한 Socket.IO 클라이언트 관리
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

// Socket.IO 서버 URL 설정
const SOCKET_SERVER_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Socket 컨텍스트 생성
const SocketContext = createContext(null);

/**
 * Socket 컨텍스트 훅
 * @returns {Object} Socket.IO 인스턴스
 */
export const useSocket = () => {
  const socket = useContext(SocketContext);
  if (!socket) {
    console.warn('Socket context not available');
    return null;
  }
  return socket;
};

/**
 * Socket 프로바이더 컴포넌트
 * Socket.IO 연결을 관리하고 자식 컴포넌트에 제공
 */
export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const newSocket = io(SOCKET_SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      timeout: 10000
    });

    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    setSocket(newSocket);

    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, []);

  // 소켓이 없거나 연결되지 않은 경우에도 children을 렌더링
  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}; 