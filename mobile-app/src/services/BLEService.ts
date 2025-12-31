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

  // Iniciar escaneo de dispositivos BLE
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

  // Detener el escaneo
  stopScan() {
    this.manager.stopDeviceScan();
  }

  // Conectar a un dispositivo
  async connectToDevice(deviceId: string): Promise<Device> {
    this.stopScan();
    const device = await this.manager.connectToDevice(deviceId);
    await device.discoverAllServicesAndCharacteristics();
    this.connectedDevice = device;
    console.log("Connected to device:", device.name);
    return device;
  }

  // Escribir credenciales WiFi al dispositivo en formato "<SSID>|<PASSWORD>"
  async writeWifiCredentials(ssid: string, password: string): Promise<void> {
    if (!this.connectedDevice) {
      throw new Error("No device connected");
    }

    // El ESP32 espera el formato "<SSID>|<PASSWORD>"
    const payload = `${ssid}|${password}`;
    const payloadBase64 = Buffer.from(payload).toString("base64");

    await this.connectedDevice.writeCharacteristicWithResponseForService(
      BLE_SERVICE_UUID,
      BLE_CREDENTIALS_CHAR_UUID,
      payloadBase64
    );
    console.log("WiFi credentials sent successfully:", payload);
  }

  // Desconectar del dispositivo
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
        // Ignoramos errores aquí ya que lo importante es limpiar el estado
        // y a veces el dispositivo ya se ha desconectado por su cuenta.
        // console.log("Disconnect cleanup (benign error):", err);
      } finally {
        this.connectedDevice = null;
      }
    }
  }

  // Destruir el manager cuando no se necesita
  destroy() {
    this.disconnectDevice();
    this.manager.destroy();
  }
}

export default new BLEService();
