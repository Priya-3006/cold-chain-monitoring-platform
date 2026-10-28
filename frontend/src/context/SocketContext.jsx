import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

const SocketContext = createContext();

const WS_URL = 'wss://cold-chain-monitoring-platform-0496.onrender.com/ws';

export function SocketProvider({ children }) {
const [isConnected, setIsConnected] = useState(false);
const [latestTick, setLatestTick] = useState(null);
const [containerMap, setContainerMap] = useState({});
const [vehicleMap, setVehicleMap] = useState({});
const [lastAlertEvent, setLastAlertEvent] = useState(null);
const wsRef = useRef(null);

useEffect(() => {
let reconnectTimeout = null;
let disposed = false;

```
function connect() {
  if (disposed) return;

  try {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'TELEMETRY_TICK') {
          setLatestTick(data);

          if (data.containers) {
            setContainerMap(prev => {
              const updated = { ...prev };
              for (const c of data.containers) {
                updated[c.containerId] = c;
              }
              return updated;
            });
          }

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
      } catch (error) {
        // Ignore invalid JSON messages.
      }
    };

    ws.onclose = () => {
      setIsConnected(false);

      if (!disposed) {
        reconnectTimeout = setTimeout(connect, 5000);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  } catch (error) {
    if (!disposed) {
      reconnectTimeout = setTimeout(connect, 5000);
    }
  }
}

connect();

return () => {
  disposed = true;

  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
  }

  if (wsRef.current) {
    wsRef.current.close();
  }
};
```

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
