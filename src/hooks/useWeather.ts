import { useState, useEffect, useCallback } from "react";

interface WeatherData {
  temperature: number;
  condition: string;
  icon: string;
  humidity: number;
  windSpeed: number;
  location: string;
}

export function useWeather() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getWeatherCondition = (code: number): { condition: string; icon: string } => {
    // WMO Weather interpretation codes
    if (code === 0) return { condition: "Clear sky", icon: "☀️" };
    if (code === 1) return { condition: "Mainly clear", icon: "🌤️" };
    if (code === 2) return { condition: "Partly cloudy", icon: "⛅" };
    if (code === 3) return { condition: "Overcast", icon: "☁️" };
    if (code >= 45 && code <= 48) return { condition: "Foggy", icon: "🌫️" };
    if (code >= 51 && code <= 55) return { condition: "Drizzle", icon: "🌧️" };
    if (code >= 56 && code <= 57) return { condition: "Freezing drizzle", icon: "🌧️" };
    if (code >= 61 && code <= 65) return { condition: "Rain", icon: "🌧️" };
    if (code >= 66 && code <= 67) return { condition: "Freezing rain", icon: "🌧️" };
    if (code >= 71 && code <= 77) return { condition: "Snow", icon: "❄️" };
    if (code >= 80 && code <= 82) return { condition: "Rain showers", icon: "🌦️" };
    if (code >= 85 && code <= 86) return { condition: "Snow showers", icon: "🌨️" };
    if (code === 95) return { condition: "Thunderstorm", icon: "⛈️" };
    if (code >= 96) return { condition: "Thunderstorm with hail", icon: "⛈️" };
    return { condition: "Unknown", icon: "🌡️" };
  };

  const fetchWeather = useCallback(async (latitude: number, longitude: number) => {
    try {
      // Fetch weather from Open-Meteo (free, no API key required)
      const weatherResponse = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`,
      );

      if (!weatherResponse.ok) throw new Error("Weather fetch failed");

      const weatherData = await weatherResponse.json();
      const current = weatherData.current;

      // Reverse geocode to get location name. Open-Meteo's geocoding API
      // only supports forward lookups (by name), so a lat/lon query 400s.
      // BigDataCloud's reverse-geocode-client endpoint is keyless and maps
      // coordinates → city.
      let locationName = "Your location";
      try {
        const geoResponse = await fetch(
          `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
        );
        if (geoResponse.ok) {
          const geoData = await geoResponse.json();
          locationName =
            geoData.city || geoData.locality || geoData.principalSubdivision || locationName;
        }
      } catch {
        /* keep the fallback label — a missing city name shouldn't break weather */
      }

      const { condition, icon } = getWeatherCondition(current.weather_code);

      setWeather({
        temperature: Math.round(current.temperature_2m),
        condition,
        icon,
        humidity: current.relative_humidity_2m,
        windSpeed: Math.round(current.wind_speed_10m),
        location: locationName,
      });
      setError(null);
    } catch (err) {
      console.error("Weather error:", err);
      setError("Could not fetch weather");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          fetchWeather(position.coords.latitude, position.coords.longitude);
        },
        (err) => {
          console.error("Geolocation error:", err);
          // Default to a location if geolocation fails
          setError("Location access denied");
          setLoading(false);
        },
        { timeout: 10000 },
      );
    } else {
      setError("Geolocation not supported");
      setLoading(false);
    }
  }, [fetchWeather]);

  return { weather, loading, error, refetch: fetchWeather };
}
