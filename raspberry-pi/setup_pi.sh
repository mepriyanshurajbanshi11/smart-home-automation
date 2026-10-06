#!/usr/bin/env bash
# ==============================================================================
# Setup script for Smart Home MQTT Controller on Raspberry Pi (Raspberry Pi OS)
# ==============================================================================

set -e

echo "🏠 Setting up Smart Home MQTT Controller on Raspberry Pi..."

# Update and install system dependencies
echo "📦 Installing system packages (python3-pip, mosquitto)..."
sudo apt-get update
sudo apt-get install -y python3-pip python3-yaml mosquitto mosquitto-clients

# Install Python requirements
echo "📦 Installing Python requirements..."
pip3 install -r requirements.txt --break-system-packages 2>/dev/null || pip3 install -r requirements.txt

# Enable and start Mosquitto broker if local
echo "🔄 Enabling Mosquitto Broker service..."
sudo systemctl enable mosquitto
sudo systemctl restart mosquitto

# Configure systemd service
SERVICE_PATH="/etc/systemd/system/smart-home.service"
CURRENT_DIR=$(pwd)
CURRENT_USER=$(whoami)

echo "⚙️ Configuring systemd service for user $CURRENT_USER at $CURRENT_DIR..."
sudo sed -i "s|User=pi|User=$CURRENT_USER|g" smart-home.service
sudo sed -i "s|WorkingDirectory=/home/pi/smart-home/raspberry-pi|WorkingDirectory=$CURRENT_DIR|g" smart-home.service
sudo sed -i "s|ExecStart=/usr/bin/python3 /home/pi/smart-home/raspberry-pi/controller.py|ExecStart=$(which python3) $CURRENT_DIR/controller.py|g" smart-home.service

sudo cp smart-home.service $SERVICE_PATH
sudo systemctl daemon-reload
sudo systemctl enable smart-home.service
sudo systemctl restart smart-home.service

echo "✅ Smart Home Controller installed and running as a service!"
echo "🔍 Check status anytime with: sudo systemctl status smart-home.service"
echo "📜 View logs with: journalctl -u smart-home.service -f"
