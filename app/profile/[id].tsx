import React, { useState, useMemo, useEffect } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Calendar } from 'react-native-calendars';
import { useProfileStore } from '../../store/useProfileStore';
import { predictForDate as predictForDateAPI, suggestClusterFills, PredictionResult } from '../../utils/api';
import { COLORS } from '../../constants/theme';
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
  const [newObservationDate, setNewObservationDate] = useState(new Date().toISOString().split('T')[0]);
  const [showFillModal, setShowFillModal] = useState(false);
  const [suggestedFills, setSuggestedFills] = useState<string[]>([]);
  const [pendingObservationDate, setPendingObservationDate] = useState<string | null>(null);
  const [todayPrediction, setTodayPrediction] = useState<PredictionResult | null>(null);
  const [isLoadingPrediction, setIsLoadingPrediction] = useState(true);

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Perfil no encontrado</Text>
      </SafeAreaView>
    );
  }

  // Cargar predicción del backend
  useEffect(() => {
    const loadPrediction = async () => {
      setIsLoadingPrediction(true);
      if (profile.observaciones.length > 0) {
        const obs_dates = profile.observaciones.map(o => o.fecha);
        const certain_dates = profile.observaciones
          .filter(o => o.certain !== false)
          .map(o => o.fecha);
        
        const prediction = await predictForDateAPI(
          obs_dates,
          new Date().toISOString().split('T')[0],
          certain_dates
        );
        setTodayPrediction(prediction);
      }
      setIsLoadingPrediction(false);
    };

    loadPrediction();
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
    Alert.alert(
      '¿Eliminar perfil?',
      `¿Estás seguro de que quieres eliminar a ${profile.nombre}? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            await deleteProfile(profile.id);
            router.back();
          },
        },
      ]
    );
  };

  const handleAddObservation = async () => {
    // Primero añadimos la observación seleccionada
    setPendingObservationDate(newObservationDate);
    
    // Obtener todas las fechas actuales + la nueva
    const currentDates = profile.observaciones.map(o => o.fecha);
    const allDates = [...currentDates, newObservationDate];
    
    // Verificar si hay sugerencias de relleno
    const suggestions = await suggestClusterFills(allDates);
    
    if (suggestions.length > 0) {
      // Mostrar modal de confirmación
      setSuggestedFills(suggestions);
      setShowFillModal(true);
      setShowDatePicker(false);
    } else {
      // No hay sugerencias, añadir directamente
      await addObservation(profile.id, { fecha: newObservationDate, certain: true });
      setShowDatePicker(false);
      Alert.alert('Éxito', 'Observación añadida correctamente');
    }
  };

  const handleConfirmFills = async () => {
    // Añadir la observación original
    if (pendingObservationDate) {
      await addObservation(profile.id, { fecha: pendingObservationDate, certain: true });
    }
    
    // Añadir todas las sugerencias
    for (const fecha of suggestedFills) {
      await addObservation(profile.id, { fecha, certain: true });
    }
    
    setShowFillModal(false);
    setPendingObservationDate(null);
    setSuggestedFills([]);
    Alert.alert('Éxito', `Se añadieron ${suggestedFills.length + 1} observaciones`);
  };

  const handleRejectFills = async () => {
    // Solo añadir la observación original
    if (pendingObservationDate) {
      await addObservation(profile.id, { fecha: pendingObservationDate, certain: true });
    }
    
    setShowFillModal(false);
    setPendingObservationDate(null);
    setSuggestedFills([]);
    Alert.alert('Éxito', 'Observación añadida correctamente');
  };

  const handleDeleteObservation = (fecha: string) => {
    Alert.alert('¿Eliminar observación?', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => deleteObservation(profile.id, fecha),
      },
    ]);
  };

  // Marcar fechas en el calendario
  const markedDates = useMemo(() => {
    const marked: any = {};
    profile.observaciones.forEach(obs => {
      marked[obs.fecha] = {
        selected: true,
        selectedColor: COLORS.regla,
      };
    });
    return marked;
  }, [profile.observaciones]);

  const getMainCategoryName = () => {
    if (!todayPrediction) return 'Sin datos';
    const cats = todayPrediction.cats;
    const sexual_prob = cats.sexual_prob || 0;
    const regla = cats.regla || 0;
    const nifunifa = cats.nifunifa || 0;
    const perrisima = cats.perrisima || 0;
    const horny = cats.horny || 0;
    
    if (sexual_prob > Math.max(regla, nifunifa)) {
      return perrisima >= horny ? 'Perrísima' : 'Horny';
    }
    return regla >= nifunifa ? 'Regla' : 'Ni fu ni fa';
  };

  const getMainCategoryColor = () => {
    if (!todayPrediction) return COLORS.textSecondary;
    const name = getMainCategoryName();
    if (name === 'Perrísima') return COLORS.perrisima;
    if (name === 'Horny') return COLORS.horny;
    if (name === 'Regla') return COLORS.regla;
    return COLORS.nifunifa;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Image 
          source={require('../../assets/images/configuracion.png')} 
          style={styles.titleImage}
          resizeMode="contain"
        />
        <TouchableOpacity onPress={handleDeleteProfile} style={styles.deleteButton}>
          <Ionicons name="trash" size={24} color={COLORS.error} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
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

        {isLoadingPrediction ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Cargando predicción...</Text>
          </View>
        ) : todayPrediction && (
          <View style={styles.predictionCard}>
            <Text style={styles.sectionTitle}>Predicción de hoy</Text>
            <View
              style={[
                styles.mainCategoryBadge,
                { backgroundColor: getMainCategoryColor() },
              ]}
            >
              <Text style={styles.mainCategoryText}>
                {getMainCategoryName()}
              </Text>
            </View>
            <View style={styles.probabilitiesGrid}>
              <View style={styles.probabilityBox}>
                <Text style={styles.probabilityLabel}>Regla</Text>
                <Text style={styles.probabilityValue}>
                  {Math.round(todayPrediction.cats.regla * 100)}%
                </Text>
              </View>
              <View style={styles.probabilityBox}>
                <Text style={styles.probabilityLabel}>Perrísima</Text>
                <Text style={styles.probabilityValue}>
                  {Math.round(todayPrediction.cats.perrisima * 100)}%
                </Text>
              </View>
              <View style={styles.probabilityBox}>
                <Text style={styles.probabilityLabel}>Horny</Text>
                <Text style={styles.probabilityValue}>
                  {Math.round(todayPrediction.cats.horny * 100)}%
                </Text>
              </View>
              <View style={styles.probabilityBox}>
                <Text style={styles.probabilityLabel}>Ni fu ni fa</Text>
                <Text style={styles.probabilityValue}>
                  {Math.round(todayPrediction.cats.nifunifa * 100)}%
                </Text>
              </View>
            </View>
            <View style={styles.reliabilityContainer}>
              <Text style={styles.reliabilityLabel}>Fiabilidad:</Text>
              <Text style={[
                styles.reliabilityValue,
                { color: todayPrediction.reliability_color === 'green' ? '#4CAF50' :
                         todayPrediction.reliability_color === 'yellow' ? '#FFC107' : '#F44336' }
              ]}>
                {Math.round(todayPrediction.reliability_pct)}%
              </Text>
            </View>
          </View>
        )}

        <View style={styles.observationsSection}>
          <View style={styles.observationsHeader}>
            <Text style={styles.sectionTitle}>Observaciones de sangrado</Text>
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
              <Text style={styles.emptySubtext}>
                Añade fechas de sangrado para mejorar las predicciones
              </Text>
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

      {/* Modal con Calendario */}
      <Modal visible={showDatePicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Seleccionar fecha de sangrado</Text>
            <Calendar
              onDayPress={(day) => setNewObservationDate(day.dateString)}
              markedDates={{
                ...markedDates,
                [newObservationDate]: {
                  selected: true,
                  selectedColor: COLORS.primary,
                },
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
            />
            <Text style={styles.selectedDateText}>Fecha seleccionada: {newObservationDate}</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setShowDatePicker(false)}
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

      {/* Modal de confirmación de relleno */}
      <Modal visible={showFillModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Días intermedios detectados</Text>
            <Text style={styles.modalText}>
              Se detectaron {suggestedFills.length} días intermedios entre tus observaciones.
            </Text>
            <Text style={styles.modalText}>
              ¿Quieres añadirlos como días de sangrado confirmados?
            </Text>
            <View style={styles.suggestedDatesList}>
              {suggestedFills.map((fecha, index) => (
                <Text key={index} style={styles.suggestedDate}>
                  • {formatDateFullES(new Date(fecha + 'T12:00:00'))}
                </Text>
              ))}
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={handleRejectFills}
              >
                <Text style={styles.modalButtonText}>No, gracias</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmButton]}
                onPress={handleConfirmFills}
              >
                <Text style={[styles.modalButtonText, styles.confirmButtonText]}>Sí, añadir</Text>
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
  titleImage: { width: 180, height: 40 },
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
  loadingContainer: { alignItems: 'center', paddingVertical: 24 },
  loadingText: { marginTop: 12, fontSize: 14, color: COLORS.textSecondary },
  predictionCard: { backgroundColor: COLORS.surface, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: 12 },
  mainCategoryBadge: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, alignItems: 'center', marginBottom: 16 },
  mainCategoryText: { color: COLORS.background, fontSize: 16, fontWeight: 'bold' },
  probabilitiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  probabilityBox: { flex: 1, minWidth: '45%', backgroundColor: COLORS.surfaceLight, padding: 12, borderRadius: 8, alignItems: 'center' },
  probabilityLabel: { fontSize: 11, color: COLORS.textSecondary, marginBottom: 4 },
  probabilityValue: { fontSize: 18, fontWeight: 'bold', color: COLORS.textPrimary },
  reliabilityContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12, gap: 8 },
  reliabilityLabel: { fontSize: 14, color: COLORS.textSecondary },
  reliabilityValue: { fontSize: 16, fontWeight: 'bold' },
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
  errorText: { color: COLORS.error, fontSize: 16, textAlign: 'center', marginTop: 40 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.8)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalContent: { backgroundColor: COLORS.surface, borderRadius: 12, padding: 24, width: '100%', maxWidth: 400, maxHeight: '90%' },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.textPrimary, marginBottom: 16 },
  modalText: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 12 },
  selectedDateText: { fontSize: 14, color: COLORS.textPrimary, marginTop: 16, marginBottom: 16, textAlign: 'center' },
  suggestedDatesList: { marginVertical: 12, paddingLeft: 8 },
  suggestedDate: { fontSize: 14, color: COLORS.textPrimary, marginBottom: 4 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalButton: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  modalCancelButton: { backgroundColor: COLORS.surfaceLight, borderWidth: 1, borderColor: COLORS.border },
  modalConfirmButton: { backgroundColor: COLORS.primary },
  modalButtonText: { fontSize: 14, fontWeight: 'bold', color: COLORS.textPrimary },
  confirmButtonText: { color: COLORS.background },
});
