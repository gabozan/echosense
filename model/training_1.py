"""
EchoSense ML Training
"""

import os
import numpy as np
import pandas as pd
import librosa
import tensorflow as tf
from pathlib import Path
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.utils.class_weight import compute_class_weight
import matplotlib.pyplot as plt
import seaborn as sns
from tqdm import tqdm

# =============== CONFIGURACIÓN ESP32-OPTIMIZADA ===============
CONFIG = {
    'esc50_path': '/Users/neilpradasmartinez/Desktop/echosens/ESC-50-master',
    
    # --- PARÁMETROS SINCRONIZADOS CON HARDWARE ---
    'sr': 16000,         # 16 kHz
    'duration': 2.0,     
    
    # --- Log-Mel Spectrogram  ---
    'n_mels': 64,        
    'n_fft': 1024,       
    'hop_length': 512,  
    'fmin': 0,
    'fmax': 8000,        #
    
    # --- Training ---
    'batch_size': 32,
    'epochs': 30,
    'learning_rate': 0.001,
    'test_size': 0.2,
    'val_size': 0.1,
    
    # --- Data Augmentation ---
    'use_augmentation': True,
    'augmentation_prob': 0.7,
    'num_silence_samples': 150,
}

# MAPEO DE CLASES
ESC50_MAPPING = {
    # TRAFFIC (60 samples)
    'car_horn': 1,
    'engine': 1,
    'train': 1,
    
    # VOICES (120 samples)
    'crying_baby': 2,
    'sneezing': 2,
    'coughing': 2,
    'breathing': 2,
    'laughing': 2,
    'footsteps': 2,
    
    # MUSIC (120 samples)
    'clapping': 3,
    'keyboard_typing': 3,
    'door_wood_knock': 3,
    
    # MACHINERY (120 samples)
    'chainsaw': 4,
    'siren': 4,
    'fireworks': 4,
    'hand_saw': 4,
    'helicopter': 4,
    'airplane': 4,
}

ECHOSENSE_CLASSES = ['silence', 'traffic', 'voices', 'music', 'machinery']

# =============== DATA AUGMENTATION ===============
def time_shift(audio, shift_max=0.2):
    """Desplazamiento temporal"""
    shift = np.random.randint(-int(len(audio) * shift_max), int(len(audio) * shift_max))
    return np.roll(audio, shift)

def add_noise(audio, noise_factor=0.005):
    """Añadir ruido gaussiano"""
    noise = np.random.normal(0, noise_factor, len(audio))
    return audio + noise

def pitch_shift(audio, sr, n_steps=None):
    """Cambio de pitch"""
    if n_steps is None:
        n_steps = np.random.randint(-3, 4)
    return librosa.effects.pitch_shift(audio, sr=sr, n_steps=n_steps)

def time_stretch(audio, rate=None):
    """Estiramiento temporal"""
    if rate is None:
        rate = np.random.uniform(0.8, 1.2)
    return librosa.effects.time_stretch(audio, rate=rate)

def spec_augment(mel_spec, num_mask=2, freq_masking=0.15, time_masking=0.20):
    """SpecAugment: enmascara franjas de frecuencia y tiempo"""
    spec = mel_spec.copy()
    num_mel_channels = spec.shape[0]
    num_time_steps = spec.shape[1]
    
    # Frequency masking
    for _ in range(num_mask):
        f = np.random.uniform(0, freq_masking)
        f = int(f * num_mel_channels)
        f0 = np.random.randint(0, num_mel_channels - f)
        spec[f0:f0+f, :] = 0
    
    # Time masking
    for _ in range(num_mask):
        t = np.random.uniform(0, time_masking)
        t = int(t * num_time_steps)
        t0 = np.random.randint(0, num_time_steps - t)
        spec[:, t0:t0+t] = 0
    
    return spec

def augment_audio(audio, sr, config):
    """Aplica augmentations aleatorias al audio"""
    if not config['use_augmentation']:
        return audio
    
    if np.random.random() > config['augmentation_prob']:
        return audio
    
    augmentations = []
    
    if np.random.random() > 0.5:
        augmentations.append(lambda x: time_shift(x))
    if np.random.random() > 0.5:
        augmentations.append(lambda x: add_noise(x))
    if np.random.random() > 0.3:
        augmentations.append(lambda x: pitch_shift(x, sr))
    if np.random.random() > 0.5:
        augmentations.append(lambda x: time_stretch(x))
    
    for aug in augmentations:
        audio = aug(audio)
    
    return audio

# =============== GENERAR SILENCE ===============
def generate_silence_samples(num_samples, config):

    print(f"\n Generando {num_samples} muestras de silencio sintético...")
    
    X_silence = []
    target_length = int(config['sr'] * config['duration'])
    
    for i in range(num_samples):
        noise_level = np.random.uniform(0.0005, 0.002)
        silence = np.random.normal(0, noise_level, target_length)
        silence = librosa.effects.preemphasis(silence, coef=0.95)
        X_silence.append(silence)
    
    return X_silence

# =============== FEATURE EXTRACTION ===============
def extract_log_mel_spectrogram(audio, config, apply_spec_augment=False):

    # Asegurar longitud correcta
    target_length = int(config['sr'] * config['duration'])
    if len(audio) < target_length:
        audio = np.pad(audio, (0, target_length - len(audio)))
    else:
        audio = audio[:target_length]
    
    # Extraer Mel Spectrogram
    mel_spec = librosa.feature.melspectrogram(
        y=audio,
        sr=config['sr'],
        n_mels=config['n_mels'],
        n_fft=config['n_fft'],
        hop_length=config['hop_length'],
        fmin=config['fmin'],
        fmax=config['fmax'],
        power=2.0
    )
    
    # Convertir a escala logarítmica (dB)
    log_mel_spec = librosa.power_to_db(mel_spec, ref=np.max)
    
    # Normalizar a [-1, 1]
    log_mel_spec = (log_mel_spec - log_mel_spec.mean()) / (log_mel_spec.std() + 1e-8)
    
    # Aplicar SpecAugment si está en modo training
    if apply_spec_augment and config['use_augmentation']:
        if np.random.random() > 0.5:
            log_mel_spec = spec_augment(log_mel_spec)
    
    # Añadir dimensión de canal (64, time_steps) -> (64, time_steps, 1)
    log_mel_spec = np.expand_dims(log_mel_spec, axis=-1)
    
    return log_mel_spec

# =============== CARGAR DATASET ===============
def load_esc50_metadata(esc50_path):
    """Carga metadatos de ESC-50"""
    meta_path = Path(esc50_path) / 'meta' / 'esc50.csv'
    df = pd.read_csv(meta_path)
    
    df_filtered = df[df['category'].isin(ESC50_MAPPING.keys())].copy()
    df_filtered['echosense_label'] = df_filtered['category'].map(ESC50_MAPPING)
    
    print(f"Total archivos ESC-50: {len(df)}")
    print(f"Archivos filtrados para EchoSense: {len(df_filtered)}")
    print(f"\nDistribución ESC-50:")
    for label, name in enumerate(ECHOSENSE_CLASSES[1:], start=1):
        count = (df_filtered['echosense_label'] == label).sum()
        print(f"  {name}: {count} samples")
    
    return df_filtered

def process_dataset(df, esc50_path, config, is_training=False):
    """Procesa dataset completo"""
    X, y = [], []
    audio_dir = Path(esc50_path) / 'audio'
    
    # 1. Procesar audios de ESC-50
    print(f"\n Extrayendo Log-Mel Spectrograms de ESC-50...")
    print(f"   Config ESP32: {config['n_mels']} mels, {config['n_fft']} FFT, SR={config['sr']}Hz, {config['duration']}s")
    
    for idx, row in tqdm(df.iterrows(), total=len(df), desc="Processing ESC-50"):
        audio_path = audio_dir / row['filename']
        
        try:
            # Cargar audio
            audio, sr = librosa.load(str(audio_path), sr=config['sr'], duration=config['duration'])
            
            # Aplicar augmentation si es training
            if is_training:
                audio = augment_audio(audio, sr, config)
            
            # Extraer Log-Mel Spectrogram
            features = extract_log_mel_spectrogram(
                audio, config, 
                apply_spec_augment=is_training
            )
            
            X.append(features)
            y.append(row['echosense_label'])
            
        except Exception as e:
            print(f"Error en {audio_path}: {e}")
            continue
    
    # 2. Generar y procesar silence
    silence_audios = generate_silence_samples(config['num_silence_samples'], config)
    
    print("\n Extrayendo features de silence...")
    for i, silence_audio in enumerate(tqdm(silence_audios, desc="Processing silence")):
        features = extract_log_mel_spectrogram(silence_audio, config)
        X.append(features)
        y.append(0)
    
    X = np.array(X)
    y = np.array(y)
    
    print(f"\n Dataset procesado:")
    print(f"   Shape: {X.shape}")
    print(f"   Tipo: Log-Mel Spectrogram (dB scale)")
    print(f"   Optimizado para: ESP32 FireBeetle (64 mels, 2s)")
    print(f"\nDistribución de clases:")
    for label, name in enumerate(ECHOSENSE_CLASSES):
        count = (y == label).sum()
        print(f"  {label} - {name}: {count} samples")
    
    return X, y

# =============== MODELO CNN OPTIMIZADO PARA ESP32 ===============
def create_advanced_model(input_shape, num_classes):
    """
    CNN optimizada para ESP32:
    - Menos parámetros que la versión original
    - Mantiene buena accuracy
    - Más rápida en inferencia
    """
    inputs = tf.keras.layers.Input(shape=input_shape)
    
    # Bloque 1
    x = tf.keras.layers.Conv2D(32, (3, 3), padding='same', activation='relu')(inputs)
    x = tf.keras.layers.BatchNormalization()(x)
    x = tf.keras.layers.Conv2D(32, (3, 3), padding='same', activation='relu')(x)
    x = tf.keras.layers.BatchNormalization()(x)
    x = tf.keras.layers.MaxPooling2D((2, 2))(x)
    x = tf.keras.layers.Dropout(0.25)(x)
    
    # Bloque 2
    x = tf.keras.layers.Conv2D(64, (3, 3), padding='same', activation='relu')(x)
    x = tf.keras.layers.BatchNormalization()(x)
    x = tf.keras.layers.Conv2D(64, (3, 3), padding='same', activation='relu')(x)
    x = tf.keras.layers.BatchNormalization()(x)
    x = tf.keras.layers.MaxPooling2D((2, 2))(x)
    x = tf.keras.layers.Dropout(0.25)(x)
    
    # Bloque 3
    x = tf.keras.layers.Conv2D(128, (3, 3), padding='same', activation='relu')(x)
    x = tf.keras.layers.BatchNormalization()(x)
    x = tf.keras.layers.Conv2D(128, (3, 3), padding='same', activation='relu')(x)
    x = tf.keras.layers.BatchNormalization()(x)
    x = tf.keras.layers.MaxPooling2D((2, 2))(x)
    x = tf.keras.layers.Dropout(0.3)(x)
    
    # Bloque 4
    x = tf.keras.layers.Conv2D(256, (3, 3), padding='same', activation='relu')(x)
    x = tf.keras.layers.BatchNormalization()(x)
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    
    # Clasificador
    x = tf.keras.layers.Dense(128, activation='relu')(x)
    x = tf.keras.layers.Dropout(0.5)(x)
    outputs = tf.keras.layers.Dense(num_classes, activation='softmax')(x)
    
    model = tf.keras.Model(inputs, outputs)
    
    return model

# =============== ENTRENAR ===============
def train_model(X_train, y_train, X_val, y_val, config):
    """Entrena el modelo con configuración optimizada"""
    
    # Calcular class weights
    class_weights = compute_class_weight(
        'balanced',
        classes=np.unique(y_train),
        y=y_train
    )
    class_weight_dict = dict(enumerate(class_weights))
    
    print("\n⚖️ Class Weights:")
    for cls, weight in class_weight_dict.items():
        print(f"  {ECHOSENSE_CLASSES[cls]}: {weight:.3f}")
    
    # Crear modelo
    model = create_advanced_model(input_shape=X_train.shape[1:], num_classes=5)
    
    # Compilar con optimizer optimizado
    optimizer = tf.keras.optimizers.Adam(
        learning_rate=config['learning_rate'],
        beta_1=0.9,
        beta_2=0.999,
        epsilon=1e-7
    )
    
    model.compile(
        optimizer=optimizer,
        loss='sparse_categorical_crossentropy',
        metrics=['accuracy']
    )
    
    print("\n=== Arquitectura del Modelo (ESP32-Optimized) ===")
    model.summary()
    
    # Callbacks
    callbacks = [
        tf.keras.callbacks.EarlyStopping(
            monitor='val_loss',
            patience=20,
            restore_best_weights=True,
            verbose=1
        ),
        tf.keras.callbacks.ModelCheckpoint(
            'echosense_best_model.keras',
            monitor='val_accuracy',
            save_best_only=True,
            verbose=1
        ),
        tf.keras.callbacks.ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.5,
            patience=10,
            min_lr=1e-7,
            verbose=1
        ),
        tf.keras.callbacks.CSVLogger('training_log.csv')
    ]
    
    print("\n=== Iniciando Entrenamiento ===")
    history = model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=config['epochs'],
        batch_size=config['batch_size'],
        class_weight=class_weight_dict,
        callbacks=callbacks,
        verbose=1
    )
    
    return model, history

# =============== EVALUAR ===============
def evaluate_model(model, X_test, y_test):
    """Evalúa el modelo en detalle"""
    y_pred_proba = model.predict(X_test, verbose=0)
    y_pred = np.argmax(y_pred_proba, axis=1)
    
    test_loss, test_acc = model.evaluate(X_test, y_test, verbose=0)
    
    print(f"\n{'='*60}")
    print(f"RESULTADOS FINALES - ESP32 OPTIMIZED")
    print(f"{'='*60}")
    print(f"Test Accuracy: {test_acc*100:.2f}%")
    print(f"Test Loss: {test_loss:.4f}\n")
    
    print("Classification Report:")
    print(classification_report(
        y_test,
        y_pred,
        target_names=ECHOSENSE_CLASSES,
        digits=3
    ))
    
    # Matriz de confusión
    cm = confusion_matrix(y_test, y_pred)
    plt.figure(figsize=(10, 8))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues',
                xticklabels=ECHOSENSE_CLASSES,
                yticklabels=ECHOSENSE_CLASSES)
    plt.title('EchoSense - Confusion Matrix (ESP32 Optimized)', fontsize=16, fontweight='bold')
    plt.ylabel('True Label')
    plt.xlabel('Predicted Label')
    plt.tight_layout()
    plt.savefig('confusion_matrix_esp32.png', dpi=300)
  
    
    # Análisis por clase
    print("\n Análisis detallado por clase:")
    for i, class_name in enumerate(ECHOSENSE_CLASSES):
        class_mask = y_test == i
        if class_mask.sum() > 0:
            class_acc = (y_pred[class_mask] == i).sum() / class_mask.sum()
            print(f"  {class_name}: {class_acc*100:.1f}% ({class_mask.sum()} samples)")
    
    return test_acc

# =============== TFLITE ===============
def convert_to_tflite(model, X_train):
    """Convierte a TFLite optimizado para ESP32"""
    print("\n=== Convirtiendo a TFLite ===")
    
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    
    def representative_dataset():
        for i in range(min(100, len(X_train))):
            yield [X_train[i:i+1].astype(np.float32)]
    
    converter.representative_dataset = representative_dataset
    
    # Quantization
    converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
    converter.inference_input_type = tf.float32
    converter.inference_output_type = tf.float32
    
    tflite_model = converter.convert()
    
    with open('echosense_model.tflite', 'wb') as f:
        f.write(tflite_model)
    
    size_kb = len(tflite_model) / 1024
    print(f"Modelo TFLite: echosense_model.tflite ({size_kb:.2f} KB)")
    print(f" Optimizado para ESP32 FireBeetle (64 mels, 2s, 16kHz)")
    
    return tflite_model

# =============== MAIN ===============
def main():
    print("="*70)
    print("ECHOSENSE ML TRAINING ")
    print("="*70)
    
    # Paso 1: Cargar metadatos
    print("\n[1/7] Cargando ESC-50 metadata...")
    df = load_esc50_metadata(CONFIG['esc50_path'])
    
    # Paso 2: Split primero
    print("\n[2/7] Dividiendo dataset...")
    train_val_df, test_df = train_test_split(
        df, test_size=CONFIG['test_size'], random_state=42, 
        stratify=df['echosense_label']
    )
    train_df, val_df = train_test_split(
        train_val_df, 
        test_size=CONFIG['val_size']/(1-CONFIG['test_size']),
        random_state=42, 
        stratify=train_val_df['echosense_label']
    )
    
    print(f"Train: {len(train_df)}, Val: {len(val_df)}, Test: {len(test_df)}")
    
    # Paso 3: Procesar datasets
    print("\n[3/7] Procesando train set (con augmentation)...")
    X_train, y_train = process_dataset(train_df, CONFIG['esc50_path'], CONFIG, is_training=True)
    
    print("\n[4/7] Procesando validation set...")
    X_val, y_val = process_dataset(val_df, CONFIG['esc50_path'], CONFIG, is_training=False)
    
    print("\n[5/7] Procesando test set...")
    X_test, y_test = process_dataset(test_df, CONFIG['esc50_path'], CONFIG, is_training=False)
    
    # Paso 6: Entrenar
    print("\n[6/7] Entrenando modelo...")
    model, history = train_model(X_train, y_train, X_val, y_val, CONFIG)
    
    # Paso 7: Evaluar
    print("\n[7/7] Evaluando modelo...")
    test_acc = evaluate_model(model, X_test, y_test)
    
    # Paso 8: Convertir a TFLite
    if test_acc >= 0.70:  # Umbral más bajo para ESP32
        print("\n[8/8] Convirtiendo a TFLite...")
        convert_to_tflite(model, X_train)
    
    print("\n" + "="*70)
    print("✓ ENTRENAMIENTO COMPLETADO")
    print("="*70)

if __name__ == "__main__":
    main()