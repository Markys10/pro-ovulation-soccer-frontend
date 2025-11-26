import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Profile, Observation, ExportData } from '../types';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';

const STORAGE_KEY = '@pro_ovulation_soccer:profiles';

interface ProfileStore {
  profiles: Profile[];
  isLoading: boolean;
  
  // Acciones
  loadProfiles: () => Promise<void>;
  addProfile: (profile: Omit<Profile, 'id' | 'createdAt'>) => Promise<void>;
  updateProfile: (id: string, updates: Partial<Profile>) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  addObservation: (profileId: string, observation: Observation) => Promise<void>;
  deleteObservation: (profileId: string, fecha: string) => Promise<void>;
  reorderProfiles: (profiles: Profile[]) => Promise<void>;
  exportData: () => Promise<void>;
  importData: (data: string) => Promise<void>;
  clearAll: () => Promise<void>;
}

export const useProfileStore = create<ProfileStore>((set, get) => ({
  profiles: [],
  isLoading: false,

  loadProfiles: async () => {
    try {
      set({ isLoading: true });
      const data = await AsyncStorage.getItem(STORAGE_KEY);
      if (data) {
        const profiles = JSON.parse(data);
        set({ profiles, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('Error loading profiles:', error);
      set({ isLoading: false });
    }
  },

  addProfile: async (profileData) => {
    try {
      const existingProfiles = get().profiles;
      const maxOrder = existingProfiles.length > 0 
        ? Math.max(...existingProfiles.map(p => p.order || 0))
        : -1;
      
      const newProfile: Profile = {
        ...profileData,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        observaciones: profileData.observaciones || [],
        createdAt: new Date().toISOString(),
        order: maxOrder + 1,
      };

      const profiles = [...existingProfiles, newProfile];
      set({ profiles });
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
    } catch (error) {
      console.error('Error adding profile:', error);
      throw error;
    }
  },

  updateProfile: async (id, updates) => {
    const profiles = get().profiles.map((p) =>
      p.id === id ? { ...p, ...updates } : p
    );
    set({ profiles });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  },

  deleteProfile: async (id) => {
    try {
      const profiles = get().profiles.filter((p) => p.id !== id);
      set({ profiles });
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
      return true;
    } catch (error) {
      console.error('Error deleting profile:', error);
      throw error;
    }
  },

  addObservation: async (profileId, observation) => {
    const profiles = get().profiles.map((p) => {
      if (p.id === profileId) {
        // Evitar duplicados
        const exists = p.observaciones.some(o => o.fecha === observation.fecha);
        if (!exists) {
          return {
            ...p,
            observaciones: [...p.observaciones, observation].sort(
              (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime()
            ),
          };
        }
      }
      return p;
    });
    set({ profiles });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  },

  deleteObservation: async (profileId, fecha) => {
    try {
      const profiles = get().profiles.map((p) => {
        if (p.id === profileId) {
          return {
            ...p,
            observaciones: p.observaciones.filter(o => o.fecha !== fecha),
          };
        }
        return p;
      });
      set({ profiles });
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
      return true;
    } catch (error) {
      console.error('Error deleting observation:', error);
      throw error;
    }
  },

  reorderProfiles: async (reorderedProfiles) => {
    const profilesWithOrder = reorderedProfiles.map((p, index) => ({
      ...p,
      order: index,
    }));
    set({ profiles: profilesWithOrder });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profilesWithOrder));
  },

  exportData: async () => {
    try {
      const exportData: ExportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        profiles: get().profiles,
      };

      const jsonString = JSON.stringify(exportData, null, 2);
      const fileName = `pro_ovulation_backup_${new Date().toISOString().split('T')[0]}.json`;
      const fileUri = FileSystem.documentDirectory + fileName;

      await FileSystem.writeAsStringAsync(fileUri!, jsonString);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/json',
          dialogTitle: 'Exportar datos de Pro Ovulation Soccer',
        });
      } else {
        alert('La función de compartir no está disponible en este dispositivo');
      }
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Error al exportar los datos');
    }
  },

  importData: async (jsonString) => {
    try {
      const data: ExportData = JSON.parse(jsonString);
      
      if (!data.profiles || !Array.isArray(data.profiles)) {
        throw new Error('Formato de datos inválido');
      }

      set({ profiles: data.profiles });
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data.profiles));
      alert('Datos importados correctamente');
    } catch (error) {
      console.error('Error importing data:', error);
      alert('Error al importar los datos. Verifica que el archivo sea válido.');
    }
  },

  clearAll: async () => {
    set({ profiles: [] });
    await AsyncStorage.removeItem(STORAGE_KEY);
  },
}));
