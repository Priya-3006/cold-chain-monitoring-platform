import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

const SocketContext = createContext();

export function SocketProvider({ children }) {
  const [isConnected, setIsConnected] = useState(false);
  const [latestTick, setLatestTick] = useState(null);
  const [containerMap, setContainerMap] = useState({});
  const [vehicleMap, setVehicleMap] = useState({});
  const [lastAlertEvent, setLastAlertEvent] = useState(null);
  const wsRef = useRef(null);

  useEffect(() => {
    let reconnectTimeout = null;

    function connect() {
      // Connect to WebSocket using current host (works through Vite proxy or direct)
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.hostname}:5000/ws`;

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setIsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'TELEMETRY_TICK') {
              setLatestTick(data);

              // Update container map
              if (data.containers) {
                setContainerMap(prev => {
                  const updated = { ...prev };
                  for (const c of data.containers) {
                    updated[c.containerId] = c;
                  }
                  return updated;
                });
              }

              // Update vehicle map
              if (data.vehicles) {
                setVehicleMap(prev => {
                  const updated = { ...prev };
                  for (const v of data.vehicles) {
                    updated[v.shipmentId || v.vehicleId] = v;
                  }
                  return updated;
                });
              }
            } else if (data.type === 'ALERT_ESCALATED') {
              setLastAlertEvent(data);
            }
          } catch (e) {
            // Ignore non-json
          }
        };

        ws.onclose = () => {
          setIsConnected(false);
          reconnectTimeout = setTimeout(connect, 3000);
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch (err) {
        reconnectTimeout = setTimeout(connect, 3000);
      }
    }

    connect();

    return () => {
      if (wsRef.current) wsRef.current.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  return (
    <SocketContext.Provider value={{
      isConnected,
      latestTick,
      containerMap,
      vehicleMap,
      lastAlertEvent
    }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
