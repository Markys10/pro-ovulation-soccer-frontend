import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useProfileStore } from '../store/useProfileStore';
import { scoreForTarget } from '../utils/cycle_engine';
import { COLORS, getCategoryColor, getCategoryName } from '../constants/theme';
import { formatDateES } from '../utils/dateFormat';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const { width } = Dimensions.get('window');

export default function Index() {
  const router = useRouter();
  const { profiles, reorderProfiles } = useProfileStore();
  const today = new Date();
  const [isReordering, setIsReordering] = useState(false);

  // Ordenar alfabéticamente o por orden personalizado
  const sortedProfiles = useMemo(() => {
    const sorted = [...profiles].sort((a, b) => {
      // Si tienen orden personalizado, usar ese
      if (a.order !== undefined && b.order !== undefined) {
        return a.order - b.order;
      }
      // Si no, orden alfabético
      return a.nombre.localeCompare(b.nombre, 'es');
    });
    return sorted;
  }, [profiles]);

  const profilesWithPredictions = useMemo(() => {
    return sortedProfiles.map(profile => {
      const obsDates = profile.observaciones.map(o => o.fecha);
      const prediction = scoreForTarget(obsDates, today);
      
      if (!prediction) {
        return {
          ...profile,
          prediction: { regla: 0.25, perrisima: 0.25, horny: 0.25, nifunifa: 0.25 },
          mainCategory: 'nifunifa' as const,
          confidence: 0.25,
        };
      }
      
      // Prioridad: Perrísima > Horny > Ni fu ni fa > Regla
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
      
      const confidence = maxProb;

      return {
        ...profile,
        prediction,
        mainCategory,
        confidence,
      };
    });
  }, [sortedProfiles]);

  const handleSortAlphabetically = async () => {
    const alphabeticallySorted = [...profiles].sort((a, b) => 
      a.nombre.localeCompare(b.nombre, 'es')
    );
    await reorderProfiles(alphabeticallySorted);
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.brandingRow}>
            <View style={styles.titleButton}>
              <Image 
                source={require('../assets/images/titulo.png')} 
                style={styles.titleImage}
                resizeMode="contain"
              />
            </View>
            <View style={styles.logoButton}>
              <Image 
                source={require('../assets/images/logo.png')} 
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
          </View>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => router.push('/calendar')}
            >
              <Ionicons name="calendar" size={24} color={COLORS.primary} />
              <Text style={styles.headerButtonText}>Hoe Tracker</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => router.push('/add-profile')}
            >
              <Ionicons name="add-circle" size={24} color={COLORS.primary} />
              <Text style={styles.headerButtonText}>Añadir Hoe al Roster</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerButtonSmall}
              onPress={handleSortAlphabetically}
            >
              <Ionicons name="swap-vertical" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerButtonSmall}
              onPress={() => router.push('/settings')}
            >
              <Ionicons name="settings" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.dateContainer}>
          <Image 
            source={require('../assets/images/roster.png')} 
            style={styles.rosterImage}
            resizeMode="contain"
          />
          <Text style={styles.dateText}>
            {formatDateES(today)}
          </Text>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {profilesWithPredictions.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={80} color={COLORS.textDisabled} />
              <Text style={styles.emptyText}>No hay perfiles en el roster</Text>
              <Text style={styles.emptySubtext}>
                Toca "Añadir Hoe al Roster" para empezar
              </Text>
            </View>
          ) : (
            profilesWithPredictions.map(profile => (
              <TouchableOpacity
                key={profile.id}
                style={styles.profileCard}
                onPress={() => router.push(`/profile/${profile.id}`)}
              >
                <View style={styles.compactProfileRow}>
                  {profile.foto ? (
                    <Image source={{ uri: profile.foto }} style={styles.profileImage} />
                  ) : (
                    <View style={[styles.profileImage, styles.profileImagePlaceholder]}>
                      <Ionicons name="person" size={32} color={COLORS.textSecondary} />
                    </View>
                  )}
                  <View style={styles.profileInfo}>
                    <Text 
                      style={[
                        styles.profileName,
                        { color: getCategoryColor(profile.mainCategory) }
                      ]}
                    >
                      {profile.nombre}
                    </Text>
                    {profile.edad && (
                      <Text style={styles.profileAge}>{profile.edad} años</Text>
                    )}
                    <View style={styles.observationsBadge}>
                      <Ionicons name="water" size={12} color={COLORS.textSecondary} />
                      <Text style={styles.observationsText}>
                        {profile.observaciones.length} registros
                      </Text>
                    </View>
                  </View>
                  <View style={styles.statusContainer}>
                    <Text 
                      style={[
                        styles.statusText,
                        { color: getCategoryColor(profile.mainCategory) }
                      ]}
                    >
                      {getCategoryName(profile.mainCategory)}
                    </Text>
                    <Text 
                      style={[
                        styles.statusPercentage,
                        { color: getCategoryColor(profile.mainCategory) }
                      ]}
                    >
                      {Math.round(profile.confidence * 100)}%
                    </Text>
                  </View>
                  <Ionicons 
                    name="chevron-forward" 
                    size={24} 
                    color={COLORS.textSecondary} 
                  />
                </View>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  brandingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleButton: {
    flex: 1,
    marginRight: 8,
  },
  titleImage: {
    width: 240,
    height: 50,
  },
  logoButton: {
    width: 50,
    height: 50,
  },
  logoImage: {
    width: 50,
    height: 50,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  headerButtonSmall: {
    backgroundColor: COLORS.surface,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerButtonText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  dateContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
  },
  rosterImage: {
    width: 120,
    height: 30,
    marginBottom: 4,
  },
  dateText: {
    fontSize: 14,
    color: COLORS.textSecondary,
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
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    color: COLORS.textSecondary,
    marginTop: 16,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textDisabled,
    marginTop: 8,
  },
  profileCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  compactProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 12,
  },
  profileImagePlaceholder: {
    backgroundColor: COLORS.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  profileAge: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  observationsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  observationsText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  statusContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    minWidth: 70,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 3,
    textAlign: 'center',
  },
  statusPercentage: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});