#!/usr/bin/env python3
"""
Smart Home Laptop Controller
============================
Control your phone's flashlight and smart home appliances directly
from your laptop via MQTT or through a local Web Dashboard!

Usage:
  python laptop_controller.py           # Interactive terminal control & web server
  python laptop_controller.py on        # Immediately turn phone flashlight ON
  python laptop_controller.py off       # Immediately turn phone flashlight OFF
  python laptop_controller.py toggle    # Toggle phone flashlight
  python laptop_controller.py strobe    # Blink phone flashlight 5 times
"""

import sys
import time
import json
import threading
import webbrowser
from http.server import HTTPServer, BaseHTTPRequestHandler
import paho.mqtt.client as mqtt

# Ensure Windows UTF-8 stdout encoding
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

MQTT_BROKER = "broker.emqx.io"
MQTT_PORT = 1883
TORCH_CMD_TOPIC = "home/living_room/torch/set"
TORCH_STATE_TOPIC = "home/living_room/torch/state"

current_torch_state = False
received_sensors = {"temp": 24.2, "humidity": 50, "motion": False}

# Setup MQTT Client
try:
    client = mqtt.Client(
        callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
        client_id=f"laptop_ctrl_{int(time.time())}"
    )
except (AttributeError, TypeError):
    client = mqtt.Client(client_id=f"laptop_ctrl_{int(time.time())}")


def on_connect(c, userdata, flags, rc, properties=None):
    rc_code = rc.value if hasattr(rc, "value") else rc
    if rc_code == 0:
        c.subscribe(TORCH_STATE_TOPIC)
        c.subscribe("home/sensors/#")
        c.subscribe("home/+/+/state")


def on_message(c, userdata, msg):
    global current_torch_state, received_sensors
    topic = msg.topic
    payload = msg.payload.decode("utf-8", errors="ignore")
    try:
        data = json.loads(payload)
    except Exception:
        data = payload

    if topic == TORCH_STATE_TOPIC:
        if isinstance(data, dict):
            current_torch_state = str(data.get("state", "")).upper() == "ON"
        else:
            current_torch_state = str(data).upper() == "ON"

    elif "temperature" in topic:
        if isinstance(data, dict):
            received_sensors["temp"] = data.get("value", received_sensors["temp"])
    elif "humidity" in topic:
        if isinstance(data, dict):
            received_sensors["humidity"] = data.get("value", received_sensors["humidity"])
    elif "motion" in topic:
        if isinstance(data, dict):
            received_sensors["motion"] = data.get("motion_detected", False)


client.on_connect = on_connect
client.on_message = on_message


def connect_mqtt():
    try:
        client.connect(MQTT_BROKER, MQTT_PORT, 60)
        client.loop_start()
        time.sleep(0.5)
        return True
    except Exception as e:
        print(f"[!] Could not connect to MQTT broker ({MQTT_BROKER}): {e}")
        return False


def set_torch(state: bool):
    global current_torch_state
    current_torch_state = state
    payload = json.dumps({"state": "ON" if state else "OFF", "brightness": 100, "sender": "laptop"})
    client.publish(TORCH_CMD_TOPIC, payload, qos=1)
    client.publish("home/torch/set", payload, qos=1)
    print(f"\n[>>] Sent command to Phone Flashlight: {'[ON]' if state else '[OFF]'}")


def strobe_torch(count=5, delay=0.4):
    print(f"\n[>>] Strobe mode: blinking {count} times...")
    for i in range(count):
        set_torch(True)
        time.sleep(delay)
        set_torch(False)
        time.sleep(delay)


def set_all(state: bool):
    payload = json.dumps({"state": "ON" if state else "OFF", "sender": "laptop"})
    topics = [
        TORCH_CMD_TOPIC,
        "home/living_room/light/set",
        "home/bedroom/light/set",
        "home/kitchen/light/set",
        "home/living_room/plug/set",
        "home/living_room/fan/set",
    ]
    for t in topics:
        client.publish(t, payload, qos=1)
    print(f"\n[>>] Broadcast {'[ALL ON]' if state else '[ALL OFF]'} to all devices.")


# Web Dashboard Handler
class DashboardHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # Suppress console logging for web requests

    def do_GET(self):
        if self.path == "/api/status":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            resp = {
                "torch": current_torch_state,
                "sensors": received_sensors,
            }
            self.wfile.write(json.dumps(resp).encode("utf-8"))
            return

        if self.path.startswith("/api/torch/"):
            action = self.path.split("/")[-1].lower()
            if action == "on":
                set_torch(True)
            elif action == "off":
                set_torch(False)
            elif action == "toggle":
                set_torch(not current_torch_state)
            elif action == "strobe":
                threading.Thread(target=strobe_torch).start()

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"torch": current_torch_state}).encode("utf-8"))
            return

        # Render HTML UI
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()

        html = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Smart Home - Laptop Control Hub</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    body { background-color: #0F172A; color: #F8FAFC; display: flex; justify-content: center; padding: 24px 16px; }
    .container { width: 100%; max-width: 520px; }
    .header { text-align: center; margin-bottom: 24px; }
    .title { font-size: 26px; font-weight: 800; color: #F8FAFC; }
    .subtitle { font-size: 13px; color: #94A3B8; margin-top: 4px; }
    .status-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; background: #1E293B; border-radius: 20px; font-size: 12px; font-weight: 600; color: #10B981; margin-top: 10px; border: 1px solid #334155; }
    .dot { width: 8px; height: 8px; border-radius: 5px; background: #10B981; }

    .main-card { background: #1E293B; border: 1px solid #334155; border-radius: 20px; padding: 24px; text-align: center; margin-bottom: 20px; }
    .torch-icon { font-size: 60px; margin-bottom: 12px; }
    .torch-btn { width: 100%; padding: 18px; border-radius: 16px; border: none; font-size: 18px; font-weight: 700; cursor: pointer; transition: 0.2s; display: flex; align-items: center; justify-content: center; gap: 10px; }
    .torch-btn.off { background: #38BDF8; color: #0F172A; }
    .torch-btn.on { background: #EF4444; color: #FFFFFF; }
    .strobe-btn { margin-top: 12px; width: 100%; padding: 12px; border-radius: 12px; background: #334155; border: 1px solid #475569; color: #F8FAFC; font-weight: 600; cursor: pointer; }

    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
    .btn-secondary { background: #1E293B; border: 1px solid #334155; color: #F8FAFC; padding: 14px; border-radius: 14px; font-size: 14px; font-weight: 600; cursor: pointer; text-align: center; }
    .btn-secondary:hover { background: #334155; }

    .sensors-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
    .sensor-card { background: #1E293B; border: 1px solid #334155; border-radius: 14px; padding: 16px; text-align: center; }
    .sensor-val { font-size: 24px; font-weight: 800; color: #F8FAFC; }
    .sensor-lbl { font-size: 12px; color: #94A3B8; margin-top: 4px; }
    .footer { text-align: center; font-size: 12px; color: #64748B; margin-top: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="title">🏠 Smart Home Laptop Hub</h1>
      <p class="subtitle">Controlling Phone Flashlight & Appliances via MQTT</p>
      <div class="status-badge"><span class="dot"></span> Online via broker.emqx.io</div>
    </div>

    <!-- Phone Flashlight Control Card -->
    <div class="main-card">
      <div id="torchIcon" class="torch-icon">🔦</div>
      <h2 style="font-size: 20px; margin-bottom: 6px;">Mobile Flashlight</h2>
      <p id="torchStatusText" style="font-size: 14px; color: #94A3B8; margin-bottom: 20px;">Ready to toggle</p>
      
      <button id="torchBtn" class="torch-btn off" onclick="toggleTorch()">
        Turn Flashlight ON
      </button>

      <button class="strobe-btn" onclick="strobeTorch()">
        🚨 Strobe / Blink 5 Times
      </button>
    </div>

    <!-- Quick Controls -->
    <div class="grid">
      <button class="btn-secondary" onclick="setAll(true)">💡 Turn ALL Lights ON</button>
      <button class="btn-secondary" onclick="setAll(false)">🔌 Turn ALL Devices OFF</button>
    </div>

    <!-- Live Sensors -->
    <div class="sensors-row">
      <div class="sensor-card">
        <div id="tempVal" class="sensor-val">24.2°C</div>
        <div class="sensor-lbl">🌡️ Ambient Temp</div>
      </div>
      <div class="sensor-card">
        <div id="humVal" class="sensor-val">50%</div>
        <div class="sensor-lbl">💧 Humidity</div>
      </div>
    </div>

    <div class="footer">
      Keep Expo App open on your phone with "Mobile Flashlight" toggle enabled.
    </div>
  </div>

  <script>
    let torchState = false;

    async function toggleTorch() {
      const next = !torchState;
      const res = await fetch('/api/torch/' + (next ? 'on' : 'off'));
      const data = await res.json();
      updateUI(next);
    }

    async function strobeTorch() {
      await fetch('/api/torch/strobe');
    }

    async function setAll(on) {
      // triggers backend all
      const res = await fetch('/api/torch/' + (on ? 'on' : 'off'));
      updateUI(on);
    }

    function updateUI(isLit) {
      torchState = isLit;
      const btn = document.getElementById('torchBtn');
      const text = document.getElementById('torchStatusText');
      const icon = document.getElementById('torchIcon');
      if (isLit) {
        btn.className = 'torch-btn on';
        btn.innerText = 'Turn Flashlight OFF';
        text.innerText = '⚡ FLASHLIGHT IS CURRENTLY ON';
        text.style.color = '#38BDF8';
        icon.innerText = '💡';
      } else {
        btn.className = 'torch-btn off';
        btn.innerText = 'Turn Flashlight ON';
        text.innerText = '🌑 FLASHLIGHT IS CURRENTLY OFF';
        text.style.color = '#94A3B8';
        icon.innerText = '🔦';
      }
    }

    // Poll status & sensors
    setInterval(async () => {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        if (data.sensors) {
          if (data.sensors.temp) document.getElementById('tempVal').innerText = Number(data.sensors.temp).toFixed(1) + '°C';
          if (data.sensors.humidity) document.getElementById('humVal').innerText = Number(data.sensors.humidity).toFixed(0) + '%';
        }
      } catch(e) {}
    }, 2000);
  </script>
</body>
</html>"""
        self.wfile.write(html.encode("utf-8"))


def start_web_server(port=5000):
    server = HTTPServer(("0.0.0.0", port), DashboardHandler)
    server.serve_forever()


def main():
    if not connect_mqtt():
        print("[!] MQTT Connection failed. Please check your internet/broker.")
        sys.exit(1)

    # CLI one-shot arguments
    if len(sys.argv) > 1:
        cmd = sys.argv[1].lower()
        if cmd in ("on", "1", "true"):
            set_torch(True)
            time.sleep(1)
            sys.exit(0)
        elif cmd in ("off", "0", "false"):
            set_torch(False)
            time.sleep(1)
            sys.exit(0)
        elif cmd in ("toggle", "t"):
            set_torch(not current_torch_state)
            time.sleep(1)
            sys.exit(0)
        elif cmd in ("strobe", "s"):
            strobe_torch()
            time.sleep(1)
            sys.exit(0)

    # Start background local web dashboard on port 5000
    web_thread = threading.Thread(target=start_web_server, args=(5000,), daemon=True)
    web_thread.start()

    print("\n========================================================")
    print("        🏠 SMART HOME - LAPTOP CONTROLLER HUB           ")
    print("========================================================")
    print(f"Connected to MQTT Broker: {MQTT_BROKER}:{MQTT_PORT}")
    print("🌐 Laptop Web Dashboard ready at: http://localhost:5000")
    print("--------------------------------------------------------")
    print("Keyboard Shortcuts:")
    print("  [1] Turn Mobile Flashlight ON")
    print("  [2] Turn Mobile Flashlight OFF")
    print("  [3] Toggle Flashlight")
    print("  [4] Strobe (Blink 5 times)")
    print("  [5] Turn ALL Lights ON")
    print("  [6] Turn ALL Devices OFF")
    print("  [w] Open Web Dashboard in Browser")
    print("  [q] Quit")
    print("========================================================\n")

    try:
        while True:
            choice = input("Enter option [1-6, w, q]: ").strip().lower()
            if choice == "1":
                set_torch(True)
            elif choice == "2":
                set_torch(False)
            elif choice == "3":
                set_torch(not current_torch_state)
            elif choice == "4":
                strobe_torch()
            elif choice == "5":
                set_all(True)
            elif choice == "6":
                set_all(False)
            elif choice == "w":
                webbrowser.open("http://localhost:5000")
                print("[*] Opened http://localhost:5000 in your browser.")
            elif choice == "q":
                print("Exiting controller...")
                break
    except (KeyboardInterrupt, EOFError):
        print("\nExiting controller...")
    finally:
        client.loop_stop()
        client.disconnect()


if __name__ == "__main__":
    main()
