const noble = require('noble');

class FitnessBikeController {
    constructor() {
        this.device = null;
        this.indoorBikeDataCharacteristic = null;
        this.controlPointCharacteristic = null;
        this.isConnected = false;
        this.isMonitoring = false;
        
        // Bluetooth UUIDs
        this.FITNESS_MACHINE_SERVICE = '1826';
        this.INDOOR_BIKE_DATA_CHAR = '2ad2';
        this.CONTROL_POINT_CHAR = '2ad9';
        
        this.setupNoble();
    }
    
    setupNoble() {
        noble.on('stateChange', (state) => {
            console.log('📡 Bluetooth状態:', state);
            if (state === 'poweredOn') {
                console.log('✅ Bluetooth準備完了 - スキャン可能');
            }
        });
        
        noble.on('discover', (peripheral) => {
            console.log(`🔍 デバイス発見: ${peripheral.advertisement.localName || 'Unknown'} (${peripheral.id})`);
            
            // MG03またはFitness Machine Serviceを持つデバイスを探す
            const hasTargetService = peripheral.advertisement.serviceUuids.includes(this.FITNESS_MACHINE_SERVICE);
            const isTargetDevice = peripheral.advertisement.localName === 'MG03';
            
            if (hasTargetService || isTargetDevice) {
                console.log(`🎯 ターゲットデバイス発見: ${peripheral.advertisement.localName}`);
                noble.stopScanning();
                this.connectToDevice(peripheral);
            }
        });
    }
    
    startScan() {
        console.log('🔍 Bluetoothデバイスをスキャン中...');
        noble.startScanning([this.FITNESS_MACHINE_SERVICE], false);
        
        // 30秒後にタイムアウト
        setTimeout(() => {
            if (!this.isConnected) {
                console.log('⏰ スキャンタイムアウト');
                noble.stopScanning();
            }
        }, 30000);
    }
    
    async connectToDevice(peripheral) {
        try {
            console.log(`🔗 接続中: ${peripheral.advertisement.localName}`);
            
            peripheral.on('disconnect', () => {
                console.log('❌ デバイスが切断されました');
                this.isConnected = false;
                this.isMonitoring = false;
            });
            
            await new Promise((resolve, reject) => {
                peripheral.connect((error) => {
                    if (error) reject(error);
                    else resolve();
                });
            });
            
            console.log('✅ GATT接続成功');
            this.device = peripheral;
            this.isConnected = true;
            
            await this.discoverServices();
            
        } catch (error) {
            console.error('❌ 接続エラー:', error.message);
        }
    }
    
    async discoverServices() {
        try {
            const services = await new Promise((resolve, reject) => {
                this.device.discoverServices([this.FITNESS_MACHINE_SERVICE], (error, services) => {
                    if (error) reject(error);
                    else resolve(services);
                });
            });
            
            if (services.length === 0) {
                console.log('❌ Fitness Machine Serviceが見つかりません');
                return;
            }
            
            const fitnessService = services[0];
            console.log('🔧 Fitness Machine Service発見');
            
            const characteristics = await new Promise((resolve, reject) => {
                fitnessService.discoverCharacteristics([], (error, characteristics) => {
                    if (error) reject(error);
                    else resolve(characteristics);
                });
            });
            
            console.log('📡 発見された特性:');
            characteristics.forEach(char => {
                console.log(`  - ${char.uuid}: ${char.properties.join(', ')}`);
                
                if (char.uuid === this.INDOOR_BIKE_DATA_CHAR) {
                    this.indoorBikeDataCharacteristic = char;
                    console.log('  → Indoor Bike Data特性を設定');
                }
                
                if (char.uuid === this.CONTROL_POINT_CHAR) {
                    this.controlPointCharacteristic = char;
                    console.log('  → Control Point特性を設定');
                }
            });
            
            await this.setupDataMonitoring();
            await this.setupControlPoint();
            
        } catch (error) {
            console.error('❌ サービス探索エラー:', error.message);
        }
    }
    
    async setupDataMonitoring() {
        if (!this.indoorBikeDataCharacteristic) {
            console.log('⚠️ Indoor Bike Data特性が利用できません');
            return;
        }
        
        try {
            this.indoorBikeDataCharacteristic.on('data', (data) => {
                this.parseIndoorBikeData(data);
            });
            
            await new Promise((resolve, reject) => {
                this.indoorBikeDataCharacteristic.subscribe((error) => {
                    if (error) reject(error);
                    else resolve();
                });
            });
            
            console.log('📊 Indoor Bike Data監視開始');
            this.isMonitoring = true;
            
        } catch (error) {
            console.error('❌ データ監視設定エラー:', error.message);
        }
    }
    
    async setupControlPoint() {
        if (!this.controlPointCharacteristic) {
            console.log('⚠️ Control Point特性が利用できません');
            return;
        }
        
        try {
            // Control Pointからの応答を監視
            this.controlPointCharacteristic.on('data', (data) => {
                this.handleControlPointResponse(data);
            });
            
            if (this.controlPointCharacteristic.properties.includes('indicate')) {
                await new Promise((resolve, reject) => {
                    this.controlPointCharacteristic.subscribe((error) => {
                        if (error) reject(error);
                        else resolve();
                    });
                });
                console.log('🎛️ Control Point応答監視開始');
            }
            
        } catch (error) {
            console.error('❌ Control Point設定エラー:', error.message);
        }
    }
    
    parseIndoorBikeData(data) {
        const flags = data.readUInt16LE(0);
        let offset = 2;
        
        console.log(`📊 Indoor Bike Data受信:`);
        console.log(`  生データ: ${data.toString('hex')}`);
        console.log(`  フラグ: 0x${flags.toString(16).padStart(4, '0')} (${flags.toString(2).padStart(16, '0')})`);
        
        try {
            // Instantaneous Speed (常に存在)
            if (offset + 2 <= data.length) {
                const speed = data.readUInt16LE(offset) * 0.01;
                console.log(`  速度: ${speed.toFixed(1)} km/h`);
                offset += 2;
            }
            
            // Average Speed (bit 1)
            if ((flags & 0x02) && offset + 2 <= data.length) {
                const avgSpeed = data.readUInt16LE(offset) * 0.01;
                console.log(`  平均速度: ${avgSpeed.toFixed(1)} km/h`);
                offset += 2;
            }
            
            // Instantaneous Cadence (bit 2)
            if ((flags & 0x04) && offset + 2 <= data.length) {
                const cadence = data.readUInt16LE(offset) * 0.5;
                console.log(`  ケイデンス: ${cadence.toFixed(0)} rpm`);
                offset += 2;
            }
            
            // Average Cadence (bit 3)
            if ((flags & 0x08) && offset + 2 <= data.length) {
                const avgCadence = data.readUInt16LE(offset) * 0.5;
                console.log(`  平均ケイデンス: ${avgCadence.toFixed(0)} rpm`);
                offset += 2;
            }
            
            // Total Distance (bit 4)
            if ((flags & 0x10) && offset + 3 <= data.length) {
                const distance = (data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16));
                console.log(`  距離: ${distance} m`);
                offset += 3;
            }
            
            // Resistance Level (bit 5)
            if ((flags & 0x20) && offset + 2 <= data.length) {
                const resistance = data.readInt16LE(offset);
                console.log(`  抵抗レベル: ${resistance}`);
                offset += 2;
            }
            
            // Instantaneous Power (bit 6)
            if ((flags & 0x40) && offset + 2 <= data.length) {
                const power = data.readInt16LE(offset);
                console.log(`  パワー: ${power} W`);
                offset += 2;
            }
            
            // Average Power (bit 7)
            if ((flags & 0x80) && offset + 2 <= data.length) {
                const avgPower = data.readInt16LE(offset);
                console.log(`  平均パワー: ${avgPower} W`);
                offset += 2;
            }
            
            console.log('');
            
        } catch (error) {
            console.error('❌ データパースエラー:', error.message);
        }
    }
    
    handleControlPointResponse(data) {
        const responseCode = data[0];
        const requestOpCode = data[1];
        const resultCode = data[2];
        
        const resultMap = {
            0x01: 'SUCCESS',
            0x02: 'NOT_SUPPORTED',
            0x03: 'INVALID_PARAMETER',
            0x04: 'OPERATION_FAILED',
            0x05: 'CONTROL_NOT_PERMITTED'
        };
        
        const result = resultMap[resultCode] || `UNKNOWN(${resultCode})`;
        
        console.log(`🎛️ Control Point応答:`);
        console.log(`  生データ: ${data.toString('hex')}`);
        console.log(`  応答コード: 0x${responseCode.toString(16)}`);
        console.log(`  要求OpCode: 0x${requestOpCode.toString(16)}`);
        console.log(`  結果: ${result} (0x${resultCode.toString(16)})`);
        console.log('');
    }
    
    async setResistanceLevel(level) {
        if (!this.controlPointCharacteristic) {
            console.log('❌ Control Point特性が利用できません');
            return;
        }
        
        try {
            console.log(`🔧 負荷レベル設定: ${level}`);
            
            // OpCode 0x04: Set Target Resistance Level
            const command = Buffer.from([
                0x04,                    // OpCode
                level & 0xFF,           // Low byte
                (level >> 8) & 0xFF     // High byte
            ]);
            
            console.log(`📡 送信コマンド: ${command.toString('hex')}`);
            
            await new Promise((resolve, reject) => {
                this.controlPointCharacteristic.write(command, false, (error) => {
                    if (error) reject(error);
                    else resolve();
                });
            });
            
            console.log('✅ コマンド送信完了');
            
        } catch (error) {
            console.error('❌ 負荷設定エラー:', error.message);
        }
    }
    
    disconnect() {
        if (this.device && this.isConnected) {
            this.device.disconnect();
            console.log('❌ デバイスから切断');
        }
    }
}

// メインプログラム
const controller = new FitnessBikeController();

console.log('🚴‍♂️ Fitness Bike Controller (Node.js + Noble)');
console.log('利用可能なコマンド:');
console.log('  start  - デバイススキャン開始');
console.log('  r1-80  - 負荷レベル設定 (例: r20)');
console.log('  quit   - 終了');
console.log('');

process.stdin.setEncoding('utf8');
process.stdin.on('data', (input) => {
    const command = input.trim().toLowerCase();
    
    if (command === 'start') {
        controller.startScan();
    } else if (command.startsWith('r') && command.length > 1) {
        const level = parseInt(command.substring(1));
        if (level >= 1 && level <= 80) {
            controller.setResistanceLevel(level);
        } else {
            console.log('❌ 無効な負荷レベル (1-80)');
        }
    } else if (command === 'quit') {
        controller.disconnect();
        process.exit(0);
    } else {
        console.log('❌ 無効なコマンド');
    }
});

console.log('> ');