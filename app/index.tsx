import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useProfileStore } from '../store/useProfileStore';
import { predictForDate, PredictionResult } from '../utils/api';
import { COLORS } from '../constants/theme';
import { formatDateES } from '../utils/dateFormat';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const { width } = Dimensions.get('window');

interface ProfileWithPrediction {
  id: string;
  nombre: string;
  edad?: number;
  foto?: string;
  observaciones: any[];
  createdAt: string;
  prediction: PredictionResult | null;
  iconSource: any;
  isLoading: boolean;
}

// Mapeo de iconos
const ICON_SOURCES = {
  regla: require('../assets/images/regla.png'),
  perrisima: require('../assets/images/perrisima.png'),
  horny: require('../assets/images/horny.png'),
  nifunifa: require('../assets/images/nifunifa.png'),
};

// Función para determinar qué icono mostrar según la lógica del manual
function getIconForPrediction(prediction: PredictionResult | null): keyof typeof ICON_SOURCES {
  if (!prediction) return 'nifunifa';
  
  const { cats } = prediction;
  const sexual_prob = cats.sexual_prob || 0;
  const regla = cats.regla || 0;
  const nifunifa = cats.nifunifa || 0;
  const perrisima = cats.perrisima || 0;
  const horny = cats.horny || 0;
  
  // Si sexual_prob > max(regla, nifunifa)
  if (sexual_prob > Math.max(regla, nifunifa)) {
    // Si perrisima >= horny -> perrisima, else -> horny
    return perrisima >= horny ? 'perrisima' : 'horny';
  }
  
  // Si regla >= nifunifa -> regla, else -> nifunifa
  return regla >= nifunifa ? 'regla' : 'nifunifa';
}

export default function Index() {
  const router = useRouter();
  const profiles = useProfileStore(state => state.profiles);
  const updateProfileOrder = useProfileStore(state => state.updateProfileOrder);
  const today = new Date();
  const [profilesWithPredictions, setProfilesWithPredictions] = useState<ProfileWithPrediction[]>([]);
  const [isLoadingPredictions, setIsLoadingPredictions] = useState(true);

  // Cargar predicciones para todos los perfiles
  useEffect(() => {
    const loadPredictions = async () => {
      setIsLoadingPredictions(true);
      
      // Ordenar alfabéticamente por nombre
      const sortedProfiles = [...profiles].sort((a, b) => 
        a.nombre.localeCompare(b.nombre, 'es')
      );

      const profilesWithPreds: ProfileWithPrediction[] = await Promise.all(
        sortedProfiles.map(async (profile) => {
          let prediction: PredictionResult | null = null;
          
          if (profile.observaciones.length > 0) {
            const obs_dates = profile.observaciones.map(o => o.fecha);
            const certain_dates = profile.observaciones
              .filter(o => o.certain !== false)
              .map(o => o.fecha);
            
            prediction = await predictForDate(
              obs_dates,
              today.toISOString().split('T')[0],
              certain_dates
            );
          }
          
          const iconSource = ICON_SOURCES[getIconForPrediction(prediction)];
          
          return {
            ...profile,
            prediction,
            iconSource,
            isLoading: false,
          };
        })
      );

      setProfilesWithPredictions(profilesWithPreds);
      setIsLoadingPredictions(false);
    };

    loadPredictions();
  }, [profiles]);

  const renderProfileItem = ({ item, drag, isActive }: RenderItemParams<ProfileWithPrediction>) => {
    const prediction = item.prediction;
    const reliability_color = prediction?.reliability_color || 'red';
    const reliability_pct = prediction?.reliability_pct || 0;
    const sexual_prob = prediction?.cats.sexual_prob || 0;
    
    // Color del borde según reliability
    const reliabilityBorderColor = 
      reliability_color === 'green' ? '#4CAF50' :
      reliability_color === 'yellow' ? '#FFC107' : '#F44336';

    return (
      <TouchableOpacity
        style={[
          styles.profileCard,
          { borderColor: reliabilityBorderColor, borderWidth: 2 },
          isActive && styles.profileCardActive
        ]}
        onPress={() => router.push(`/profile/${item.id}`)}
        onLongPress={drag}
        delayLongPress={1000}
      >
        <View style={styles.compactProfileRow}>
          {item.foto ? (
            <Image source={{ uri: item.foto }} style={styles.profileImage} />
          ) : (
            <View style={[styles.profileImage, styles.profileImagePlaceholder]}>
              <Ionicons name="person" size={32} color={COLORS.textSecondary} />
            </View>
          )}
          
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{item.nombre}</Text>
            {item.edad && (
              <Text style={styles.profileAge}>{item.edad} años</Text>
            )}
            <View style={styles.observationsBadge}>
              <Ionicons name="water" size={12} color={COLORS.textSecondary} />
              <Text style={styles.observationsText}>
                {item.observaciones.length} registros
              </Text>
            </View>
          </View>

          <View style={styles.statusContainer}>
            <Image source={item.iconSource} style={styles.statusIcon} />
            <Text style={[styles.statusPercentage, { color: reliabilityBorderColor }]}>
              {Math.round(sexual_prob * 100)}%
            </Text>
            <Text style={styles.reliabilityText}>
              Conf: {Math.round(reliability_pct)}%
            </Text>
          </View>
          
          <Ionicons 
            name="chevron-forward" 
            size={24} 
            color={COLORS.textSecondary} 
          />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.brandingRow}>
            <Image 
              source={require('../assets/images/titulo.png')} 
              style={styles.titleImage}
              resizeMode="contain"
            />
            <Image 
              source={require('../assets/images/logo.png')} 
              style={styles.logoImage}
              resizeMode="contain"
            />
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

        {isLoadingPredictions ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Cargando predicciones...</Text>
          </View>
        ) : profilesWithPredictions.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={80} color={COLORS.textDisabled} />
            <Text style={styles.emptyText}>No hay perfiles en el roster</Text>
            <Text style={styles.emptySubtext}>
              Toca "Añadir Hoe al Roster" para empezar
            </Text>
          </View>
        ) : (
          <DraggableFlatList
            data={profilesWithPredictions}
            renderItem={renderProfileItem}
            keyExtractor={(item) => item.id}
            onDragEnd={({ data }) => {
              setProfilesWithPredictions(data);
              // Actualizar el orden en el store
              updateProfileOrder(data.map(p => p.id));
            }}
            contentContainerStyle={styles.scrollContent}
          />
        )}
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
  titleImage: {
    width: 240,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
  scrollContent: {
    padding: 16,
  },
  emptyState: {
    flex: 1,
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
  },
  profileCardActive: {
    backgroundColor: COLORS.surfaceLight,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
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
  statusIcon: {
    width: 50,
    height: 50,
    marginBottom: 4,
  },
  statusPercentage: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  reliabilityText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
});
