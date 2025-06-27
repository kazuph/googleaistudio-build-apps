import { useState, useCallback, useEffect, useRef } from 'react';
import { WorkoutData, WorkoutStorage, MetricData, BikeServiceData } from '../types';

const STORAGE_KEY = 'fitness-bike-workout-data';
const USER_SETTINGS_KEY = 'fitness-bike-user-settings';

export const useWorkoutData = (currentData: BikeServiceData, isMonitoring: boolean) => {
  const [workoutData, setWorkoutData] = useState<WorkoutData>({
    time: [],
    speed: [],
    power: [],
    cadence: [],
    distance: [],
  });

  const [workoutStorage, setWorkoutStorage] = useState<WorkoutStorage>({
    totalDistance: 0,
    dailyRecords: {},
    monthlyTotals: {},
  });

  const [metrics, setMetrics] = useState<MetricData>({
    speed: 0,
    cadence: 0,
    power: 0,
    calories: 0,
    sessionDistance: 0,
    totalDistance: 0,
    duration: 0,
    resistance: 0,
  });

  const [userWeight, setUserWeight] = useState(70); // kg
  const sessionStartTime = useRef<number | null>(null);
  const lastDistanceUpdateTime = useRef<number | null>(null);
  const lastTotalDistanceUpdate = useRef(0);

  // Load stored data on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsedData = JSON.parse(stored);
        setWorkoutStorage(parsedData);
        setMetrics(prev => ({ ...prev, totalDistance: parsedData.totalDistance }));
      }

      const userSettings = localStorage.getItem(USER_SETTINGS_KEY);
      if (userSettings) {
        const settings = JSON.parse(userSettings);
        setUserWeight(settings.weight || 70);
      }
    } catch (error) {
      console.error('Failed to load stored data:', error);
    }
  }, []);

  // Save data whenever workoutStorage changes
  const saveStoredData = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workoutStorage));
    } catch (error) {
      console.error('Failed to save data:', error);
    }
  }, [workoutStorage]);

  useEffect(() => {
    saveStoredData();
  }, [saveStoredData]);

  // Start session timer
  useEffect(() => {
    if (isMonitoring && !sessionStartTime.current) {
      sessionStartTime.current = Date.now();
    } else if (!isMonitoring) {
      sessionStartTime.current = null;
    }
  }, [isMonitoring]);

  // Calculate distance from speed
  const calculateDistanceFromSpeed = useCallback((speed: number) => {
    const now = Date.now();
    if (!lastDistanceUpdateTime.current) {
      lastDistanceUpdateTime.current = now;
      return 0;
    }

    const timeDiffHours = (now - lastDistanceUpdateTime.current) / (1000 * 60 * 60);
    const distanceKm = speed * timeDiffHours;
    const distanceMeters = distanceKm * 1000;

    lastDistanceUpdateTime.current = now;
    return distanceMeters;
  }, []);

  // Calculate calories burned
  const calculateCalories = useCallback((speed: number, cadence: number, duration: number) => {
    // Simple calculation based on MET values
    const met = Math.max(4, Math.min(16, speed * 0.5 + cadence * 0.1));
    const hours = duration / 3600;
    return met * userWeight * hours;
  }, [userWeight]);

  // Update metrics based on current data
  useEffect(() => {
    if (!isMonitoring) return;

    const now = Date.now();
    const startTime = sessionStartTime.current || now;
    const duration = Math.max(0, (now - startTime) / 1000);

    const speed = currentData.speed || 0;
    const cadence = currentData.cadence || 0;
    const power = currentData.power || 0;
    const resistance = currentData.resistance || 0;

    // Calculate session distance
    const distanceIncrement = calculateDistanceFromSpeed(speed);
    
    setMetrics(prev => {
      const newSessionDistance = prev.sessionDistance + distanceIncrement;
      const calories = calculateCalories(speed, cadence, duration);

      return {
        speed,
        cadence,
        power,
        resistance,
        calories,
        sessionDistance: newSessionDistance,
        totalDistance: prev.totalDistance,
        duration,
      };
    });

    // Add data point to workout data
    setWorkoutData(prev => ({
      time: [...prev.time, duration],
      speed: [...prev.speed, speed],
      power: [...prev.power, power],
      cadence: [...prev.cadence, cadence],
      distance: [...prev.distance, metrics.sessionDistance],
    }));

  }, [currentData, isMonitoring, calculateDistanceFromSpeed, calculateCalories, metrics.sessionDistance]);

  // Add distance to total when session ends
  const addDistanceToTotal = useCallback((sessionDistanceMeters: number) => {
    if (sessionDistanceMeters > 0) {
      const today = new Date().toISOString().split('T')[0];
      
      setWorkoutStorage(prev => {
        const newStorage = { ...prev };
        
        // Add to total distance
        newStorage.totalDistance += sessionDistanceMeters;
        
        // Update daily records
        if (!newStorage.dailyRecords[today]) {
          newStorage.dailyRecords[today] = {
            distance: 0,
            duration: 0,
            sessions: 0,
          };
        }
        
        newStorage.dailyRecords[today].distance += sessionDistanceMeters;
        newStorage.dailyRecords[today].duration += metrics.duration;
        newStorage.dailyRecords[today].sessions += 1;
        
        // Update monthly totals
        const monthKey = today.substring(0, 7);
        if (!newStorage.monthlyTotals[monthKey]) {
          newStorage.monthlyTotals[monthKey] = 0;
        }
        newStorage.monthlyTotals[monthKey] += sessionDistanceMeters;
        
        return newStorage;
      });

      setMetrics(prev => ({
        ...prev,
        totalDistance: prev.totalDistance + sessionDistanceMeters,
      }));
    }
  }, [metrics.duration]);

  // Reset session data
  const resetSession = useCallback(() => {
    setWorkoutData({
      time: [],
      speed: [],
      power: [],
      cadence: [],
      distance: [],
    });
    
    setMetrics(prev => ({
      ...prev,
      calories: 0,
      sessionDistance: 0,
      duration: 0,
    }));
    
    sessionStartTime.current = null;
    lastDistanceUpdateTime.current = null;
  }, []);

  // Complete session (add to totals and reset)
  const completeSession = useCallback(() => {
    if (metrics.sessionDistance > 0) {
      addDistanceToTotal(metrics.sessionDistance);
    }
    resetSession();
  }, [metrics.sessionDistance, addDistanceToTotal, resetSession]);

  // Get today's workout data
  const getTodaysWorkout = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    return workoutStorage.dailyRecords[today] || { distance: 0, duration: 0, sessions: 0 };
  }, [workoutStorage.dailyRecords]);

  // Get monthly total
  const getMonthlyTotal = useCallback((yearMonth?: string) => {
    const monthKey = yearMonth || new Date().toISOString().substring(0, 7);
    return workoutStorage.monthlyTotals[monthKey] || 0;
  }, [workoutStorage.monthlyTotals]);

  // Reset all data
  const resetAllData = useCallback(() => {
    const newStorage: WorkoutStorage = {
      totalDistance: 0,
      dailyRecords: {},
      monthlyTotals: {},
    };
    
    setWorkoutStorage(newStorage);
    setMetrics(prev => ({
      ...prev,
      totalDistance: 0,
    }));
    
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Update user weight
  const updateUserWeight = useCallback((weight: number) => {
    setUserWeight(weight);
    const settings = { weight };
    localStorage.setItem(USER_SETTINGS_KEY, JSON.stringify(settings));
  }, []);

  return {
    workoutData,
    workoutStorage,
    metrics,
    userWeight,
    resetSession,
    completeSession,
    getTodaysWorkout,
    getMonthlyTotal,
    resetAllData,
    updateUserWeight,
  };
};