import { BleManager, Device } from "react-native-ble-plx";
import { Buffer } from "buffer";

// BLE configuration from ESP32 firmware
const BLE_SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
const BLE_CREDENTIALS_CHAR_UUID = "6e400002-b5a3-f393-e0a9-e50e24dcca9e";

class BLEService {
  manager: BleManager;
  connectedDevice: Device | null = null;

  constructor() {
    this.manager = new BleManager();
  }

  // Start scanning for BLE devices
  scanForDevices(
    onDeviceFound: (device: Device) => void,
    onError?: (error: any) => void
  ) {
    this.manager.startDeviceScan([BLE_SERVICE_UUID], null, (error, device) => {
      if (error) {
        console.error("Error during BLE scan:", error);
        onError?.(error);
        return;
      }

      if (device && device.name) {
        onDeviceFound(device);
      }
    });
  }

  // Stop scanning
  stopScan() {
    this.manager.stopDeviceScan();
  }

  // Connect to a device
  async connectToDevice(deviceId: string): Promise<Device> {
    this.stopScan();
    const device = await this.manager.connectToDevice(deviceId);
    await device.discoverAllServicesAndCharacteristics();
    this.connectedDevice = device;
    console.log("Connected to device:", device.name);
    return device;
  }

  // Write WiFi credentials to device in "<SSID>|<PASSWORD>" format
  async writeWifiCredentials(ssid: string, password: string): Promise<void> {
    if (!this.connectedDevice) {
      throw new Error("No device connected");
    }

    const payload = `${ssid}|${password}`;
    const payloadBase64 = Buffer.from(payload).toString("base64");

    await this.connectedDevice.writeCharacteristicWithResponseForService(
      BLE_SERVICE_UUID,
      BLE_CREDENTIALS_CHAR_UUID,
      payloadBase64
    );
    console.log("WiFi credentials sent successfully:", payload);
  }

  // Disconnect from device
  async disconnectDevice(): Promise<void> {
    if (this.connectedDevice) {
      try {
        const isConnected = await this.manager.isDeviceConnected(
          this.connectedDevice.id
        );
        if (isConnected) {
          await this.manager.cancelDeviceConnection(this.connectedDevice.id);
          console.log("Disconnected from device:", this.connectedDevice.name);
        }
      } catch (err) {
        // Ignore errors
        // Device may have already disconnected
      } finally {
        this.connectedDevice = null;
      }
    }
  }

  // Destroy the manager when no longer needed
  destroy() {
    this.disconnectDevice();
    this.manager.destroy();
  }
}

export default new BLEService();