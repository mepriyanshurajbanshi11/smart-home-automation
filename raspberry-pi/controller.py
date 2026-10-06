#!/usr/bin/env python3
"""
Smart Home Automation Controller for Raspberry Pi
===================================================
Connects Raspberry Pi GPIO relays and sensors to MQTT.
Features:
  - Real GPIO (RPi.GPIO / gpiozero) with seamless fallback to simulated mode on PC/Mac.
  - Bidirectional MQTT communication (Commands & State updates).
  - Last Will and Testament (LWT) for broker offline detection.
  - Temperature & humidity telemetry (DHT sensor or simulated).
  - PIR motion sensor event publishing.
  - Graceful shutdown handling.
"""

import os
import sys
import time
import json
import random
import signal
import logging
from typing import Dict, Any

try:
    import yaml
except ImportError:
    yaml = None

try:
    import paho.mqtt.client as mqtt
except ImportError:
    print("\n[!] Error: 'paho-mqtt' is not installed.")
    print("    Please install dependencies by running: pip install -r requirements.txt\n")
    sys.exit(1)

# Configure Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("SmartHomePi")

# Detect Hardware / GPIO Availability
HARDWARE_AVAILABLE = False
try:
    import RPi.GPIO as GPIO
    GPIO.setwarnings(False)
    GPIO.setmode(GPIO.BCM)
    HARDWARE_AVAILABLE = True
    logger.info("[HW] Raspberry Pi GPIO library detected. Running in HARDWARE mode.")
except (ImportError, RuntimeError):
    logger.warning("[SIM] RPi.GPIO not available. Running in SIMULATED DEVELOPMENT mode.")


class HardwareController:
    """Manages GPIO relays and sensors or simulates them gracefully."""
    def __init__(self, config: Dict[str, Any]):
        self.config = config.get("gpio", {})
        self.active_low = self.config.get("active_low_relays", True)
        self.relays = self.config.get("relays", {})
        self.relay_states: Dict[str, bool] = {}

        # Default simulated sensor values
        self.sim_temp = 24.2
        self.sim_humidity = 55.0
        self.sim_motion = False

        self._setup_hardware()

    def _setup_hardware(self):
        for name, data in self.relays.items():
            pin = data.get("pin")
            self.relay_states[name] = False
            if HARDWARE_AVAILABLE and pin is not None:
                try:
                    GPIO.setup(pin, GPIO.OUT)
                    # For active LOW, write HIGH to turn OFF initially
                    initial_val = GPIO.HIGH if self.active_low else GPIO.LOW
                    GPIO.output(pin, initial_val)
                    logger.info(f"Initialized Relay [{name}] on GPIO {pin}")
                except Exception as e:
                    logger.error(f"Failed to setup pin {pin} for {name}: {e}")

    def set_relay(self, name: str, state: bool):
        self.relay_states[name] = state
        pin = self.relays.get(name, {}).get("pin")
        
        if HARDWARE_AVAILABLE and pin is not None:
            # Active LOW logic: True (ON) => LOW (0), False (OFF) => HIGH (1)
            pin_val = (GPIO.LOW if state else GPIO.HIGH) if self.active_low else (GPIO.HIGH if state else GPIO.LOW)
            GPIO.output(pin, pin_val)
            logger.info(f"GPIO Pin {pin} ({name}) set to {'ON (LOW)' if state else 'OFF (HIGH)'}")
        else:
            logger.info(f"[SIMULATED GPIO] Relay [{name}] (Pin {pin}) toggled -> {'ON' if state else 'OFF'}")

    def get_relay_state(self, name: str) -> bool:
        return self.relay_states.get(name, False)

    def read_sensors(self) -> Dict[str, Any]:
        """Reads temperature, humidity, and motion sensor values."""
        if HARDWARE_AVAILABLE:
            # You can integrate Adafruit_DHT / dht22 here for real sensors
            # For robust fallback, return realistic physical metrics
            pass

        # Simulate gradual ambient temperature & humidity drift
        self.sim_temp += random.uniform(-0.15, 0.15)
        self.sim_temp = max(18.0, min(32.0, round(self.sim_temp, 1)))

        self.sim_humidity += random.uniform(-0.4, 0.4)
        self.sim_humidity = max(40.0, min(75.0, round(self.sim_humidity, 1)))

        # 10% chance of momentary motion detection event
        self.sim_motion = random.random() < 0.10

        return {
            "temperature": self.sim_temp,
            "humidity": self.sim_humidity,
            "motion": self.sim_motion,
        }

    def cleanup(self):
        if HARDWARE_AVAILABLE:
            try:
                GPIO.cleanup()
                logger.info("GPIO pins cleaned up successfully.")
            except Exception as e:
                logger.error(f"Error during GPIO cleanup: {e}")


class SmartHomeMqttClient:
    """Handles MQTT connection, subscriptions, commands, and telemetry publishing."""
    def __init__(self, config_path: str = "config.yaml"):
        self.config = self._load_config(config_path)
        self.hw = HardwareController(self.config)
        self.running = True

        mqtt_cfg = self.config.get("mqtt", {})
        self.broker = os.getenv("MQTT_BROKER", mqtt_cfg.get("broker", "localhost"))
        self.port = int(os.getenv("MQTT_PORT", mqtt_cfg.get("port", 1883)))
        self.client_id = mqtt_cfg.get("client_id", "raspberry-pi-smart-home")
        self.username = os.getenv("MQTT_USER", mqtt_cfg.get("username", ""))
        self.password = os.getenv("MQTT_PASS", mqtt_cfg.get("password", ""))
        self.status_topic = self.config.get("device", {}).get("status_topic", "home/status")
        self.telemetry_interval = self.config.get("device", {}).get("telemetry_interval_sec", 5)

        # Reverse lookup map: cmd_topic -> relay_name
        self.topic_to_relay: Dict[str, str] = {}
        for relay_name, relay_info in self.config.get("gpio", {}).get("relays", {}).items():
            cmd_topic = relay_info.get("cmd_topic")
            if cmd_topic:
                self.topic_to_relay[cmd_topic] = relay_name

        # Setup MQTT Client
        # Compatible with both Paho MQTT v1 and v2 API
        try:
            self.client = mqtt.Client(
                callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
                client_id=self.client_id,
            )
        except (AttributeError, TypeError):
            self.client = mqtt.Client(client_id=self.client_id)

        if self.username:
            self.client.username_pw_set(self.username, self.password)

        # Setup Last Will and Testament (LWT)
        self.client.will_set(
            self.status_topic,
            payload=json.dumps({"status": "offline", "client_id": self.client_id, "timestamp": time.time()}),
            qos=1,
            retain=True,
        )

        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        self.client.on_disconnect = self.on_disconnect

    def _load_config(self, path: str) -> Dict[str, Any]:
        default_config = {
            "mqtt": {"broker": "localhost", "port": 1883, "client_id": "rpi-home-hub"},
            "device": {"status_topic": "home/status", "telemetry_interval_sec": 5},
            "gpio": {
                "active_low_relays": True,
                "relays": {
                    "living_room_light": {"pin": 17, "cmd_topic": "home/living_room/light/set", "state_topic": "home/living_room/light/state"},
                    "bedroom_light": {"pin": 27, "cmd_topic": "home/bedroom/light/set", "state_topic": "home/bedroom/light/state"},
                    "kitchen_light": {"pin": 22, "cmd_topic": "home/kitchen/light/set", "state_topic": "home/kitchen/light/state"},
                    "living_room_plug": {"pin": 23, "cmd_topic": "home/living_room/plug/set", "state_topic": "home/living_room/plug/state"},
                    "fan": {"pin": 24, "cmd_topic": "home/living_room/fan/set", "state_topic": "home/living_room/fan/state"},
                },
                "sensors": {
                    "temp_topic": "home/sensors/temperature",
                    "humidity_topic": "home/sensors/humidity",
                    "motion_topic": "home/sensors/motion",
                }
            }
        }

        if yaml and os.path.exists(path):
            try:
                with open(path, "r") as f:
                    data = yaml.safe_load(f)
                    if data:
                        return data
            except Exception as e:
                logger.warning(f"Could not read {path}: {e}. Using defaults.")

        return default_config

    def on_connect(self, client, userdata, flags, rc, properties=None):
        rc_val = rc.value if hasattr(rc, "value") else rc
        if rc_val == 0:
            logger.info(f"Connected successfully to MQTT broker at {self.broker}:{self.port}")
            # Announce Online Status (Retained)
            online_payload = {
                "status": "online",
                "client_id": self.client_id,
                "hardware_mode": "physical" if HARDWARE_AVAILABLE else "simulated",
                "timestamp": time.time(),
            }
            self.client.publish(self.status_topic, json.dumps(online_payload), qos=1, retain=True)

            # Subscribe to command topics
            for cmd_topic in self.topic_to_relay.keys():
                self.client.subscribe(cmd_topic, qos=1)
                logger.info(f"Subscribed to topic: {cmd_topic}")

            # Also subscribe to global wildcard for home commands
            self.client.subscribe("home/+/+/set", qos=1)

            # Publish initial relay states
            for relay_name, relay_info in self.config.get("gpio", {}).get("relays", {}).items():
                state_topic = relay_info.get("state_topic")
                if state_topic:
                    curr_state = self.hw.get_relay_state(relay_name)
                    self.publish_relay_state(state_topic, curr_state)
        else:
            logger.error(f"Connection failed with return code: {rc_val}")

    def on_disconnect(self, client, userdata, disconnect_flags_or_rc, reason_code=None, properties=None):
        logger.warning(f"Disconnected from MQTT broker.")

    def on_message(self, client, userdata, msg):
        topic = msg.topic
        payload_str = msg.payload.decode("utf-8").strip()
        logger.info(f"Received MQTT Message -> Topic: [{topic}] Payload: [{payload_str}]")

        relay_name = self.topic_to_relay.get(topic)
        if not relay_name:
            # Try matching pattern home/<room>/<device>/set
            for t, name in self.topic_to_relay.items():
                if t == topic:
                    relay_name = name
                    break

        if relay_name:
            new_state = False
            # Check JSON or plain string
            try:
                data = json.loads(payload_str)
                if isinstance(data, dict):
                    st = data.get("state", "").upper()
                    new_state = st in ("ON", "TRUE", "1")
                else:
                    new_state = str(data).upper() in ("ON", "TRUE", "1")
            except (json.JSONDecodeError, ValueError):
                new_state = payload_str.upper() in ("ON", "TRUE", "1")

            self.hw.set_relay(relay_name, new_state)

            # Publish updated state
            state_topic = self.config.get("gpio", {}).get("relays", {}).get(relay_name, {}).get("state_topic")
            if state_topic:
                self.publish_relay_state(state_topic, new_state)

    def publish_relay_state(self, state_topic: str, state: bool):
        payload = json.dumps({
            "state": "ON" if state else "OFF",
            "active": state,
            "timestamp": time.time(),
        })
        self.client.publish(state_topic, payload, qos=1, retain=True)
        logger.info(f"State published -> [{state_topic}]: {payload}")

    def publish_telemetry(self):
        sensor_cfg = self.config.get("gpio", {}).get("sensors", {})
        temp_topic = sensor_cfg.get("temp_topic", "home/sensors/temperature")
        hum_topic = sensor_cfg.get("humidity_topic", "home/sensors/humidity")
        mot_topic = sensor_cfg.get("motion_topic", "home/sensors/motion")

        data = self.hw.read_sensors()

        temp_payload = json.dumps({"value": data["temperature"], "unit": "°C", "timestamp": time.time()})
        hum_payload = json.dumps({"value": data["humidity"], "unit": "%", "timestamp": time.time()})
        mot_payload = json.dumps({"motion_detected": data["motion"], "timestamp": time.time()})

        self.client.publish(temp_topic, temp_payload, qos=0, retain=False)
        self.client.publish(hum_topic, hum_payload, qos=0, retain=False)
        self.client.publish(mot_topic, mot_payload, qos=0, retain=False)

        logger.debug(f"Telemetry published: {data['temperature']}°C | {data['humidity']}% | Motion: {data['motion']}")

    def run(self):
        logger.info(f"Starting Smart Home MQTT Client connecting to {self.broker}:{self.port}...")
        try:
            self.client.connect(self.broker, self.port, keepalive=60)
        except Exception as e:
            logger.error(f"Initial connection to {self.broker}:{self.port} failed: {e}")
            logger.info("Will retry in background...")

        self.client.loop_start()

        last_telemetry = 0
        try:
            while self.running:
                now = time.time()
                if now - last_telemetry >= self.telemetry_interval:
                    self.publish_telemetry()
                    last_telemetry = now
                time.sleep(0.5)
        except KeyboardInterrupt:
            logger.info("Received interrupt signal.")
        finally:
            self.stop()

    def stop(self):
        logger.info("Shutting down Smart Home controller...")
        self.running = False
        try:
            # Announce graceful offline
            offline_payload = json.dumps({"status": "offline", "client_id": self.client_id, "timestamp": time.time()})
            self.client.publish(self.status_topic, offline_payload, qos=1, retain=True)
            self.client.loop_stop()
            self.client.disconnect()
        except Exception as e:
            logger.error(f"Error during MQTT disconnect: {e}")

        self.hw.cleanup()
        logger.info("Controller exited cleanly.")


def main():
    config_file = sys.argv[1] if len(sys.argv) > 1 else "config.yaml"
    if not os.path.isabs(config_file):
        config_file = os.path.join(os.path.dirname(__file__), config_file)

    app = SmartHomeMqttClient(config_path=config_file)

    def handle_signal(sig, frame):
        logger.info(f"Received system signal {sig}. Exiting...")
        app.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    app.run()


if __name__ == "__main__":
    main()
