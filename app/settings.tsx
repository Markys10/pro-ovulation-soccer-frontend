import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useProfileStore } from '../store/useProfileStore';
import { COLORS } from '../constants/theme';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

export default function Settings() {
  const router = useRouter();
  const { exportData, importData, clearAll, profiles } = useProfileStore();
  const [importText, setImportText] = useState('');
  const [showImportInput, setShowImportInput] = useState(false);

  const handleExport = async () => {
    if (profiles.length === 0) {
      Alert.alert('Aviso', 'No hay datos para exportar');
      return;
    }
    await exportData();
  };

  const handleImportFromFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0].uri) {
        const content = await FileSystem.readAsStringAsync(result.assets[0].uri);
        await importData(content);
        router.back();
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo leer el archivo');
    }
  };

  const handleImportFromText = async () => {
    if (!importText.trim()) {
      Alert.alert('Error', 'Introduce el texto JSON para importar');
      return;
    }
    try {
      await importData(importText);
      setImportText('');
      setShowImportInput(false);
      router.back();
    } catch (error) {
      Alert.alert('Error', 'El formato del JSON no es válido');
    }
  };

  const handleClearAll = () => {
    Alert.alert(
      '¿Borrar todos los datos?',
      'Esta acción no se puede deshacer. Se eliminarán todos los perfiles y observaciones.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: async () => {
            await clearAll();
            router.back();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Configuración</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Datos</Text>
          
          <TouchableOpacity style={styles.option} onPress={handleExport}>
            <View style={styles.optionLeft}>
              <Ionicons name="cloud-upload" size={24} color={COLORS.primary} />
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>Exportar datos</Text>
                <Text style={styles.optionDescription}>
                  Guarda una copia de seguridad de todos tus datos
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.option} onPress={handleImportFromFile}>
            <View style={styles.optionLeft}>
              <Ionicons name="cloud-download" size={24} color={COLORS.primary} />
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>Importar desde archivo</Text>
                <Text style={styles.optionDescription}>
                  Restaura datos desde un archivo JSON
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.option}
            onPress={() => setShowImportInput(!showImportInput)}
          >
            <View style={styles.optionLeft}>
              <Ionicons name="document-text" size={24} color={COLORS.primary} />
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>Importar desde texto</Text>
                <Text style={styles.optionDescription}>
                  Pega el contenido JSON para importar
                </Text>
              </View>
            </View>
            <Ionicons
              name={showImportInput ? 'chevron-up' : 'chevron-down'}
              size={20}
              color={COLORS.textSecondary}
            />
          </TouchableOpacity>

          {showImportInput && (
            <View style={styles.importInputContainer}>
              <TextInput
                style={styles.importInput}
                value={importText}
                onChangeText={setImportText}
                placeholder="Pega aquí el contenido JSON..."
                placeholderTextColor={COLORS.textDisabled}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
              <TouchableOpacity style={styles.importButton} onPress={handleImportFromText}>
                <Text style={styles.importButtonText}>Importar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Información</Text>
          
          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={24} color={COLORS.primary} />
            <Text style={styles.infoText}>
              Pro Ovulation Soccer v1.0{'\n'}
              Todos los datos se guardan localmente en tu dispositivo.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Zona de peligro</Text>
          
          <TouchableOpacity
            style={[styles.option, styles.dangerOption]}
            onPress={handleClearAll}
          >
            <View style={styles.optionLeft}>
              <Ionicons name="trash" size={24} color={COLORS.error} />
              <View style={styles.optionText}>
                <Text style={[styles.optionTitle, styles.dangerText]}>
                  Borrar todos los datos
                </Text>
                <Text style={styles.optionDescription}>
                  Esta acción no se puede deshacer
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.error} />
          </TouchableOpacity>
        </View>

        <View style={styles.statsBox}>
          <Text style={styles.statsTitle}>Estadísticas</Text>
          <Text style={styles.statsText}>Total de perfiles: {profiles.length}</Text>
          <Text style={styles.statsText}>
            Total de observaciones:{' '}
            {profiles.reduce((sum, p) => sum + p.observaciones.length, 0)}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  optionText: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  dangerOption: {
    borderColor: COLORS.error + '33',
  },
  dangerText: {
    color: COLORS.error,
  },
  infoBox: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  statsBox: {
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 8,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  statsText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  importInputContainer: {
    marginTop: 8,
    backgroundColor: COLORS.surfaceLight,
    padding: 12,
    borderRadius: 12,
  },
  importInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 12,
    color: COLORS.textPrimary,
    minHeight: 120,
    fontFamily: 'monospace',
  },
  importButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  importButtonText: {
    color: COLORS.background,
    fontSize: 14,
    fontWeight: 'bold',
  },
});
