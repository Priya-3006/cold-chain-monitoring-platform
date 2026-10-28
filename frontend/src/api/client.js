const API_BASE = 'https://cold-chain-monitoring-platform-0496.onrender.com/api';

/**

* Enhanced fetch wrapper with JWT authentication and JSON handling
  */
  export async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('coldchain_token');
  const headers = {
  ...options.headers
  };

if (!(options.body instanceof FormData)) {
headers['Content-Type'] = 'application/json';
}

if (token) {
headers['Authorization'] = `Bearer ${token}`;
}

const response = await fetch(`${API_BASE}${endpoint}`, {
...options,
headers
});

const data = await response.json().catch(() => ({}));

if (!response.ok) {
const errorMsg = data.error || (response.status === 500
? 'Backend API server error or database connection failed.'
: `HTTP ${response.status}: Request failed`);
throw new Error(errorMsg);
}

return data;
}

// Auth API
export const authApi = {
login: (identifier, password) => apiFetch('/auth/login', {
method: 'POST',
body: JSON.stringify({ identifier, password })
}),
getMe: () => apiFetch('/auth/me'),
getDemoUsers: () => apiFetch('/auth/demo-users')
};

// Admin API
export const adminApi = {
getUsers: () => apiFetch('/admin/users'),
createUser: (userData) => apiFetch('/admin/users', { method: 'POST', body: JSON.stringify(userData) }),
toggleUserStatus: (id, isActive) => apiFetch(`/admin/users/${id}/status`, { method: 'PUT', body: JSON.stringify({ isActive }) }),
getVaccines: () => apiFetch('/admin/vaccines'),
createVaccine: (vaccineData) => apiFetch('/admin/vaccines', { method: 'POST', body: JSON.stringify(vaccineData) }),
getContainers: () => apiFetch('/admin/containers'),
getLocations: () => apiFetch('/admin/locations'),
getSops: () => apiFetch('/admin/sops'),
getVehicles: () => apiFetch('/admin/vehicles')
};

// Warehouse API
export const warehouseApi = {
getTasks: () => apiFetch('/warehouse/tasks'),
scanVaccine: (shipmentId, scannedCode) => apiFetch('/warehouse/scan-vaccine', {
method: 'POST',
body: JSON.stringify({ shipmentId, scannedCode })
}),
scanContainer: (shipmentId, scannedCode) => apiFetch('/warehouse/scan-container', {
method: 'POST',
body: JSON.stringify({ shipmentId, scannedCode })
}),
verifyPutAway: (shipmentId, scannedLocationCode, expectedLocationId) => apiFetch('/warehouse/put-away', {
method: 'POST',
body: JSON.stringify({ shipmentId, scannedLocationCode, expectedLocationId })
}),
updateChecklist: (shipmentId, itemKey, passed, notes) => apiFetch('/warehouse/checklist-item', {
method: 'POST',
body: JSON.stringify({ shipmentId, itemKey, passed, notes })
}),
getScanEvents: () => apiFetch('/warehouse/scan-events'),
getContainerTree: (containerId) => apiFetch(`/warehouse/container-tree/${containerId}`)
};

// Monitoring API
export const monitoringApi = {
getOverview: () => apiFetch('/monitoring/overview'),
getHistory: (entityId, limit = 40) => apiFetch(`/monitoring/telemetry-history/${entityId}?limit=${limit}`)
};

// Alert API
export const alertApi = {
getAlerts: (params = {}) => {
const query = new URLSearchParams(params).toString();
return apiFetch(`/alerts${query ? `?${query}` : ''}`);
},
getAlertDetails: (id) => apiFetch(`/alerts/${id}/details`),
acknowledge: (id) => apiFetch(`/alerts/${id}/acknowledge`, { method: 'POST' }),
recordAction: (id, payload) => apiFetch(`/alerts/${id}/action`, {
method: 'POST',
body: JSON.stringify(payload)
}),
resolve: (id, notes) => apiFetch(`/alerts/${id}/resolve`, {
method: 'POST',
body: JSON.stringify({ notes })
}),
submitExcursionDecision: (id, payload) => apiFetch(`/alerts/${id}/excursion-decision`, {
method: 'POST',
body: JSON.stringify(payload)
})
};

// Shipment API
export const shipmentApi = {
getShipments: () => apiFetch('/shipments'),
getShipmentById: (id) => apiFetch(`/shipments/${id}`),
verifyDoor: (id, proofFileId) => apiFetch(`/shipments/${id}/verify-door`, {
method: 'POST',
body: JSON.stringify({ proofFileId })
}),
dispatch: (id) => apiFetch(`/shipments/${id}/dispatch`, { method: 'POST' }),
submitDeliveryProof: (id, payload) => apiFetch(`/shipments/${id}/delivery-proof`, {
method: 'POST',
body: JSON.stringify(payload)
}),
recordHospitalDecision: (id, decision, rejectionReason) => apiFetch(`/shipments/${id}/hospital-decision`, {
method: 'POST',
body: JSON.stringify({ decision, rejectionReason })
}),
publicVerify: (query) => apiFetch(`/shipments/public-verify/${query}`)
};

// Traceability API
export const traceabilityApi = {
getAuditLogs: (limit = 100) => apiFetch(`/traceability/audit-logs?limit=${limit}`),
verifyIntegrity: () => apiFetch('/traceability/verify-integrity'),
recallBatch: (batchNumber) => apiFetch(`/traceability/recall/${batchNumber}`),
getComplianceReport: (shipmentId) => apiFetch(`/traceability/compliance-report/${shipmentId}`)
};

// Simulator API
export const simulatorApi = {
getStatus: () => apiFetch('/simulator/status'),
injectTempSpike: (containerId, targetTemp) => apiFetch('/simulator/temp-spike', { method: 'POST', body: JSON.stringify({ containerId, targetTemp }) }),
injectDoorOpen: (containerId, isOpen) => apiFetch('/simulator/door-open', { method: 'POST', body: JSON.stringify({ containerId, isOpen }) }),
injectPowerCut: (containerId, hasCut) => apiFetch('/simulator/power-cut', { method: 'POST', body: JSON.stringify({ containerId, hasCut }) }),
injectLowBattery: (containerId, pct) => apiFetch('/simulator/low-battery', { method: 'POST', body: JSON.stringify({ containerId, pct }) }),
injectSensorOffline: (containerId, isOffline) => apiFetch('/simulator/sensor-offline', { method: 'POST', body: JSON.stringify({ containerId, isOffline }) }),
injectRouteDeviation: (shipmentId, isDeviated) => apiFetch('/simulator/route-deviation', { method: 'POST', body: JSON.stringify({ shipmentId, isDeviated }) }),
injectTransportDelay: (shipmentId, extraMinutes) => apiFetch('/simulator/transport-delay', { method: 'POST', body: JSON.stringify({ shipmentId, extraMinutes }) }),
reset: () => apiFetch('/simulator/reset', { method: 'POST' })
};

// AI API
export const aiApi = {
sendQuery: (query, language = 'en') => apiFetch('/ai/chat', {
method: 'POST',
body: JSON.stringify({ query, language })
})
};

// Upload API
export const uploadApi = {
uploadProofPhoto: (payload) => apiFetch('/upload/photo', {
method: 'POST',
body: JSON.stringify(payload)
})
};
