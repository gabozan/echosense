import { BleManager, Device } from "react-native-ble-plx";

class BLEService {
  manager: BleManager;

  constructor() {
    this.manager = new BleManager();
  }

  // Iniciar escaneo de dispositivos BLE
  scanForDevices(
    onDeviceFound: (device: Device) => void,
    onError?: (error: any) => void
  ) {
    this.manager.startDeviceScan(null, null, (error, device) => {
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

  // Destruir el manager cuando no se necesita
  destroy() {
    this.manager.destroy();
  }
}

export default new BLEService();
