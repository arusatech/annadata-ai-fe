import { Preferences } from '@capacitor/preferences';

export const capacitorPreferencesDetector = {
    type: 'languageDetector',
    async: true,
    detect: async (callback: (lng: string) => void) => {
        try {
            const { value } = await Preferences.get({ key: 'language' });
            const lng = value || 'en';
            callback(lng);
        } catch (error) {
            console.error('Error detecting language from Preferences:', error);
            callback('en');
        }
    },
    init: () => {},
    cacheUserLanguage: async (lng: string) => {
        try {
            await Preferences.set({ key: 'language', value: lng });
        } catch (error) {
            console.error('Error saving language to Preferences:', error);
        }
    },
};
