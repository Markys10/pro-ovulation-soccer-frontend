import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Calendar } from 'react-native-calendars';
import { useProfileStore } from '../../store/useProfileStore';
import { scoreForTarget } from '../../utils/cycle_engine';
import { COLORS, getCategoryColor, getCategoryName } from '../../constants/theme';
import { formatDateFullES } from '../../utils/dateFormat';

export default function ProfileDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { profiles, updateProfile, deleteProfile, addObservation, deleteObservation } =
    useProfileStore();

  const profile = profiles.find(p => p.id === id);
  const [isEditing, setIsEditing] = useState(false);
  const [editedNombre, setEditedNombre] = useState(profile?.nombre || '');
  const [editedEdad, setEditedEdad] = useState(profile?.edad?.toString() || '');
  const [editedNotas, setEditedNotas] = useState(profile?.notas || '');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [useCalendar, setUseCalendar] = useState(true);
  const [newObservationDate, setNewObservationDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualDateInput, setManualDateInput] = useState('');

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Perfil no encontrado</Text>
      </SafeAreaView>
    );
  }

  const todayPrediction = useMemo(() => {
    const obsDates = profile.observaciones.map(o => o.fecha);
    const prediction = scoreForTarget(obsDates, new Date());
    
    if (!prediction) {
      return {
        regla: 0.25,
        perrisima: 0.25,
        horny: 0.25,
        nifunifa: 0.25,
        mainCategory: 'nifunifa' as const,
      };
    }

    const maxProb = Math.max(
      prediction.perrisima,
      prediction.horny,
      prediction.nifunifa,
      prediction.regla
    );

    let mainCategory: 'regla' | 'perrisima' | 'horny' | 'nifunifa';
    if (prediction.perrisima === maxProb) {
      mainCategory = 'perrisima';
    } else if (prediction.horny === maxProb) {
      mainCategory = 'horny';
    } else if (prediction.nifunifa === maxProb) {
      mainCategory = 'nifunifa';
    } else {
      mainCategory = 'regla';
    }

    return { ...prediction, mainCategory };
  }, [profile.observaciones]);

  const handleSaveEdit = async () => {
    if (!editedNombre.trim()) {
      Alert.alert('Error', 'El nombre no puede estar vacío');
      return;
    }

    await updateProfile(profile.id, {
      nombre: editedNombre.trim(),
      edad: editedEdad ? parseInt(editedEdad) : undefined,
      notas: editedNotas.trim() || undefined,
    });
    setIsEditing(false);
  };

  const handleChangePhoto = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert('Permiso requerido', 'Necesitas dar permiso para acceder a tus fotos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      await updateProfile(profile.id, {
        foto: `data:image/jpeg;base64,${result.assets[0].base64}`,
      });
    }
  };

  const handleDeleteProfile = () => {
    if (Platform.OS === 'web') {
      if (confirm(`¿Estás seguro de que quieres eliminar a ${profile.nombre}? Esta acción no se puede deshacer.`)) {
        deleteProfile(profile.id)
          .then(() => {
            router.replace('/');
          })
          .catch((error) => {
            alert('Error al eliminar el perfil');
            console.error(error);
          });
      }
    } else {
      Alert.alert(
        '¿Eliminar perfil?',
        `¿Estás seguro de que quieres eliminar a ${profile.nombre}? Esta acción no se puede deshacer.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Eliminar',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteProfile(profile.id);
                router.replace('/');
              } catch (error) {
                Alert.alert('Error', 'No se pudo eliminar el perfil');
                console.error(error);
              }
            },
          },
        ]
      );
    }
  };

  const parseManualDate = (input: string): string | null => {
    const cleaned = input.replace(/\D/g, '');
    
    if (cleaned.length === 8) {
      const day = cleaned.substring(0, 2);
      const month = cleaned.substring(2, 4);
      const year = cleaned.substring(4, 8);

      const date = new Date(`${year}-${month}-${day}`);
      if (!isNaN(date.getTime())) {
        return `${year}-${month}-${day}`;
      }
    }
    return null;
  };

  const handleAddObservation = async () => {
    let dateToAdd = newObservationDate;
    
    if (!useCalendar && manualDateInput) {
      const parsed = parseManualDate(manualDateInput);
      if (parsed) {
        dateToAdd = parsed;
      } else {
        if (Platform.OS === 'web') {
          alert('Formato de fecha inválido. Usa DDMMYYYY (ejemplo: 23082025)');
        } else {
          Alert.alert('Error', 'Formato de fecha inválido. Usa DDMMYYYY (ejemplo: 23082025)');
        }
        return;
      }
    }

    // -------------------------------
    // 🚀 NUEVO: sugerir auto-rellenar días intermedios
    // -------------------------------

    const sorted = profile.observaciones
      .slice()
      .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

    const newDateObj = new Date(dateToAdd + "T12:00:00");
    const intermediate: string[] = [];

    for (let i = 0; i < sorted.length; i++) {
      const obsDateObj = new Date(sorted[i].fecha + "T12:00:00");

      const daysDiff = Math.abs(
        Math.floor((newDateObj.getTime() - obsDateObj.getTime()) / (1000 * 60 * 60 * 24))
      );

      // Solo rellenamos huecos de 2 a 7 días (rango máximo de regla)
      if (daysDiff > 1 && daysDiff <= 7) {
        const start = newDateObj < obsDateObj ? newDateObj : obsDateObj;
        const end = newDateObj < obsDateObj ? obsDateObj : newDateObj;

        for (let d = 1; d < daysDiff; d++) {
          const intDate = new Date(start);
          intDate.setDate(start.getDate() + d);
          const iso = intDate.toISOString().split("T")[0];

          if (!profile.observaciones.some(o => o.fecha === iso)) {
            intermediate.push(iso);
          }
        }
      }
    }

    if (intermediate.length > 0) {
      const msg = `Hay ${intermediate.length} días sin registrar entre tus observaciones. ¿Quieres marcarlos también como días de regla?`;

      const addAll = async () => {
        for (const fecha of intermediate) {
          await addObservation(profile.id, { fecha });
        }
      };

      if (Platform.OS === "web") {
        if (confirm(msg)) {
          await addAll();
        }
      } else {
        await new Promise(resolve => {
          Alert.alert(
            "Auto-rellenar días",
            msg,
            [
              { text: "No", style: "cancel", onPress: resolve },
              {
                text: "Sí",
                onPress: async () => {
                  await addAll();
                  resolve(null);
                }
              }
            ]
          );
        });
      }
    }

    // Añadimos la observación principal
    await addObservation(profile.id, { fecha: dateToAdd });
    setShowDatePicker(false);
    setManualDateInput("");

    if (Platform.OS === "web") {
      alert("Observación añadida correctamente");
    } else {
      Alert.alert("Éxito", "Observación añadida correctamente");
    }
  };
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Image 
          source={require('../../assets/images/datadelahoe.png')} 
          style={styles.titleImage}
          resizeMode="contain"
        />
        <TouchableOpacity onPress={handleDeleteProfile} style={styles.deleteButton}>
          <Ionicons name="trash" size={24} color={COLORS.error} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        
        {/* FOTO */}
        <View style={styles.photoSection}>
          <TouchableOpacity onPress={handleChangePhoto}>
            {profile.foto ? (
              <Image source={{ uri: profile.foto }} style={styles.profileImage} />
            ) : (
              <View style={[styles.profileImage, styles.profileImagePlaceholder]}>
                <Ionicons name="person" size={60} color={COLORS.textSecondary} />
              </View>
            )}
            <View style={styles.cameraIconContainer}>
              <Ionicons name="camera" size={20} color={COLORS.background} />
            </View>
          </TouchableOpacity>
        </View>

        {/* INFO / EDIT */}
        {isEditing ? (
          <View style={styles.editSection}>
            <TextInput
              style={styles.editInput}
              value={editedNombre}
              onChangeText={setEditedNombre}
              placeholder="Nombre"
              placeholderTextColor={COLORS.textDisabled}
            />
            <TextInput
              style={styles.editInput}
              value={editedEdad}
              onChangeText={setEditedEdad}
              placeholder="Edad"
              placeholderTextColor={COLORS.textDisabled}
              keyboardType="number-pad"
            />
            <TextInput
              style={[styles.editInput, styles.editTextArea]}
              value={editedNotas}
              onChangeText={setEditedNotas}
              placeholder="Notas"
              placeholderTextColor={COLORS.textDisabled}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <View style={styles.editButtons}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => setIsEditing(false)}
              >
                <Text style={styles.buttonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.saveButton]}
                onPress={handleSaveEdit}
              >
                <Text style={styles.buttonText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.infoSection}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Nombre:</Text>
              <Text style={styles.infoValue}>{profile.nombre}</Text>
            </View>

            {profile.edad && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Edad:</Text>
                <Text style={styles.infoValue}>{profile.edad} años</Text>
              </View>
            )}

            {profile.notas && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Notas:</Text>
                <Text style={styles.infoValue}>{profile.notas}</Text>
              </View>
            )}

            <TouchableOpacity style={styles.editButton} onPress={() => setIsEditing(true)}>
              <Ionicons name="pencil" size={16} color={COLORS.primary} />
              <Text style={styles.editButtonText}>Editar data</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* PREDICCIÓN */}
        <View style={styles.predictionCard}>
          <Text style={styles.sectionTitle}>Predicción de hoy</Text>

          <View
            style={[
              styles.mainCategoryBadge,
              { backgroundColor: getCategoryColor(todayPrediction.mainCategory) },
            ]}
          >
            <Text style={styles.mainCategoryText}>{getCategoryName(todayPrediction.mainCategory)}</Text>
          </View>

          <View style={styles.probabilitiesRow}>
            <View style={styles.probabilityBoxCompact}>
              <Text style={styles.probabilityLabelCompact}>Regla</Text>
              <Text style={styles.probabilityValueCompact}>
                {Math.round(todayPrediction.regla * 100)}%
              </Text>
            </View>
            <View style={styles.probabilityBoxCompact}>
              <Text style={styles.probabilityLabelCompact}>Perrísima</Text>
              <Text style={styles.probabilityValueCompact}>
                {Math.round(todayPrediction.perrisima * 100)}%
              </Text>
            </View>
            <View style={styles.probabilityBoxCompact}>
              <Text style={styles.probabilityLabelCompact}>Horny</Text>
              <Text style={styles.probabilityValueCompact}>
                {Math.round(todayPrediction.horny * 100)}%
              </Text>
            </View>
            <View style={styles.probabilityBoxCompact}>
              <Text style={styles.probabilityLabelCompact}>Ni fu ni fa</Text>
              <Text style={styles.probabilityValueCompact}>
                {Math.round(todayPrediction.nifunifa * 100)}%
              </Text>
            </View>
          </View>

          <Text style={styles.expectedDay}>
            Día estimado del ciclo: {todayPrediction.expected_day}
          </Text>
        </View>

        {/* HISTORIAL */}
        <View style={styles.observationsSection}>
          <View style={styles.observationsHeader}>
            <Text style={styles.sectionTitle}>Historial de la sangrona</Text>
            <TouchableOpacity
              style={styles.addObservationButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Ionicons name="add-circle" size={24} color={COLORS.primary} />
              <Text style={styles.addObservationText}>Añadir Data</Text>
            </TouchableOpacity>
          </View>

          {profile.observaciones.length === 0 ? (
            <View style={styles.emptyObservations}>
              <Ionicons name="water-outline" size={40} color={COLORS.textDisabled} />
              <Text style={styles.emptyText}>No hay observaciones aún</Text>
              <Text style={styles.emptySubtext}>Añade fechas de sangrado para mejorar las predicciones</Text>
            </View>
          ) : (
            <View style={styles.observationsList}>
              {profile.observaciones
                .slice()
                .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
                .map((obs, index) => (
                  <View key={index} style={styles.observationItem}>
                    <View style={styles.observationLeft}>
                      <Ionicons name="water" size={20} color={COLORS.regla} />
                      <Text style={styles.observationDate}>
                        {formatDateFullES(new Date(obs.fecha + 'T12:00:00'))}
                      </Text>
                    </View>

                    <TouchableOpacity onPress={() => handleDeleteObservation(obs.fecha)}>
                      <Ionicons name="close-circle" size={24} color={COLORS.error} />
                    </TouchableOpacity>
                  </View>
                ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* MODAL AÑADIR SANGRADO */}
      <Modal visible={showDatePicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Añadir observación de sangrado</Text>

            {/* Calendario vs manual */}
            <View style={styles.dateMethodToggle}>
              <TouchableOpacity
                style={[styles.toggleButton, useCalendar && styles.toggleButtonActive]}
                onPress={() => setUseCalendar(true)}
              >
                <Ionicons 
                  name="calendar" 
                  size={16} 
                  color={useCalendar ? COLORS.background : COLORS.textSecondary}
                />
                <Text style={[styles.toggleButtonText, useCalendar && styles.toggleButtonTextActive]}>
                  Calendario
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.toggleButton, !useCalendar && styles.toggleButtonActive]}
                onPress={() => setUseCalendar(false)}
              >
                <Ionicons 
                  name="create" 
                  size={16} 
                  color={!useCalendar ? COLORS.background : COLORS.textSecondary}
                />
                <Text style={[styles.toggleButtonText, !useCalendar && styles.toggleButtonTextActive]}>
                  Manual
                </Text>
              </TouchableOpacity>
            </View>

            {/* Fecha */}
            {useCalendar ? (
              <Calendar
                current={newObservationDate}
                onDayPress={(day) => {
                  setNewObservationDate(day.dateString);
                }}
                markedDates={{
                  [newObservationDate]: { selected: true, selectedColor: COLORS.primary },
                  ...profile.observaciones.reduce((acc, obs) => {
                    acc[obs.fecha] = { marked: true, dotColor: COLORS.regla };
                    return acc;
                  }, {} as any),
                }}
                theme={{
                  backgroundColor: COLORS.surface,
                  calendarBackground: COLORS.surface,
                  textSectionTitleColor: COLORS.textPrimary,
                  selectedDayBackgroundColor: COLORS.primary,
                  selectedDayTextColor: COLORS.background,
                  todayTextColor: COLORS.primary,
                  dayTextColor: COLORS.textPrimary,
                  textDisabledColor: COLORS.textDisabled,
                  monthTextColor: COLORS.textPrimary,
                  arrowColor: COLORS.primary,
                }}
                style={styles.calendar}
              />
            ) : (
              <View style={styles.manualInputContainer}>
                <Text style={styles.manualInputLabel}>Introduce la fecha (DDMMYYYY):</Text>
                <TextInput
                  style={styles.dateInput}
                  value={manualDateInput}
                  onChangeText={setManualDateInput}
                  placeholder="23082025"
                  placeholderTextColor={COLORS.textDisabled}
                  keyboardType="number-pad"
                  maxLength={8}
                />
                <Text style={styles.manualInputHint}>Ejemplo: 23082025 = 23/08/2025</Text>
              </View>
            )}

            {/* Botones modal */}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => {
                  setShowDatePicker(false);
                  setManualDateInput('');
                }}
              >
                <Text style={styles.modalButtonText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmButton]}
                onPress={handleAddObservation}
              >
                <Text style={[styles.modalButtonText, styles.confirmButtonText]}>Añadir</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  backButton: { padding: 4 },
  deleteButton: { padding: 4 },
  titleImage: { width: 180, height: 30 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16 },
  photoSection: { alignItems: 'center', marginBottom: 24 },
  profileImage: { width: 120, height: 120, borderRadius: 60 },
  profileImagePlaceholder: { backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: COLORS.border },
  cameraIconContainer: { position: 'absolute', bottom: 0, right: 0, backgroundColor: COLORS.primary, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: COLORS.background },
  infoSection: { backgroundColor: COLORS.surface, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  infoRow: { marginBottom: 12 },
  infoLabel: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 4 },
  infoValue: { fontSize: 16, color: COLORS.textPrimary, fontWeight: '500' },
  editButton: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  editButtonText: { color: COLORS.primary, fontSize: 14, fontWeight: '600' },
  editSection: { backgroundColor: COLORS.surface, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  editInput: { backgroundColor: COLORS.surfaceLight, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: COLORS.textPrimary, marginBottom: 12 },
  editTextArea: { minHeight: 80, textAlignVertical: 'top' },
  editButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  button: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  cancelButton: { backgroundColor: COLORS.surfaceLight, borderWidth: 1, borderColor: COLORS.border },
  saveButton: { backgroundColor: COLORS.primary },
  buttonText: { fontSize: 14, fontWeight: 'bold', color: COLORS.textPrimary },
  predictionCard: { backgroundColor: COLORS.surface, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: 12 },
  mainCategoryBadge: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, alignItems: 'center', marginBottom: 16 },
  mainCategoryText: { color: COLORS.background, fontSize: 16, fontWeight: 'bold' },
  probabilitiesRow: { flexDirection: 'row', gap: 6 },
  probabilityBoxCompact: { flex: 1, backgroundColor: COLORS.surfaceLight, padding: 8, borderRadius: 8, alignItems: 'center' },
  probabilityLabelCompact: { fontSize: 9, color: COLORS.textSecondary, marginBottom: 3, textAlign: 'center' },
  probabilityValueCompact: { fontSize: 14, fontWeight: 'bold', color: COLORS.textPrimary },
  expectedDay: { fontSize: 12, color: COLORS.textSecondary, marginTop: 12, textAlign: 'center' },
  observationsSection: { backgroundColor: COLORS.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  observationsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  addObservationButton: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addObservationText: { color: COLORS.primary, fontSize: 14, fontWeight: '600' },
  emptyObservations: { alignItems: 'center', paddingVertical: 24 },
  emptyText: { fontSize: 16, color: COLORS.textSecondary, marginTop: 12 },
  emptySubtext: { fontSize: 12, color: COLORS.textDisabled, marginTop: 4, textAlign: 'center' },
  observationsList: { gap: 8 },
  observationItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.surfaceLight, padding: 12, borderRadius: 8 },
  observationLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  observationDate: { fontSize: 14, color: COLORS.textPrimary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalContent: { backgroundColor: COLORS.surface, borderRadius: 12, padding: 24, width: '100%', maxWidth: 500 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: 16 },
  dateMethodToggle: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  toggleButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, backgroundColor: COLORS.surfaceLight, borderWidth: 1, borderColor: COLORS.border },
  toggleButtonActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  toggleButtonText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  toggleButtonTextActive: { color: COLORS.background },
  calendar: { borderRadius: 8, marginBottom: 16 },
  manualInputContainer: { marginBottom: 16 },
  manualInputLabel: { fontSize: 14, color: COLORS.textPrimary, marginBottom: 8, fontWeight: '600' },
  manualInputHint: { fontSize: 12, color: COLORS.textSecondary, marginTop: 6, fontStyle: 'italic' },
  dateInput: { backgroundColor: COLORS.surfaceLight, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: COLORS.textPrimary },
  modalButtons: { flexDirection: 'row', gap: 12 },
  modalButton: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  modalCancelButton: { backgroundColor: COLORS.surfaceLight, borderWidth: 1, borderColor: COLORS.border },
  modalConfirmButton: { backgroundColor: COLORS.primary },
  modalButtonText: { fontSize: 14, fontWeight: 'bold', color: COLORS.textPrimary },
  confirmButtonText: { color: COLORS.background },
});
