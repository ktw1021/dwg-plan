/**
 * Socket.IO 컨텍스트
 * 실시간 통신을 위한 Socket.IO 클라이언트 관리
 */

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

// Socket.IO 서버 URL 설정
const SOCKET_SERVER_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Socket 컨텍스트 생성
const SocketContext = createContext(null);

/**
 * Socket 컨텍스트 훅
 * @returns {Object} Socket.IO 인스턴스
 */
export const useSocket = () => useContext(SocketContext);

/**
 * Socket 프로바이더 컴포넌트
 * Socket.IO 연결을 관리하고 자식 컴포넌트에 제공
 */
export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  useEffect(() => {
    console.log('SocketProvider: Initializing connection to', SOCKET_SERVER_URL);

    // Socket.IO 연결 초기화
    const socketInstance = io(SOCKET_SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      autoConnect: true
    });

    // 연결 이벤트 핸들러
    socketInstance.on('connect', () => {
      console.log('SocketProvider: Connected to server', {
        id: socketInstance.id,
        connected: socketInstance.connected
      });
      reconnectAttempts.current = 0;
    });

    socketInstance.on('connect_error', (error) => {
      console.error('SocketProvider: Connection error', {
        message: error.message,
        description: error.description,
        attempt: reconnectAttempts.current + 1
      });
      
      reconnectAttempts.current += 1;
      if (reconnectAttempts.current >= maxReconnectAttempts) {
        console.error('SocketProvider: Max reconnection attempts reached');
        socketInstance.disconnect();
      }
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('SocketProvider: Disconnected from server', { 
        reason,
        willReconnect: reason === 'io server disconnect' ? false : true
      });

      // 서버에서 연결을 끊은 경우가 아니라면 재연결 시도
      if (reason === 'io server disconnect') {
        socketInstance.connect();
      }
    });

    // Socket 인스턴스 저장
    setSocket(socketInstance);
    console.log('SocketProvider: Socket instance created');

    // 컴포넌트 언마운트 시 연결 해제
    return () => {
      if (socketInstance) {
        console.log('SocketProvider: Cleaning up socket connection');
        socketInstance.removeAllListeners();
        socketInstance.disconnect();
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