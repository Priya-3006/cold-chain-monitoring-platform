# Physical Hardware Deployment Guide
## ESP32 + DS18B20 + DHT22 + NEO-6M GPS + MQTT Integration

This document outlines how physical microcontrollers and sensors directly replace the software-based IoT simulator in production environments.

---

## 1. Hardware Bill of Materials (BOM)
| Component | Function | Operating Range | Interface |
|---|---|---|---|
| **ESP32-WROOM-32D** | Primary IoT Gateway & Edge Controller | -40°C to +85°C | Wi-Fi 802.11 b/g/n + BLE 4.2 |
| **DS18B20 (Waterproof Probe)** | Core Thermal Vaccine Probe | -55°C to +125°C (±0.5°C accuracy) | 1-Wire Digital Bus |
| **DHT22 (AM2302)** | Secondary Ambient Humidity & Temp Probe | 0–100% RH (±2%), -40°C to +80°C | Single-Bus Digital |
| **u-blox NEO-6M GPS** | Real-Time Transport Geolocation | 50-channel GPS L1 C/A | Hardware UART (9600 baud) |
| **Magnetic Reed Switch** | Door Latch Proximity Sensor | N/O Dry Contact | Digital GPIO with Pull-Up |
| **TP4056 + 18650 Li-Ion** | Emergency Power & Battery Voltage Divider | 3.7V 3000mAh | Analog ADC (GPIO 34) |

---

## 2. Wiring & Pinout Schematic

```
ESP32 DevKit V1 Pinout Mapping:
==============================================================
Pin             Component Connected             Wiring Notes
--------------------------------------------------------------
3V3 / VIN  ---> VCC of Sensors & GPS            3.3V or 5V
GND        ---> Common Ground Bus               All grounds tied
GPIO 4     ---> DS18B20 Data (Yellow)           4.7kΩ Pull-Up to 3.3V
GPIO 15    ---> DHT22 Data                      10kΩ Pull-Up to 3.3V
GPIO 14    ---> Reed Door Switch (Terminal 1)   Terminal 2 to GND (INPUT_PULLUP)
GPIO 16    ---> GPS Module TX                   ESP32 RX2
GPIO 17    ---> GPS Module RX                   ESP32 TX2
GPIO 34    ---> Battery Voltage Divider         Analog In (R1=100k, R2=100k)
```

---

## 3. MQTT Broker Architecture & Topic Structure

### Broker Specification
- **Broker Software**: Eclipse Mosquitto or HiveMQ Enterprise
- **Security**: TLS 1.3 (Port 8883) with X.509 client certificate authentication
- **Quality of Service**: QoS 1 (At least once delivery) with persistent sessions

### Topic Hierarchy
```
coldchain/
  ├── telemetry/
  │     └── {container_id}       <- Telemetry data every 5-10s
  ├── door/
  │     └── {container_id}       <- Immediate interrupt on OPEN/CLOSED
  ├── gps/
  │     └── {vehicle_id}         <- Coordinate breadcrumb every 10s
  └── alerts/
        └── {container_id}       <- Edge-triggered threshold alerts
```

---

## 4. Telemetry JSON Payload Schema

Published by ESP32 to `coldchain/telemetry/cnt-c015`:
```json
{
  "containerId": "cnt-c015",
  "containerCode": "C015",
  "temperature": 4.62,
  "humidity": 48.5,
  "doorStatus": "CLOSED",
  "powerStatus": "MAINS_POWER",
  "batteryPct": 94,
  "secondaryTemp": 4.75,
  "gps": {
    "latitude": 13.006721,
    "longitude": 80.202345,
    "speedKmh": 0.0,
    "satellites": 9
  },
  "sensorStatus": {
    "ds18b20": "HEALTHY",
    "dht22": "HEALTHY",
    "reedSwitch": "HEALTHY"
  },
  "firmwareVersion": "v2.4.1",
  "timestamp": 1790681727
}
```

---

## 5. ESP32 Arduino C++ Firmware Template

```cpp
#include <WiFi.h>
#include <PubSubClient.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <DHT.h>
#include <TinyGPS++.h>

#define ONE_WIRE_BUS 4
#define DHTPIN 15
#define DHTTYPE DHT22
#define REED_PIN 14
#define BATTERY_PIN 34

OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature ds18b20(&oneWire);
DHT dht(DHTPIN, DHTTYPE);
TinyGPSPlus gps;
HardwareSerial SerialGPS(2);

WiFiClientSecure espClient;
PubSubClient client(espClient);

const char* ssid = "COLDCHAIN_DEPOT_WIFI";
const char* password = "DepotSecurePassword2026";
const char* mqtt_server = "broker.coldchain-iot.internal";
const char* containerId = "cnt-c015";

void setup() {
  Serial.begin(115200);
  SerialGPS.begin(9600, SERIAL_8N1, 16, 17);
  
  pinMode(REED_PIN, INPUT_PULLUP);
  ds18b20.begin();
  dht.begin();
  
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
  }
  
  client.setServer(mqtt_server, 8883);
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  // Read sensors
  ds18b20.requestTemperatures();
  float coreTemp = ds18b20.getTempCByIndex(0);
  float humidity = dht.readHumidity();
  bool isDoorOpen = digitalRead(REED_PIN) == HIGH;
  
  // Format JSON payload
  char payload[256];
  snprintf(payload, sizeof(payload),
    "{\"containerId\":\"%s\",\"temperature\":%.2f,\"humidity\":%.1f,\"doorStatus\":\"%s\",\"batteryPct\":94}",
    containerId, coreTemp, humidity, isDoorOpen ? "OPEN" : "CLOSED"
  );
  
  client.publish("coldchain/telemetry/cnt-c015", payload);
  delay(4000); // 4-second telemetry interval
}
```

---

## 6. Backend MQTT Ingestion Adapter
To swap out the simulator with MQTT on the backend:
1. Install `mqtt` client in Node.js: `npm install mqtt`.
2. Connect to the MQTT broker and subscribe to `coldchain/telemetry/#`.
3. Route incoming messages into the existing `temperature_logs` database and call `triggerAlert()` directly.
4. Broadcast payloads over WebSocket `/ws` into the React dashboard.
