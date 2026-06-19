import { useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion } from "framer-motion";
import { staggerItem, staggerContainer } from "@/components/ui/panel-shell";
import { MapPin, Loader2 } from "lucide-react";
import { useUserLocationSettings, MAJOR_CITIES } from "@/hooks/useUserLocationSettings";

export function LocationSettingsTab() {
  const {
    settings,
    isLoading,
    isSaving,
    updateLocation,
    updateTemperatureUnit,
    updatePrayerCalculationMethod,
  } = useUserLocationSettings();

  const [searchQuery, setSearchQuery] = useState("");

  const filteredCities = MAJOR_CITIES.filter(
    (c) =>
      c.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.country.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-6 text-center text-muted-foreground">Failed to load location settings</div>
    );
  }

  return (
    <motion.div
      className="p-3 md:p-4 space-y-4"
      variants={staggerContainer}
      initial="initial"
      animate="animate"
    >
      {/* Current Location */}
      <motion.div variants={staggerItem}>
        <GlassCard className="p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium text-base">Your Location</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Set your home city for accurate prayer times and weather
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
              <p className="text-sm text-muted-foreground mb-1">Current Location</p>
              <p className="text-lg font-semibold">
                {settings.city}, {settings.country}
              </p>
              <p className="text-xs text-muted-foreground mt-2">Timezone: {settings.timezone}</p>
              {settings.latitude && settings.longitude && (
                <p className="text-xs text-muted-foreground">
                  Coordinates: {settings.latitude.toFixed(4)}, {settings.longitude.toFixed(4)}
                </p>
              )}
            </div>

            {/* Quick City Selection */}
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">
                Quick Select Major Cities
              </Label>
              <Input
                placeholder="Search cities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="mb-3"
              />
              <ScrollArea className="h-48 border rounded-lg p-2">
                <div className="space-y-2">
                  {filteredCities.map((city) => (
                    <Button
                      key={`${city.city}-${city.country}`}
                      variant={
                        settings.city === city.city && settings.country === city.country
                          ? "default"
                          : "outline"
                      }
                      className="w-full justify-start text-sm"
                      onClick={() =>
                        updateLocation(city.city, city.country, city.lat, city.lng, city.tz)
                      }
                      disabled={isSaving}
                    >
                      <MapPin className="w-4 h-4 mr-2" />
                      {city.city}, {city.country}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Manual Location Entry */}
            <div className="space-y-3 pt-4 border-t">
              <Label className="text-xs text-muted-foreground">Manual Location Entry</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="City"
                  value={settings.city}
                  onChange={(e) => updateLocation(e.target.value, settings.country)}
                  disabled={isSaving}
                />
                <Input
                  placeholder="Country"
                  value={settings.country}
                  onChange={(e) => updateLocation(settings.city, e.target.value)}
                  disabled={isSaving}
                />
              </div>
            </div>

            {/* Temperature Unit */}
            <div className="pt-4 border-t space-y-2">
              <Label className="text-xs text-muted-foreground">Temperature Display</Label>
              <div className="flex gap-2">
                <Button
                  variant={settings.temperature_unit === "celsius" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => updateTemperatureUnit("celsius")}
                  disabled={isSaving}
                >
                  °C Celsius
                </Button>
                <Button
                  variant={settings.temperature_unit === "fahrenheit" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => updateTemperatureUnit("fahrenheit")}
                  disabled={isSaving}
                >
                  °F Fahrenheit
                </Button>
              </div>
            </div>

            {/* Prayer Calculation Method */}
            <div className="pt-4 border-t space-y-2">
              <Label htmlFor="prayer-method" className="text-xs text-muted-foreground">
                Prayer Time Calculation Method
              </Label>
              <Select
                value={settings.prayer_calculation_method.toString()}
                onValueChange={(value) => updatePrayerCalculationMethod(parseInt(value))}
              >
                <SelectTrigger id="prayer-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">ISNA (North America)</SelectItem>
                  <SelectItem value="3">Muslim World League</SelectItem>
                  <SelectItem value="5">Egyptian General Authority</SelectItem>
                  <SelectItem value="4">Umm Al-Qura (Mecca)</SelectItem>
                  <SelectItem value="8">Dubai</SelectItem>
                  <SelectItem value="13">Turkey (Diyanet)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Different regions use different calculation methods. Choose the method preferred in
                your area.
              </p>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Location Info */}
      <motion.div variants={staggerItem}>
        <GlassCard variant="gradient" className="p-5">
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium mb-1">Location Accuracy</p>
              <p className="text-xs text-muted-foreground">
                Your location is used to calculate accurate prayer times and display local weather
                information. Make sure to set your home location rather than your current location
                for consistent prayer times.
              </p>
            </div>
          </div>
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}
