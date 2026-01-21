#!/bin/bash
# Setup VirtualBox on Linux VPS for Windows VM
# Run this script on your Linux VPS (72.62.185.168)

set -e

echo "=========================================="
echo "  VirtualBox Setup for Windows VM"
echo "=========================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root (use sudo)"
    exit 1
fi

# Update system
echo "Updating system packages..."
apt update && apt upgrade -y

# Install VirtualBox
echo "Installing VirtualBox..."
apt install -y virtualbox virtualbox-ext-pack

# Install VNC server for GUI access (optional but helpful)
echo "Installing VNC server for GUI access..."
apt install -y tightvncserver

# Add current user to vboxusers group (if not root)
if [ -n "$SUDO_USER" ]; then
    usermod -aG vboxusers "$SUDO_USER"
    echo "Added $SUDO_USER to vboxusers group"
fi

# Check VirtualBox installation
if command -v VBoxManage &> /dev/null; then
    VBOX_VERSION=$(VBoxManage --version)
    echo ""
    echo "✓ VirtualBox installed successfully: $VBOX_VERSION"
else
    echo "✗ VirtualBox installation failed"
    exit 1
fi

echo ""
echo "=========================================="
echo "  Next Steps:"
echo "=========================================="
echo "1. Set up VNC server (optional):"
echo "   vncserver :1"
echo ""
echo "2. Create Windows VM using VirtualBox GUI or command line"
echo ""
echo "3. Configure VM with:"
echo "   - At least 4GB RAM"
echo "   - 50GB+ storage"
echo "   - Bridged network adapter"
echo ""
echo "4. Follow the Windows VM setup guide:"
echo "   deployment/WINDOWS_VM_QUICK_SETUP.md"
echo ""
echo "=========================================="
