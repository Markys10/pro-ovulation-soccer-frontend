import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { useProfileStore } from '../store/useProfileStore';
import { predictForDate, getMainCategory } from '../utils/predictions';
import { COLORS, getCategoryColor, getCategoryName } from '../constants/theme';
import { formatDateShortES } from '../utils/dateFormat';

// Configurar calendario en español
LocaleConfig.locales['es'] = {
  monthNames: [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ],
  monthNamesShort: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
  dayNames: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
  dayNamesShort: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'],
  today: 'Hoy',
};
LocaleConfig.defaultLocale = 'es';

export default function CalendarScreen() {
  const router = useRouter();
  const profiles = useProfileStore(state => state.profiles);
  const profileOrder = useProfileStore(state => state.profileOrder);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  const predictionsForDate = useMemo(() => {
    const date = new Date(selectedDate + 'T12:00:00');
    
    // Ordenar perfiles según el orden personalizado, o alfabéticamente si no hay orden
    let sortedProfiles = [...profiles];
    if (profileOrder.length > 0) {
      sortedProfiles.sort((a, b) => {
        const indexA = profileOrder.indexOf(a.id);
        const indexB = profileOrder.indexOf(b.id);
        if (indexA === -1 && indexB === -1) return a.nombre.localeCompare(b.nombre, 'es');
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      });
    } else {
      sortedProfiles.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    }
    
    return sortedProfiles.map(profile => {
      const prediction = predictForDate(date, profile.observaciones);
      const mainCategory = getMainCategory(prediction);

      return {
        ...profile,
        prediction,
        mainCategory,
      };
    });
  }, [profiles, profileOrder, selectedDate]);

  const markedDates = useMemo(() => {
    const marks: any = {};
    marks[selectedDate] = {
      selected: true,
      selectedColor: COLORS.primary,
    };
    return marks;
  }, [selectedDate]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Image 
          source={require('../assets/images/hoetracker.png')} 
          style={styles.titleImage}
          resizeMode="contain"
        />
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.calendarContainer}>
        <Calendar
          current={selectedDate}
          onDayPress={(day) => setSelectedDate(day.dateString)}
          markedDates={markedDates}
          firstDay={1}
          theme={{
            calendarBackground: COLORS.surface,
            textSectionTitleColor: COLORS.textSecondary,
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
      </View>

      <View style={styles.dateHeader}>
        <Text style={styles.dateTitle}>
          {formatDateShortES(new Date(selectedDate + 'T12:00:00'))}
        </Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {predictionsForDate.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={60} color={COLORS.textDisabled} />
            <Text style={styles.emptyText}>No hay perfiles para mostrar</Text>
          </View>
        ) : (
          predictionsForDate.map(profile => (
            <View key={profile.id} style={styles.profileCard}>
              <View style={styles.profileHeader}>
                <Text style={styles.profileName}>{profile.nombre}</Text>
                <Text style={styles.reliability}>
                  Fiabilidad: {Math.round(Math.max(
                    profile.prediction.regla,
                    profile.prediction.perrisima,
                    profile.prediction.horny,
                    profile.prediction.nifunifa
                  ) * 100)}%
                </Text>
              </View>

              <View style={styles.probabilitiesRow}>
                <View style={styles.probabilityBoxCompact}>
                  <View style={[styles.colorIndicator, { backgroundColor: COLORS.regla }]} />
                  <Text style={styles.probabilityLabelCompact}>Regla</Text>
                  <Text style={styles.probabilityValueCompact}>
                    {Math.round(profile.prediction.regla * 100)}%
                  </Text>
                </View>
                <View style={styles.probabilityBoxCompact}>
                  <View style={[styles.colorIndicator, { backgroundColor: COLORS.perrisima }]} />
                  <Text style={styles.probabilityLabelCompact}>Perrísima</Text>
                  <Text style={styles.probabilityValueCompact}>
                    {Math.round(profile.prediction.perrisima * 100)}%
                  </Text>
                </View>
                <View style={styles.probabilityBoxCompact}>
                  <View style={[styles.colorIndicator, { backgroundColor: COLORS.horny }]} />
                  <Text style={styles.probabilityLabelCompact}>Horny</Text>
                  <Text style={styles.probabilityValueCompact}>
                    {Math.round(profile.prediction.horny * 100)}%
                  </Text>
                </View>
                <View style={styles.probabilityBoxCompact}>
                  <View style={[styles.colorIndicator, { backgroundColor: COLORS.nifunifa }]} />
                  <Text style={styles.probabilityLabelCompact}>Ni fu ni fa</Text>
                  <Text style={styles.probabilityValueCompact}>
                    {Math.round(profile.prediction.nifunifa * 100)}%
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}
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
  titleImage: {
    width: 160,
    height: 30,
  },
  calendarContainer: {
    backgroundColor: COLORS.surface,
    padding: 8,
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  calendar: {
    borderRadius: 8,
  },
  dateHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  dateTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    textTransform: 'capitalize',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: 12,
  },
  profileCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  profileName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  reliability: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  probabilitiesRow: {
    flexDirection: 'row',
    gap: 6,
  },
  probabilityBoxCompact: {
    flex: 1,
    backgroundColor: COLORS.surfaceLight,
    padding: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  colorIndicator: {
    width: 20,
    height: 3,
    borderRadius: 2,
    marginBottom: 6,
  },
  probabilityLabelCompact: {
    fontSize: 9,
    color: COLORS.textSecondary,
    marginBottom: 3,
    textAlign: 'center',
  },
  probabilityValueCompact: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
});
